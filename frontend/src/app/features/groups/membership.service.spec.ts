import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Observable } from 'rxjs';
import { MembershipService } from './membership.service';
import { AuthService } from '../../core/auth/auth.service';
import { User } from '../../core/auth/models/user.model';
import { MembersService } from '../members/members.service';
import { MandatesService } from '../mandates/mandates.service';
import { JoinRequestsService } from './join-requests.service';
import { AuditService } from '../audit/audit.service';
import { EnsembleSettingsService } from '../ensemble/ensemble-settings.service';
import { AccessDeniedError, RuleViolationError } from '../../core/access/mandate-rules';
import { Mandate, MandateKind } from '../../core/models/mandate.model';
import { isChatSystemEvent } from '../audit/audit-text';
import { GroupsService } from './groups.service';
import { PostsService } from '../posts/posts.service';
import { CommentsService } from '../posts/comments.service';
import { ChatService } from '../chat/chat.service';
import { canPostInGroup, canRequestToJoin } from '../../core/access/access.utils';
import { AccessService } from '../../core/access/access.service';
import { firstValueFrom } from 'rxjs';

// Vymyšlení členové (mock-members.ts): 1 Jana [2,5], 3 Admin [1,2,5], 4 Péťa [2,4], 7 Evička [2,5,6], 9 Maky [2,5,7]
const HOLKY = 5;
const KLUCI = 4;

describe('MembershipService', () => {
  let service: MembershipService;
  let members: MembersService;
  let mandates: MandatesService;
  let requests: JoinRequestsService;
  let audit: AuditService;
  const user = signal<User | null>(null);

  function as(memberId: number): void {
    user.set({ id: memberId, name: '', email: '' });
  }

  function run<T>(obs: Observable<T>): { value?: T; error?: unknown } {
    const result: { value?: T; error?: unknown } = {};
    obs.subscribe({ next: (v) => (result.value = v), error: (e) => (result.error = e) });
    return result;
  }

  function grant(memberId: number, kind: MandateKind, groupId?: number): Mandate {
    return mandates.add({ memberId, kind, groupId, grantedAt: '2026-01-01T00:00:00' });
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: AuthService, useValue: { currentUser: user } }] });
    service = TestBed.inject(MembershipService);
    members = TestBed.inject(MembersService);
    mandates = TestBed.inject(MandatesService);
    requests = TestBed.inject(JoinRequestsService);
    audit = TestBed.inject(AuditService);
    // Známý výchozí stav pověření: Admin (3) spravuje soubor, Jana (1) je hlavní správkyní Holek
    mandates.mandates().forEach((m) => mandates.remove(m.id));
    grant(3, 'ensemble-admin');
    grant(1, 'group-owner', HOLKY);
  });

  it('žádost o vstup se stane členstvím až po schválení správcem', () => {
    as(4);
    const request = run(service.requestToJoin(HOLKY, 'Ahoj')).value!;
    expect(members.findMember(4)!.groupIds).not.toContain(HOLKY);
    expect(run(service.requestToJoin(HOLKY)).error).toEqual(jasmine.any(RuleViolationError));

    // Běžný člen žádost schválit nemůže
    as(7);
    expect(run(service.approve(request.id)).error).toEqual(jasmine.any(AccessDeniedError));

    as(1);
    run(service.approve(request.id));
    expect(members.findMember(4)!.groupIds).toContain(HOLKY);
    expect(members.findMember(4)!.groupJoinedAt?.[HOLKY]).toBeTruthy();
    expect(requests.find(request.id)!.status).toBe('accepted');
    const joined = audit.entries().find((e) => e.action === 'member-joined')!;
    expect(joined.actorId).toBe(1);
    expect(isChatSystemEvent(joined, HOLKY)).toBeTrue();
  });

  it('návrh člena vyžaduje schválení správcem a pak přijetí pozvaným', () => {
    as(7);
    const proposal = run(service.invite(HOLKY, 4)).value!;
    expect(proposal.status).toBe('awaiting-manager');

    as(4);
    expect(run(service.acceptInvitation(proposal.id)).error).toEqual(jasmine.any(AccessDeniedError));

    as(1);
    run(service.approve(proposal.id));
    expect(requests.find(proposal.id)!.status).toBe('awaiting-member');
    expect(members.findMember(4)!.groupIds).not.toContain(HOLKY);

    as(4);
    run(service.acceptInvitation(proposal.id));
    expect(members.findMember(4)!.groupIds).toContain(HOLKY);
  });

  it('pozvaný může pozvánku odmítnout', () => {
    as(1);
    const invitation = run(service.invite(HOLKY, 4)).value!;
    expect(invitation.status).toBe('awaiting-member');
    as(4);
    run(service.declineInvitation(invitation.id));
    expect(requests.find(invitation.id)!.status).toBe('declined');
    expect(members.findMember(4)!.groupIds).not.toContain(HOLKY);
  });

  it('Správa souboru se do skupiny sama tiše nepřidá; přidání jiných je zvýrazněný zásah', () => {
    as(3);
    expect(run(service.addMember(KLUCI, 3)).error).toEqual(jasmine.any(AccessDeniedError));
    run(service.addMember(KLUCI, 1));
    expect(members.findMember(1)!.groupIds).toContain(KLUCI);
    const entry = audit.entries().at(-1)!;
    expect(entry.action).toBe('member-added');
    expect(entry.extraordinary).toBeTrue();
  });

  it('běžný člen nikoho přímo nepřidá ani neodebere', () => {
    as(7);
    expect(run(service.addMember(HOLKY, 4)).error).toEqual(jasmine.any(AccessDeniedError));
    expect(run(service.removeMember(HOLKY, 9)).error).toEqual(jasmine.any(AccessDeniedError));
  });

  it('jediný hlavní správce nemůže odejít ani být odebrán', () => {
    as(1);
    expect(run(service.leaveGroup(HOLKY)).error).toEqual(jasmine.any(RuleViolationError));
    as(3);
    expect(run(service.removeMember(HOLKY, 1)).error).toEqual(jasmine.any(RuleViolationError));
    expect(members.findMember(1)!.groupIds).toContain(HOLKY);
  });

  it('spolusprávce nepověřuje další správce, hlavní správce ano a může správu předat', () => {
    as(1);
    run(service.setGroupRole(HOLKY, 7, 'deputy'));
    as(7);
    expect(run(service.setGroupRole(HOLKY, 9, 'deputy')).error).toEqual(jasmine.any(AccessDeniedError));

    as(1);
    run(service.setGroupRole(HOLKY, 7, 'owner'));
    const holky = mandates.mandates().filter((m) => m.groupId === HOLKY);
    expect(holky.find((m) => m.kind === 'group-owner')!.memberId).toBe(7);
    // dosavadní hlavní správkyně zůstává spolusprávkyní
    expect(holky.some((m) => m.kind === 'group-deputy' && m.memberId === 1)).toBeTrue();
  });

  it('spolusprávcem může být jen člen skupiny; odebráním z ní pověření zanikne', () => {
    as(1);
    expect(run(service.setGroupRole(HOLKY, 4, 'deputy')).error).toEqual(jasmine.any(RuleViolationError));
    run(service.setGroupRole(HOLKY, 9, 'deputy'));
    run(service.removeMember(HOLKY, 9, 'důvod jen pro správce'));
    expect(mandates.mandates().some((m) => m.memberId === 9 && m.groupId === HOLKY)).toBeFalse();
    const removed = audit.entries().find((e) => e.action === 'member-removed')!;
    expect(removed.note).toBe('důvod jen pro správce');
  });

  it('pověření pro soubor přiděluje jen Správa souboru a posledního správce nelze odebrat', () => {
    as(1);
    expect(run(service.grantMandate(9, 'costumes')).error).toEqual(jasmine.any(AccessDeniedError));
    as(3);
    expect(run(service.grantMandate(9, 'costumes')).value?.kind).toBe('costumes');
    const adminMandate = mandates.mandates().find((m) => m.kind === 'ensemble-admin')!;
    expect(run(service.revokeMandate(adminMandate.id)).error).toEqual(jasmine.any(RuleViolationError));
    expect(run(service.setPersonActive(3, false)).error).toEqual(jasmine.any(RuleViolationError));
  });

  it('ukončení členství odebere skupiny a pověření, osoba zůstane', () => {
    as(3);
    grant(9, 'costumes');
    run(service.setPersonActive(9, false));
    const maky = members.findMember(9)!;
    expect(maky.isActive).toBeFalse();
    expect(maky.groupIds).toEqual([]);
    expect(mandates.mandates().some((m) => m.memberId === 9)).toBeFalse();
  });

  it('Správa souboru založí skupinu s hlavním správcem; člen jen při režimu „všichni členové“', () => {
    as(3);
    const group = run(service.createGroup({ name: 'Propagace', slug: 'propagace' }, 7)).value!;
    expect(mandates.mandates().some((m) => m.groupId === group.id && m.kind === 'group-owner' && m.memberId === 7)).toBeTrue();
    expect(members.findMember(3)!.groupIds).not.toContain(group.id);
    expect(run(service.createGroup({ name: 'Jiná', slug: 'propagace' })).error).toEqual(jasmine.any(RuleViolationError));

    as(4);
    expect(run(service.createGroup({ name: 'Kapela', slug: 'kapela' })).error).toEqual(jasmine.any(AccessDeniedError));
    const settings = TestBed.inject(EnsembleSettingsService);
    settings.save({ ...settings.settings(), groupCreation: 'members' });
    const own = run(service.createGroup({ name: 'Kapela', slug: 'kapela' })).value!;
    expect(members.findMember(4)!.groupIds).toContain(own.id);
    expect(mandates.mandates().some((m) => m.groupId === own.id && m.kind === 'group-owner' && m.memberId === 4)).toBeTrue();
  });

  it('spolusprávce mění komunikační volby, ale ne název ani viditelnost', () => {
    as(1);
    run(service.setGroupRole(HOLKY, 7, 'deputy'));
    as(7);
    expect(run(service.updateGroup(HOLKY, { defaultTab: 'board' })).error).toBeUndefined();
    expect(run(service.updateGroup(HOLKY, { name: 'Děvčata' })).error).toEqual(jasmine.any(AccessDeniedError));
  });

  describe('archivace a smazání skupiny (docs/08 kap. 10.5)', () => {
    let groups: GroupsService;
    beforeEach(() => (groups = TestBed.inject(GroupsService)));
    afterEach(() => {
      groups.resetCache();
      TestBed.inject(PostsService).resetCache();
      TestBed.inject(CommentsService).resetCache();
      TestBed.inject(ChatService).resetCache();
      members.resetCache();
      requests.resetCache();
    });

    it('archivovat smí hlavní správce i Správa souboru, běžný člen ne; obnovit lze', () => {
      as(7);
      expect(run(service.archiveGroup(HOLKY)).error).toEqual(jasmine.any(AccessDeniedError));
      as(1);
      expect(run(service.archiveGroup(HOLKY)).value!.archivedAt).toBeTruthy();
      expect(audit.entries().some((e) => e.action === 'group-archived')).toBeTrue();
      as(3);
      expect(run(service.restoreGroup(HOLKY)).value!.archivedAt).toBeUndefined();
    });

    it('archivovaná skupina je jen ke čtení: nepíše se, nevstupuje, nemění se členství', () => {
      as(1);
      run(service.archiveGroup(HOLKY));
      const access = TestBed.inject(AccessService);
      const group = groups.findGroup(HOLKY)!;
      expect(canPostInGroup(access.subject(), group)).toBeFalse();
      as(4);
      expect(canRequestToJoin(access.subject(), group)).toBeFalse();
      as(1);
      expect(run(service.addMember(HOLKY, 4)).error).toEqual(jasmine.any(RuleViolationError));
      expect(run(service.invite(HOLKY, 4)).error).toEqual(jasmine.any(RuleViolationError));
      expect(run(service.updateGroup(HOLKY, { name: 'Jiné' })).error).toEqual(jasmine.any(RuleViolationError));
    });

    it('smazat lze jen archivovanou skupinu a jen Správou souboru; odstraní příspěvky, komentáře i chat', async () => {
      const posts = TestBed.inject(PostsService);
      const chat = TestBed.inject(ChatService);
      const comments = TestBed.inject(CommentsService);
      const holkyPosts = (await firstValueFrom(posts.getPosts())).filter((p) => p.groupId === HOLKY).map((p) => p.id);
      expect(holkyPosts.length).toBeGreaterThan(0);

      as(3);
      expect(run(service.deleteGroup(HOLKY)).error).toEqual(jasmine.any(RuleViolationError));
      as(1);
      run(service.archiveGroup(HOLKY));
      expect(run(service.deleteGroup(HOLKY)).error).toEqual(jasmine.any(AccessDeniedError));

      as(3);
      expect(run(service.deleteGroup(HOLKY)).error).toBeUndefined();
      expect(groups.findGroup(HOLKY)).toBeUndefined();
      expect((await firstValueFrom(posts.getPosts())).some((p) => p.groupId === HOLKY)).toBeFalse();
      expect(chat.messages().some((m) => m.groupId === HOLKY)).toBeFalse();
      expect((await firstValueFrom(comments.getAllComments())).some((c) => holkyPosts.includes(c.postId))).toBeFalse();
      expect(members.findMember(1)!.groupIds).not.toContain(HOLKY);
    });
  });
});

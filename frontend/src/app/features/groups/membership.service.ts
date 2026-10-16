import { Injectable } from '@angular/core';
import { Observable, defer, of } from 'rxjs';
import { AccessService } from '../../core/access/access.service';
import * as access from '../../core/access/access.utils';
import {
  AccessDeniedError,
  RuleViolationError,
  deactivationProblem,
  groupLeaveProblem,
  mandateRevocationProblem,
} from '../../core/access/mandate-rules';
import { Group } from '../../core/models/group.model';
import { Mandate, MandateKind } from '../../core/models/mandate.model';
import { Member } from '../../core/models/member.model';
import { MembersService } from '../members/members.service';
import { GroupsService } from './groups.service';
import { MandatesService } from '../mandates/mandates.service';
import { JoinRequestsService } from './join-requests.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit.model';
import { JoinRequest, isPendingJoinRequest } from './models/join-request.model';

export type GroupPatch = Partial<Omit<Group, 'id' | 'ensembleId'>>;

const METADATA_FIELDS: (keyof Group)[] = ['name', 'slug', 'icon', 'description', 'visibility'];
const COMMUNICATION_FIELDS: (keyof Group)[] = ['chatEnabled', 'boardEnabled', 'defaultTab'];

export type PersonInput = Pick<Member, 'firstName' | 'lastName' | 'nickname' | 'email' | 'phone' | 'functionTitle' | 'isExternal'>;

// Všechny změny skupin, členství a pověření. Ověří oprávnění přihlášeného (stejně jako to bude
// dělat backend), ohlídá pravidla (poslední správce…) a zapíše historii, ze které se skládají
// i neutrální systémové události v chatu skupiny.
@Injectable({ providedIn: 'root' })
export class MembershipService {
  constructor(
    private accessService: AccessService,
    private membersService: MembersService,
    private groupsService: GroupsService,
    private mandatesService: MandatesService,
    private requestsService: JoinRequestsService,
    private audit: AuditService,
  ) {}

  // --- pomocné ---

  private perform<T>(fn: () => T): Observable<T> {
    return defer(() => of(fn()));
  }

  private actor(): access.AccessSubject {
    const s = this.accessService.subject();
    if (!s) throw new AccessDeniedError('Nejste přihlášeni.');
    return s;
  }

  private require(allowed: boolean, message?: string): void {
    if (!allowed) throw new AccessDeniedError(message);
  }

  private group(id: number): Group {
    const group = this.groupsService.findGroup(id);
    if (!group) throw new RuleViolationError('Skupina neexistuje.');
    return group;
  }

  private member(id: number): Member {
    const member = this.membersService.findMember(id);
    if (!member) throw new RuleViolationError('Osoba neexistuje.');
    return member;
  }

  private log(action: AuditAction, actorId: number, data: Partial<Omit<Parameters<AuditService['record']>[0], 'action' | 'actorId'>> = {}): void {
    this.audit.record({ groupIds: [], ...data, action, actorId });
  }

  // Zásah správy souboru do skupiny, kterou sám nespravuje – v historii zvýrazněný
  private isExtraordinary(s: access.AccessSubject, groupId: number): boolean {
    return access.isEnsembleAdmin(s) && !access.isGroupManager(s, groupId);
  }

  private closePendingFor(groupId: number, memberId: number, status: JoinRequest['status'], actorId: number): void {
    this.requestsService
      .requests()
      .filter((r) => r.groupId === groupId && r.memberId === memberId && isPendingJoinRequest(r))
      .forEach((r) => this.requestsService.update(r.id, { status, decidedAt: new Date().toISOString(), decidedById: actorId }));
  }

  private join(groupId: number, memberId: number, actorId: number, action: AuditAction, extraordinary = false): void {
    this.membersService.setGroupMembership(memberId, groupId, true);
    this.closePendingFor(groupId, memberId, 'accepted', actorId);
    this.log(action, actorId, { groupIds: [groupId], memberId, extraordinary: extraordinary || undefined });
  }

  private leave(groupId: number, memberId: number, actorId: number, action: AuditAction, note?: string): void {
    const problem = groupLeaveProblem(memberId, groupId, this.mandatesService.mandates());
    if (problem) throw new RuleViolationError(problem);
    this.membersService.setGroupMembership(memberId, groupId, false);
    // Spolusprávce bez členství by nemohl moderovat obsah, který nečte – pověření zaniká
    this.mandatesService
      .mandates()
      .filter((m) => m.memberId === memberId && m.groupId === groupId && m.kind === 'group-deputy')
      .forEach((m) => {
        this.mandatesService.remove(m.id);
        this.log('mandate-revoked', actorId, { groupIds: [groupId], memberId, mandateKind: m.kind });
      });
    this.log(action, actorId, { groupIds: [groupId], memberId, note });
  }

  // --- skupiny ---

  createGroup(data: Omit<Group, 'id' | 'ensembleId'>, ownerId?: number): Observable<Group> {
    return this.perform(() => {
      const s = this.actor();
      this.require(this.accessService.canCreateGroup(), 'Zakládat skupiny může jen Správa souboru.');
      this.assertUniqueSlug(data.slug);
      const group = this.groupsService.insert({ ...data, ensembleId: 1 });
      const isAdmin = access.isEnsembleAdmin(s);
      // Člen, který skupinu založil, je jejím členem a hlavním správcem. Správa souboru může
      // určit hlavního správce, jinak skupinu dočasně spravuje sama (bez přístupu k obsahu).
      const owner = ownerId ?? s.memberId;
      if (!isAdmin) this.join(group.id, s.memberId, s.memberId, 'member-added');
      this.mandatesService.add({
        memberId: owner,
        kind: 'group-owner',
        groupId: group.id,
        grantedAt: new Date().toISOString(),
        grantedById: s.memberId,
        temporary: isAdmin && owner === s.memberId ? true : undefined,
      });
      this.log('group-created', s.memberId, { groupIds: [group.id] });
      this.log('mandate-granted', s.memberId, { groupIds: [group.id], memberId: owner, mandateKind: 'group-owner' });
      return group;
    });
  }

  private assertUniqueSlug(slug: string, exceptId?: number): void {
    if (this.groupsService.groups().some((g) => g.slug === slug && g.id !== exceptId)) {
      throw new RuleViolationError(`Slug „${slug}“ už používá jiná skupina.`);
    }
  }

  updateGroup(groupId: number, patch: GroupPatch): Observable<Group> {
    return this.perform(() => {
      const s = this.actor();
      const group = this.group(groupId);
      const changed = (Object.keys(patch) as (keyof Group)[]).filter((k) => patch[k as keyof GroupPatch] !== group[k]);
      if (changed.some((k) => METADATA_FIELDS.includes(k))) {
        this.require(access.canEditGroupMetadata(s, groupId), 'Název, ikonu a viditelnost mění hlavní správce nebo Správa souboru.');
      }
      if (changed.some((k) => COMMUNICATION_FIELDS.includes(k))) {
        this.require(access.canEditGroupCommunication(s, groupId));
      }
      if (patch.slug) this.assertUniqueSlug(patch.slug, groupId);
      const updated: Group = { ...group, ...patch };
      this.groupsService.replace(updated);
      if (changed.length) this.log('group-updated', s.memberId, { groupIds: [groupId], details: changed.join(', ') });
      return updated;
    });
  }

  deleteGroup(groupId: number): Observable<void> {
    return this.perform(() => {
      const s = this.actor();
      this.require(access.canDeleteGroup(s));
      this.group(groupId);
      this.membersService.members().filter((m) => m.groupIds.includes(groupId)).forEach((m) => this.membersService.setGroupMembership(m.id, groupId, false));
      this.mandatesService.mandates().filter((m) => m.groupId === groupId).forEach((m) => this.mandatesService.remove(m.id));
      this.groupsService.remove(groupId);
      this.log('group-deleted', s.memberId, { groupIds: [groupId] });
    });
  }

  // --- členství ---

  // Přímé přidání správcem. Sám sebe do skupiny přidat nelze (ani jako Správa souboru) – jen žádostí.
  addMember(groupId: number, memberId: number): Observable<void> {
    return this.perform(() => {
      const s = this.actor();
      this.group(groupId);
      this.require(access.canManageGroupMembership(s, groupId));
      if (memberId === s.memberId && !access.isGroupManager(s, groupId)) {
        throw new AccessDeniedError('Do skupiny se nemůžete přidat sami – požádejte o vstup jejího správce.');
      }
      const member = this.member(memberId);
      if (!member.isActive) throw new RuleViolationError('Bývalého člena nelze přidat do skupiny.');
      if (member.groupIds.includes(groupId)) return;
      this.join(groupId, memberId, s.memberId, 'member-added', this.isExtraordinary(s, groupId));
    });
  }

  removeMember(groupId: number, memberId: number, note?: string): Observable<void> {
    return this.perform(() => {
      const s = this.actor();
      this.group(groupId);
      if (memberId === s.memberId) return this.leaveSync(groupId, s);
      this.require(access.canManageGroupMembership(s, groupId));
      // Spolusprávce neodebírá hlavního správce
      const role = access.groupRole({ ...s, mandates: this.mandatesService.mandates().filter((m) => m.memberId === memberId) }, groupId);
      if (role === 'owner') this.require(access.canAssignGroupManagers(s, groupId), 'Hlavního správce může odebrat jen on sám po předání nebo Správa souboru.');
      this.leave(groupId, memberId, s.memberId, 'member-removed', note);
    });
  }

  leaveGroup(groupId: number): Observable<void> {
    return this.perform(() => this.leaveSync(groupId, this.actor()));
  }

  private leaveSync(groupId: number, s: access.AccessSubject): void {
    this.group(groupId);
    if (!s.groupIds.includes(groupId)) return;
    this.leave(groupId, s.memberId, s.memberId, 'member-left');
  }

  joinOpenGroup(groupId: number): Observable<void> {
    return this.perform(() => {
      const s = this.actor();
      this.require(access.canJoinDirectly(s, this.group(groupId)));
      this.join(groupId, s.memberId, s.memberId, 'member-joined');
    });
  }

  // --- žádosti a pozvánky ---

  private assertNoPending(groupId: number, memberId: number): void {
    if (this.requestsService.requests().some((r) => r.groupId === groupId && r.memberId === memberId && isPendingJoinRequest(r))) {
      throw new RuleViolationError('Pro tuto osobu už existuje nevyřízená žádost nebo pozvánka.');
    }
  }

  requestToJoin(groupId: number, message?: string): Observable<JoinRequest> {
    return this.perform(() => {
      const s = this.actor();
      this.require(access.canRequestToJoin(s, this.group(groupId)));
      this.assertNoPending(groupId, s.memberId);
      const request = this.requestsService.add({
        groupId,
        memberId: s.memberId,
        kind: 'request',
        status: 'awaiting-manager',
        createdById: s.memberId,
        createdAt: new Date().toISOString(),
        message: message?.trim() || undefined,
      });
      this.log('request-created', s.memberId, { groupIds: [groupId], memberId: s.memberId });
      return request;
    });
  }

  // Správce rovnou pozve (čeká se na pozvaného); běžný člen jen navrhne (nejdřív rozhodne správce)
  invite(groupId: number, memberId: number, message?: string): Observable<JoinRequest> {
    return this.perform(() => {
      const s = this.actor();
      const group = this.group(groupId);
      const manages = access.canManageGroupMembership(s, groupId);
      this.require(manages || access.canProposeMember(s, group));
      const member = this.member(memberId);
      if (!member.isActive) throw new RuleViolationError('Bývalého člena nelze pozvat.');
      if (member.groupIds.includes(groupId)) throw new RuleViolationError('Osoba už je členem skupiny.');
      this.assertNoPending(groupId, memberId);
      const request = this.requestsService.add({
        groupId,
        memberId,
        kind: 'invitation',
        status: manages ? 'awaiting-member' : 'awaiting-manager',
        createdById: s.memberId,
        createdAt: new Date().toISOString(),
        approvedById: manages ? s.memberId : undefined,
        message: message?.trim() || undefined,
      });
      this.log(manages ? 'invitation-created' : 'proposal-created', s.memberId, {
        groupIds: [groupId],
        memberId,
        extraordinary: manages && this.isExtraordinary(s, groupId) ? true : undefined,
      });
      return request;
    });
  }

  private pending(requestId: number): JoinRequest {
    const request = this.requestsService.find(requestId);
    if (!request || !isPendingJoinRequest(request)) throw new RuleViolationError('Žádost už byla vyřízena.');
    return request;
  }

  // Správce schválí žádost (→ členství) nebo návrh člena (→ pozvánka čeká na pozvaného)
  approve(requestId: number): Observable<void> {
    return this.perform(() => {
      const s = this.actor();
      const request = this.pending(requestId);
      this.require(request.status === 'awaiting-manager' && access.canManageGroupMembership(s, request.groupId));
      if (request.kind === 'request') {
        this.requestsService.update(request.id, { approvedById: s.memberId });
        this.log('request-approved', s.memberId, { groupIds: [request.groupId], memberId: request.memberId });
        this.join(request.groupId, request.memberId, s.memberId, 'member-joined', this.isExtraordinary(s, request.groupId));
      } else {
        this.requestsService.update(request.id, { status: 'awaiting-member', approvedById: s.memberId });
        this.log('invitation-created', s.memberId, { groupIds: [request.groupId], memberId: request.memberId });
      }
    });
  }

  reject(requestId: number): Observable<void> {
    return this.perform(() => {
      const s = this.actor();
      const request = this.pending(requestId);
      this.require(request.status === 'awaiting-manager' && access.canManageGroupMembership(s, request.groupId));
      this.requestsService.update(request.id, { status: 'rejected', decidedAt: new Date().toISOString(), decidedById: s.memberId });
      this.log('request-rejected', s.memberId, { groupIds: [request.groupId], memberId: request.memberId });
    });
  }

  // Zrušit může ten, kdo žádost/pozvánku vytvořil, nebo správce skupiny
  cancel(requestId: number): Observable<void> {
    return this.perform(() => {
      const s = this.actor();
      const request = this.pending(requestId);
      this.require(request.createdById === s.memberId || access.canManageGroupMembership(s, request.groupId));
      this.requestsService.update(request.id, { status: 'cancelled', decidedAt: new Date().toISOString(), decidedById: s.memberId });
      this.log(request.kind === 'request' ? 'request-cancelled' : 'invitation-cancelled', s.memberId, {
        groupIds: [request.groupId],
        memberId: request.memberId,
      });
    });
  }

  acceptInvitation(requestId: number): Observable<void> {
    return this.perform(() => {
      const s = this.actor();
      const request = this.pending(requestId);
      this.require(request.kind === 'invitation' && request.status === 'awaiting-member' && request.memberId === s.memberId);
      this.join(request.groupId, s.memberId, s.memberId, 'member-joined');
    });
  }

  declineInvitation(requestId: number): Observable<void> {
    return this.perform(() => {
      const s = this.actor();
      const request = this.pending(requestId);
      this.require(request.kind === 'invitation' && request.status === 'awaiting-member' && request.memberId === s.memberId);
      this.requestsService.update(request.id, { status: 'declined', decidedAt: new Date().toISOString(), decidedById: s.memberId });
      this.log('invitation-declined', s.memberId, { groupIds: [request.groupId], memberId: s.memberId });
    });
  }

  // --- správci skupiny ---

  // role null = běžný člen. Nový hlavní správce převezme správu, dosavadní se stane spolusprávcem.
  setGroupRole(groupId: number, memberId: number, role: access.GroupRole | null): Observable<void> {
    return this.perform(() => {
      const s = this.actor();
      this.group(groupId);
      this.require(access.canAssignGroupManagers(s, groupId), 'Správce skupiny určuje hlavní správce nebo Správa souboru.');
      const member = this.member(memberId);
      if (!member.isActive) throw new RuleViolationError('Bývalý člen nemůže spravovat skupinu.');
      if (role === 'deputy' && !member.groupIds.includes(groupId)) {
        throw new RuleViolationError('Spolusprávcem může být jen člen skupiny – moderovat lze jen obsah, který člověk čte.');
      }
      const all = this.mandatesService.mandates();
      const current = all.filter((m) => m.memberId === memberId && m.groupId === groupId && (m.kind === 'group-owner' || m.kind === 'group-deputy'));
      const currentRole: access.GroupRole | null = current.some((m) => m.kind === 'group-owner') ? 'owner' : current.length ? 'deputy' : null;
      if (currentRole === role) return;

      if (currentRole === 'owner') {
        const problem = mandateRevocationProblem(current.find((m) => m.kind === 'group-owner')!, all, this.membersService.members());
        if (problem) throw new RuleViolationError(problem);
      }

      if (role === 'owner') {
        // Předání hlavní správy: dosavadní hlavní správci se stanou spolusprávci (pokud jsou členy)
        all
          .filter((m) => m.kind === 'group-owner' && m.groupId === groupId)
          .forEach((m) => {
            this.mandatesService.remove(m.id);
            this.log('mandate-revoked', s.memberId, { groupIds: [groupId], memberId: m.memberId, mandateKind: 'group-owner' });
            const prev = this.membersService.findMember(m.memberId);
            if (prev?.groupIds.includes(groupId) && !m.temporary) {
              this.grantSync(s, m.memberId, 'group-deputy', { groupId });
            }
          });
      }

      current.forEach((m) => {
        if (this.mandatesService.mandates().some((x) => x.id === m.id)) {
          this.mandatesService.remove(m.id);
          this.log('mandate-revoked', s.memberId, { groupIds: [groupId], memberId, mandateKind: m.kind });
        }
      });

      if (role) this.grantSync(s, memberId, role === 'owner' ? 'group-owner' : 'group-deputy', { groupId });
    });
  }

  // --- pověření ---

  private grantSync(s: access.AccessSubject, memberId: number, kind: MandateKind, scope: { groupId?: number; eventId?: number }): Mandate {
    const exists = this.mandatesService
      .mandates()
      .find((m) => m.memberId === memberId && m.kind === kind && m.groupId === scope.groupId && m.eventId === scope.eventId);
    if (exists) return exists;
    const mandate = this.mandatesService.add({ memberId, kind, ...scope, grantedAt: new Date().toISOString(), grantedById: s.memberId });
    this.log('mandate-granted', s.memberId, {
      groupIds: scope.groupId ? [scope.groupId] : [],
      memberId,
      eventId: scope.eventId,
      mandateKind: kind,
    });
    return mandate;
  }

  // Pověření pro soubor, akce a moduly přiděluje Správa souboru (správu skupin viz setGroupRole)
  grantMandate(memberId: number, kind: MandateKind, scope: { groupId?: number; eventId?: number } = {}): Observable<Mandate> {
    return this.perform(() => {
      const s = this.actor();
      if (kind === 'group-owner' || kind === 'group-deputy') throw new RuleViolationError('Správce skupiny se určuje v detailu skupiny.');
      this.require(access.isEnsembleAdmin(s), 'Pověření přiděluje Správa souboru.');
      const member = this.member(memberId);
      if (!member.isActive) throw new RuleViolationError('Bývalému členovi nelze přidělit pověření.');
      return this.grantSync(s, memberId, kind, scope);
    });
  }

  revokeMandate(mandateId: number): Observable<void> {
    return this.perform(() => {
      const s = this.actor();
      const mandate = this.mandatesService.mandates().find((m) => m.id === mandateId);
      if (!mandate) return;
      if (mandate.kind === 'group-owner' || mandate.kind === 'group-deputy') {
        return this.setGroupRoleSync(mandate);
      }
      this.require(access.isEnsembleAdmin(s), 'Pověření odebírá Správa souboru.');
      const problem = mandateRevocationProblem(mandate, this.mandatesService.mandates(), this.membersService.members());
      if (problem) throw new RuleViolationError(problem);
      this.mandatesService.remove(mandate.id);
      this.log('mandate-revoked', s.memberId, {
        groupIds: mandate.groupId ? [mandate.groupId] : [],
        memberId: mandate.memberId,
        eventId: mandate.eventId,
        mandateKind: mandate.kind,
      });
    });
  }

  private setGroupRoleSync(mandate: Mandate): void {
    let error: unknown;
    this.setGroupRole(mandate.groupId!, mandate.memberId, null).subscribe({ error: (e) => (error = e) });
    if (error) throw error;
  }

  // --- osoby (Správa → Členové) ---

  createPerson(input: PersonInput): Observable<Member> {
    return this.perform(() => {
      const s = this.actor();
      this.require(access.isEnsembleAdmin(s), 'Osoby zakládá Správa souboru.');
      const created = this.membersService.insert({
        ...input,
        ensembleId: 1,
        groupIds: [],
        isActive: true,
        createdAt: new Date().toISOString().slice(0, 10),
      });
      this.log('person-created', s.memberId, { memberId: created.id });
      return created;
    });
  }

  updatePerson(memberId: number, input: PersonInput): Observable<Member> {
    return this.perform(() => {
      const s = this.actor();
      this.require(access.isEnsembleAdmin(s), 'Osobní údaje upravuje Správa souboru.');
      const updated = this.membersService.replace({ ...this.member(memberId), ...input });
      this.log('person-updated', s.memberId, { memberId });
      return updated;
    });
  }

  // Ukončení aktivního členství: osoba, její historie i zápůjčky zůstávají, přístup a pověření zanikají
  setPersonActive(memberId: number, isActive: boolean): Observable<void> {
    return this.perform(() => {
      const s = this.actor();
      this.require(access.isEnsembleAdmin(s), 'Členství v souboru mění Správa souboru.');
      const member = this.member(memberId);
      if (member.isActive === isActive) return;
      if (!isActive) {
        const problem = deactivationProblem(memberId, this.mandatesService.mandates(), this.membersService.members(), (id) => this.groupsService.findGroup(id)?.name ?? `#${id}`);
        if (problem) throw new RuleViolationError(problem);
        this.mandatesService.mandates().filter((m) => m.memberId === memberId).forEach((m) => this.mandatesService.remove(m.id));
        member.groupIds.forEach((groupId) => {
          this.membersService.setGroupMembership(memberId, groupId, false);
          this.log('member-removed', s.memberId, { groupIds: [groupId], memberId });
        });
      }
      this.membersService.setActive(memberId, isActive);
      this.log(isActive ? 'person-reactivated' : 'person-deactivated', s.memberId, { memberId });
    });
  }
}

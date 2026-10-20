import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { User } from '../../core/auth/models/user.model';
import { AccessDeniedError, RuleViolationError } from '../../core/access/mandate-rules';
import { AuditEntry } from '../audit/audit.model';
import { AuditService } from '../audit/audit.service';
import { CostumeState } from '../costumes/models/costume.model';
import { MandatesService } from '../mandates/mandates.service';
import { MembersService } from '../members/members.service';
import { AttendanceService } from '../attendance/attendance.service';
import { PersonDeletionService } from './person-deletion.service';
import { PersonFootprint, costumeReferencesMember, deletionBlockers, hasOwnHistory } from './person-deletion';

describe('person-deletion – pravidla', () => {
  const entry = (patch: Partial<AuditEntry>): AuditEntry => ({ id: 1, at: '', actorId: 3, action: 'person-created', groupIds: [], ...patch });

  it('správní úkony nad osobou smazání nebrání, její vlastní činnost ano', () => {
    expect(hasOwnHistory([entry({ memberId: 9 }), entry({ action: 'member-added', memberId: 9 })], 9)).toBeFalse();
    expect(hasOwnHistory([entry({ actorId: 9, action: 'request-created' })], 9)).toBeTrue();
    expect(hasOwnHistory([entry({ action: 'person-deactivated', memberId: 9 })], 9)).toBeTrue();
  });

  it('evidence krojů brání smazání při zápůjčce, výchozí kroj ne', () => {
    const base = { loans: [], defaultCostumes: { 'member-9': 'muzske' } } as unknown as CostumeState;
    expect(costumeReferencesMember(base, 9)).toBeFalse();

    const withLoan = { ...base, loans: [{ id: 1, borrower: { kind: 'member', memberId: 9 }, issuedByMemberId: 2 }] } as unknown as CostumeState;
    expect(costumeReferencesMember(withLoan, 9)).toBeTrue();
    expect(costumeReferencesMember(withLoan, 2)).toBeTrue();
    expect(costumeReferencesMember(withLoan, 5)).toBeFalse();
  });

  it('vypíše důvody v pevném pořadí', () => {
    const none: PersonFootprint = { self: false, responses: false, actualAttendance: false, posts: false, comments: false, chat: false, mentions: false, eventGuest: false, costumes: false, history: false };
    expect(deletionBlockers(none)).toEqual([]);
    expect(deletionBlockers({ ...none, costumes: true, responses: true })).toEqual(['odpověděla na akce', 'má záznamy v evidenci krojů']);
  });
});

describe('PersonDeletionService', () => {
  const user = signal<User | null>(null);
  let service: PersonDeletionService;
  let members: MembersService;

  function run<T>(obs: Observable<T>): { error?: unknown } {
    const result: { error?: unknown } = {};
    obs.subscribe({ error: (e) => (result.error = e) });
    return result;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: AuthService, useValue: { currentUser: user } }] });
    service = TestBed.inject(PersonDeletionService);
    members = TestBed.inject(MembersService);
    members.resetCache();
    TestBed.inject(AuditService).resetCache();
    const mandates = TestBed.inject(MandatesService);
    mandates.mandates().forEach((m) => mandates.remove(m.id));
    mandates.add({ memberId: 3, kind: 'ensemble-admin', grantedAt: '2026-01-01T00:00:00' });
    user.set({ id: 3, name: '', email: '' });
  });

  const createClean = () => members.insert({ ensembleId: 1, firstName: 'Omyl', lastName: 'Založený', nickname: 'Omyl', groupIds: [], isActive: true, createdAt: '2026-10-20' });

  it('Správa souboru trvale smaže čistou osobu a zapíše to do historie', () => {
    const clean = createClean();
    expect(service.blockers(clean.id)).toEqual([]);

    expect(run(service.deletePerson(clean.id)).error).toBeUndefined();

    expect(members.findMember(clean.id)).toBeUndefined();
    const last = TestBed.inject(AuditService).entries().at(-1)!;
    expect(last.action).toBe('person-deleted');
    expect(last.details).toContain('Omyl');
  });

  it('osobu, která odpověděla na akci, smazat nelze', () => {
    const person = createClean();
    TestBed.inject(AttendanceService).setStatus(1, person.id, 'yes').subscribe();

    expect(service.blockers(person.id)).toContain('odpověděla na akce');
    expect(run(service.deletePerson(person.id)).error).toEqual(jasmine.any(RuleViolationError));
    expect(members.findMember(person.id)).toBeDefined();
  });

  it('bez pověření Správa souboru ani sám sebe smazat nelze', () => {
    const clean = createClean();
    user.set({ id: 1, name: '', email: '' });
    expect(run(service.deletePerson(clean.id)).error).toEqual(jasmine.any(AccessDeniedError));

    user.set({ id: 3, name: '', email: '' });
    expect(service.blockers(3)).toContain('jde o váš vlastní účet');
  });
});

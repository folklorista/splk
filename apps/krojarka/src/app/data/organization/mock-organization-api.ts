import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CreateAccountResponse,
  GrantMandateRequest,
  ManagedMandate,
  ManagedPerson,
  PersonInput,
  Unit,
} from '@splk/api-contracts';
import { mockFail, mockOk } from '../mock/mock-response';
import { OrganizationApi } from './organization-api';

const UNITS: Unit[] = [
  { id: 1, name: 'Vonica', shortName: 'Vonica', hasCostumeFund: true, archived: false },
  { id: 2, name: 'Malá Vonica', shortName: 'Malá Vonica', hasCostumeFund: true, archived: false },
  { id: 3, name: 'Děvčice z Vonice', shortName: 'Děvčice', hasCostumeFund: true, archived: false },
  { id: 4, name: 'Muzika', shortName: 'Muzika', hasCostumeFund: false, archived: false },
];

/** Synthetic people only (frontend spec chap. 8). Person 1 is the signed-in mock user. */
@Injectable()
export class MockOrganizationApi extends OrganizationApi {
  private nextId = 100;
  private readonly people: ManagedPerson[] = [
    this.person(1, 'Marie', 'Ukázková', { id: 1, loginEmail: 'krojarka@example.test', status: 'active', lastLoginAt: '2026-10-24T08:00:00+02:00' }, [
      this.mandate(1, 'costumes.manage', 1),
      this.mandate(2, 'costumes.view', 2),
      this.mandate(3, 'organization.admin', null),
    ]),
    this.person(2, 'Tereza', 'Pomocná', { id: 2, loginEmail: 'tereza@example.test', status: 'invited', lastLoginAt: null }, [this.mandate(4, 'costumes.manage', 1)]),
    this.person(3, 'Jan', 'Muzikant', null, []),
  ];

  units(): Observable<Unit[]> {
    return mockOk(UNITS);
  }

  persons(): Observable<ManagedPerson[]> {
    return mockOk(this.people);
  }

  createPerson(input: PersonInput): Observable<ManagedPerson> {
    const person = this.person(this.nextId++, input.firstName.trim(), input.lastName.trim(), null, []);
    person.nickname = input.nickname ?? null;
    person.contact = input.contact ?? null;
    person.note = input.note ?? null;
    this.people.push(person);
    return mockOk(person);
  }

  updatePerson(id: number, patch: Partial<PersonInput>): Observable<ManagedPerson> {
    const person = this.people.find((p) => p.id === id);
    return person ? mockOk(Object.assign(person, patch)) : mockFail(404, 'not_found');
  }

  createAccount(personId: number, email: string): Observable<CreateAccountResponse> {
    const person = this.people.find((p) => p.id === personId);
    if (!person) {
      return mockFail(422, 'validation_failed', { field: 'personId', reason: 'invalid' });
    }
    if (person.account) {
      return mockFail(422, 'account_exists');
    }
    if (this.people.some((p) => p.account?.loginEmail.toLowerCase() === email.toLowerCase())) {
      return mockFail(422, 'email_taken');
    }
    person.account = { id: this.nextId++, loginEmail: email, status: 'invited', lastLoginAt: null };
    return mockOk({ person, invitationSent: true });
  }

  resendInvitation(accountId: number): Observable<{ invitationSent: boolean }> {
    const person = this.byAccount(accountId);
    if (!person) {
      return mockFail(404, 'not_found');
    }
    return person.account?.status === 'invited' ? mockOk({ invitationSent: true }) : mockFail(422, 'account_not_invited');
  }

  disableAccount(accountId: number): Observable<ManagedPerson> {
    const person = this.byAccount(accountId);
    if (!person?.account) {
      return mockFail(404, 'not_found');
    }
    if (accountId === 1) {
      return mockFail(422, 'cannot_disable_self');
    }
    person.account.status = 'disabled';
    return mockOk(person);
  }

  enableAccount(accountId: number): Observable<ManagedPerson> {
    const person = this.byAccount(accountId);
    if (!person?.account || person.account.status !== 'disabled') {
      return mockFail(422, 'account_not_disabled');
    }
    person.account.status = 'active';
    return mockOk(person);
  }

  grantMandate(request: GrantMandateRequest): Observable<ManagedMandate> {
    const person = this.people.find((p) => p.id === request.personId);
    if (!person) {
      return mockFail(422, 'validation_failed', { field: 'personId', reason: 'invalid' });
    }
    if (person.mandates.some((m) => m.kind === request.kind && m.scopeId === request.unitId)) {
      return mockFail(422, 'mandate_exists');
    }
    const mandate = this.mandate(this.nextId++, request.kind, request.unitId);
    person.mandates.push(mandate);
    return mockOk(mandate);
  }

  revokeMandate(id: number): Observable<void> {
    const person = this.people.find((p) => p.mandates.some((m) => m.id === id));
    if (!person) {
      return mockFail(404, 'not_found');
    }
    const admins = this.people.filter((p) => p.mandates.some((m) => m.kind === 'organization.admin'));
    if (person.mandates.find((m) => m.id === id)?.kind === 'organization.admin' && admins.length === 1) {
      return mockFail(422, 'last_admin');
    }
    person.mandates = person.mandates.filter((m) => m.id !== id);
    return mockOk(undefined);
  }

  private byAccount(accountId: number): ManagedPerson | undefined {
    return this.people.find((p) => p.account?.id === accountId);
  }

  private person(id: number, firstName: string, lastName: string, account: ManagedPerson['account'], mandates: ManagedMandate[]): ManagedPerson {
    return { id, firstName, lastName, nickname: null, contact: null, note: null, account, mandates };
  }

  private mandate(id: number, kind: ManagedMandate['kind'], unitId: number | null): ManagedMandate {
    return {
      id,
      kind,
      scopeType: unitId === null ? 'organization' : 'unit',
      scopeId: unitId,
      scopeName: UNITS.find((u) => u.id === unitId)?.name ?? null,
      validFrom: '2026-10-24',
    };
  }
}

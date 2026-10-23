import { Observable } from 'rxjs';
import {
  CreateAccountResponse,
  GrantMandateRequest,
  ManagedMandate,
  ManagedPerson,
  PersonInput,
  Unit,
} from '@splk/api-contracts';

/** Nastavení → Uživatelé a pověření (organization.admin) and the unit list. HttpOrganizationApi / MockOrganizationApi. */
export abstract class OrganizationApi {
  /** every signed-in user */
  abstract units(): Observable<Unit[]>;
  abstract persons(): Observable<ManagedPerson[]>;
  abstract createPerson(input: PersonInput): Observable<ManagedPerson>;
  abstract updatePerson(id: number, patch: Partial<PersonInput>): Observable<ManagedPerson>;
  abstract createAccount(personId: number, email: string): Observable<CreateAccountResponse>;
  abstract resendInvitation(accountId: number): Observable<{ invitationSent: boolean }>;
  abstract disableAccount(accountId: number): Observable<ManagedPerson>;
  abstract enableAccount(accountId: number): Observable<ManagedPerson>;
  abstract grantMandate(request: GrantMandateRequest): Observable<ManagedMandate>;
  abstract revokeMandate(id: number): Observable<void>;
}

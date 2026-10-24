import { Observable } from 'rxjs';
import {
  GroupInput, GroupPatch, GroupMemberInput, ManagedGroup, GroupOption,
  CreateAccountResponse,
  GrantMandateRequest,
  ManagedMandate,
  ManagedPerson,
  PersonInput,
  Unit,
} from '@splk/api-contracts';

/** Nastavení → Uživatelé a pověření (organization.admin) and the unit list. HttpOrganizationApi / MockOrganizationApi. */
export abstract class OrganizationApi {
  abstract groups(): Observable<ManagedGroup[]>;
  abstract groupOptions(unitId: number): Observable<GroupOption[]>;
  abstract createGroup(input: GroupInput): Observable<ManagedGroup>;
  abstract updateGroup(id: number, input: GroupPatch): Observable<ManagedGroup>;
  abstract addGroupMember(id: number, input: GroupMemberInput): Observable<ManagedGroup>;
  abstract revokeGroupMember(id: number, membershipId: number): Observable<ManagedGroup>;
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

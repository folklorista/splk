import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, throwError } from 'rxjs';
import {
  GroupInput, GroupPatch, GroupMemberInput, ManagedGroup, GroupOption,
  CreateAccountRequest,
  CreateAccountResponse,
  GrantMandateRequest,
  ListResponse,
  ManagedMandate,
  ManagedPerson,
  PersonInput,
  Unit,
} from '@splk/api-contracts';
import { API_BASE_URL } from '../api-config';
import { ApiError } from '../api-error';
import { OrganizationApi } from './organization-api';

@Injectable()
export class HttpOrganizationApi extends OrganizationApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  groups() { return this.wrap(this.http.get<ListResponse<ManagedGroup>>(`${this.baseUrl}/groups`)).pipe(map((r) => r.items)); }
  groupOptions(unit: number) { return this.wrap(this.http.get<ListResponse<GroupOption>>(`${this.baseUrl}/funds/${unit}/inventories/groups`)).pipe(map((r) => r.items)); }
  createGroup(input: GroupInput) { return this.wrap(this.http.post<ManagedGroup>(`${this.baseUrl}/groups`, input)); }
  updateGroup(id: number, input: GroupPatch) { return this.wrap(this.http.patch<ManagedGroup>(`${this.baseUrl}/groups/${id}`, input)); }
  addGroupMember(id: number, input: GroupMemberInput) { return this.wrap(this.http.post<ManagedGroup>(`${this.baseUrl}/groups/${id}/members`, input)); }
  revokeGroupMember(id: number, membership: number) { return this.wrap(this.http.delete<ManagedGroup>(`${this.baseUrl}/groups/${id}/members/${membership}`)); }

  units(): Observable<Unit[]> {
    return this.wrap(this.http.get<ListResponse<Unit>>(`${this.baseUrl}/units`)).pipe(map((r) => r.items));
  }

  persons(): Observable<ManagedPerson[]> {
    return this.wrap(this.http.get<ListResponse<ManagedPerson>>(`${this.baseUrl}/persons`)).pipe(map((r) => r.items));
  }

  createPerson(input: PersonInput): Observable<ManagedPerson> {
    return this.wrap(this.http.post<ManagedPerson>(`${this.baseUrl}/persons`, input));
  }

  updatePerson(id: number, patch: Partial<PersonInput>): Observable<ManagedPerson> {
    return this.wrap(this.http.patch<ManagedPerson>(`${this.baseUrl}/persons/${id}`, patch));
  }

  createAccount(personId: number, email: string): Observable<CreateAccountResponse> {
    const body: CreateAccountRequest = { personId, email };
    return this.wrap(this.http.post<CreateAccountResponse>(`${this.baseUrl}/accounts`, body));
  }

  resendInvitation(accountId: number): Observable<{ invitationSent: boolean }> {
    return this.wrap(this.http.post<{ invitationSent: boolean }>(`${this.baseUrl}/accounts/${accountId}/invite`, null));
  }

  disableAccount(accountId: number): Observable<ManagedPerson> {
    return this.wrap(this.http.post<ManagedPerson>(`${this.baseUrl}/accounts/${accountId}/disable`, null));
  }

  enableAccount(accountId: number): Observable<ManagedPerson> {
    return this.wrap(this.http.post<ManagedPerson>(`${this.baseUrl}/accounts/${accountId}/enable`, null));
  }

  grantMandate(request: GrantMandateRequest): Observable<ManagedMandate> {
    return this.wrap(this.http.post<ManagedMandate>(`${this.baseUrl}/mandates`, request));
  }

  revokeMandate(id: number): Observable<void> {
    return this.wrap(this.http.delete<void>(`${this.baseUrl}/mandates/${id}`));
  }

  private wrap<T>(source: Observable<T>): Observable<T> {
    return source.pipe(catchError((error: unknown) => throwError(() => ApiError.from(error))));
  }
}

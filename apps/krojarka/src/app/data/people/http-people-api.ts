import type { PaperMigrationRequest, PaperMigrationResult, PaperMigrationFindings, PageQuery as PaperPageQuery } from '@splk/api-contracts';
import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { HolderProfile, HolderProfileInput, Page, PeopleQuery, PersonCard, PersonCreateInput, PersonIdentity, PersonInFund, PersonPatch } from '@splk/api-contracts';
import { API_BASE_URL } from '../api-config';
import { ApiError } from '../api-error';
import { PeopleApi } from './people-api';

@Injectable()
export class HttpPeopleApi extends PeopleApi {
  migratePaper(unit: number, person: number, input: PaperMigrationRequest) { return this.wrap(this.http.post<PaperMigrationResult>(`${this.base}/funds/${unit}/people/${person}/paper-migrations`, input)); }
  paperFindings(unit: number, person: number, query: PaperPageQuery = {}) { return this.wrap(this.http.get<PaperMigrationFindings>(`${this.base}/funds/${unit}/people/${person}/paper-migration-findings`, { params: { ...query } })); }
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);
  people(query: PeopleQuery = {}) {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) if (value !== undefined) params = params.set(key, String(value));
    return this.wrap(this.http.get<Page<PersonInFund>>(`${this.base}/people`, { params }));
  }
  create(input: PersonCreateInput) { return this.wrap(this.http.post<PersonIdentity>(`${this.base}/people`, input)); }
  update(id: number, input: PersonPatch) { return this.wrap(this.http.patch<PersonIdentity>(`${this.base}/people/${id}`, input)); }
  card(unit: number, id: number) { return this.wrap(this.http.get<PersonCard>(`${this.base}/funds/${unit}/people/${id}/card`)); }
  profile(unit: number, id: number, input: HolderProfileInput) { return this.wrap(this.http.put<HolderProfile>(`${this.base}/funds/${unit}/people/${id}/profile`, input)); }
  private wrap<T>(request: Observable<T>) { return request.pipe(catchError((error: unknown) => throwError(() => ApiError.from(error)))); }
}

import type { PaperMigrationRequest, PaperMigrationResult, PaperMigrationFindings, PageQuery as PaperPageQuery } from '@splk/api-contracts';
import { Observable } from 'rxjs';
import { HolderProfile, HolderProfileInput, Page, PeopleQuery, PersonCard, PersonCreateInput, PersonIdentity, PersonInFund, PersonPatch } from '@splk/api-contracts';

export abstract class PeopleApi {
  abstract migratePaper(unit: number, person: number, input: PaperMigrationRequest): Observable<PaperMigrationResult>;
  abstract paperFindings(unit: number, person: number, query?: PaperPageQuery): Observable<PaperMigrationFindings>;
  abstract people(query?: PeopleQuery): Observable<Page<PersonInFund>>;
  abstract create(input: PersonCreateInput): Observable<PersonIdentity>;
  abstract update(id: number, input: PersonPatch): Observable<PersonIdentity>;
  abstract card(unitId: number, id: number): Observable<PersonCard>;
  abstract profile(unitId: number, id: number, input: HolderProfileInput): Observable<HolderProfile>;
}

import { Observable } from 'rxjs';
import { HolderProfile, HolderProfileInput, Page, PeopleQuery, PersonCard, PersonCreateInput, PersonIdentity, PersonInFund, PersonPatch } from '@splk/api-contracts';

export abstract class PeopleApi {
  abstract people(query?: PeopleQuery): Observable<Page<PersonInFund>>;
  abstract create(input: PersonCreateInput): Observable<PersonIdentity>;
  abstract update(id: number, input: PersonPatch): Observable<PersonIdentity>;
  abstract card(unitId: number, id: number): Observable<PersonCard>;
  abstract profile(unitId: number, id: number, input: HolderProfileInput): Observable<HolderProfile>;
}

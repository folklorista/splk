import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, throwError } from 'rxjs';
import {
  ListResponse,
  PartType,
  PartTypeInput,
  PartTypePatch,
  Region,
  RegionInput,
  RegionPatch,
  Series,
  SeriesCreateInput,
  SeriesPatch,
} from '@splk/api-contracts';
import { API_BASE_URL } from '../api-config';
import { ApiError } from '../api-error';
import { CatalogApi } from './catalog-api';

@Injectable()
export class HttpCatalogApi extends CatalogApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  regions(unitId: number): Observable<Region[]> {
    return this.list<Region>(unitId, 'regions');
  }

  createRegion(unitId: number, input: RegionInput): Observable<Region> {
    return this.create<Region>(unitId, 'regions', input);
  }

  updateRegion(unitId: number, id: number, patch: RegionPatch): Observable<Region> {
    return this.update<Region>(unitId, 'regions', id, patch);
  }

  partTypes(unitId: number): Observable<PartType[]> {
    return this.list<PartType>(unitId, 'part-types');
  }

  createPartType(unitId: number, input: PartTypeInput): Observable<PartType> {
    return this.create<PartType>(unitId, 'part-types', input);
  }

  updatePartType(unitId: number, id: number, patch: PartTypePatch): Observable<PartType> {
    return this.update<PartType>(unitId, 'part-types', id, patch);
  }

  series(unitId: number): Observable<Series[]> {
    return this.list<Series>(unitId, 'series');
  }

  createSeries(unitId: number, input: SeriesCreateInput): Observable<Series> {
    return this.create<Series>(unitId, 'series', input);
  }

  updateSeries(unitId: number, id: number, patch: SeriesPatch): Observable<Series> {
    return this.update<Series>(unitId, 'series', id, patch);
  }

  private url(unitId: number, resource: string): string {
    return `${this.baseUrl}/funds/${unitId}/${resource}`;
  }

  private list<T>(unitId: number, resource: string): Observable<T[]> {
    return this.http.get<ListResponse<T>>(this.url(unitId, resource)).pipe(
      map((response) => response.items),
      catchError((error: unknown) => throwError(() => ApiError.from(error))),
    );
  }

  private create<T>(unitId: number, resource: string, body: object): Observable<T> {
    return this.http
      .post<T>(this.url(unitId, resource), body)
      .pipe(catchError((error: unknown) => throwError(() => ApiError.from(error))));
  }

  private update<T>(unitId: number, resource: string, id: number, body: object): Observable<T> {
    return this.http
      .patch<T>(`${this.url(unitId, resource)}/${id}`, body)
      .pipe(catchError((error: unknown) => throwError(() => ApiError.from(error))));
  }
}

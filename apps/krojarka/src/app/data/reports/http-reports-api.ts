import { unpackError } from '../http/unpack-error';
import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, from, mergeMap, Observable, throwError } from 'rxjs';
import type { CostumeReport, ReportKind, ReportQuery, SearchQuery, SearchPage } from '@splk/api-contracts';
import { API_BASE_URL } from '../api-config';
import { ApiError } from '../api-error';
import { ReportsApi } from './reports-api';
@Injectable()
export class HttpReportsApi extends ReportsApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);
  report(unit: number, kind: ReportKind, id?: number, query: ReportQuery = {}) { return this.wrap(this.http.get<CostumeReport>(this.url(unit, kind, id), { params: this.params(query) })); }
  csv(unit: number, kind: ReportKind, id?: number, query: ReportQuery = {}) { return this.wrap(this.http.get(this.url(unit, kind, id), { params: this.params(query), headers: { Accept: 'text/csv' }, responseType: 'blob' })); }
  search(query: SearchQuery) { return this.wrap(this.http.get<SearchPage>(`${this.base}/search`, { params: this.params(query) })); }
  private url(unit: number, kind: ReportKind, id?: number) { return `${this.base}/funds/${unit}/reports/${kind}${id === undefined ? '' : '/' + id}`; }
  private params(query: object) { let params = new HttpParams(); for (const [key, value] of Object.entries(query)) if (value !== undefined) params = params.set(key, String(value)); return params; }
  private wrap<T>(request: Observable<T>) { return request.pipe(catchError((error: unknown) => from(unpackError(error)).pipe(mergeMap((decoded) => throwError(() => ApiError.from(decoded)))))); }
}

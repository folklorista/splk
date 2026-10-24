import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, from, mergeMap, Observable, map, throwError } from 'rxjs';
import type { CostumeCost, CostInput, CostPage, CostPatch, CostQuery, CostFund } from '@splk/api-contracts';
import { API_BASE_URL } from '../api-config';
import { ApiError } from '../api-error';
import { unpackError } from '../http/unpack-error';
import { CostsApi } from './costs-api';
@Injectable()
export class HttpCostsApi extends CostsApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);
  funds() { return this.wrap(this.http.get<{ items: CostFund[] }>(`${this.base}/costs/funds`).pipe(map((r) => r.items))); }
  list(query: CostQuery = {}) { return this.wrap(this.http.get<CostPage>(`${this.base}/costs`, { params: this.params(query) })); }
  detail(id: number) { return this.wrap(this.http.get<CostumeCost>(`${this.base}/costs/${id}`)); }
  create(unit: number, input: CostInput) { return this.wrap(this.http.post<CostumeCost>(`${this.base}/funds/${unit}/costs`, input)); }
  update(id: number, input: CostPatch) { return this.wrap(this.http.patch<CostumeCost>(`${this.base}/costs/${id}`, input)); }
  csv(query: CostQuery = {}) { return this.wrap(this.http.get(`${this.base}/costs`, { params: this.params(query), headers: { Accept: 'text/csv' }, responseType: 'blob' })); }
  private params(query: CostQuery) { let params = new HttpParams(); for (const [key, value] of Object.entries(query)) if (value !== undefined) params = params.set(key, String(value)); return params; }
  private wrap<T>(request: Observable<T>) { return request.pipe(catchError((error: unknown) => from(unpackError(error)).pipe(mergeMap((decoded) => throwError(() => ApiError.from(decoded)))))); }
}

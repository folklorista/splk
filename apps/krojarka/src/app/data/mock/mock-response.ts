import { delay, Observable, of, throwError } from 'rxjs';
import { ApiError } from '../api-error';

const LATENCY_MS = 150;

/** A copy of the value after a short delay, so components never hold references into mock state. */
export function mockOk<T>(value: T): Observable<T> {
  return of(structuredClone(value)).pipe(delay(LATENCY_MS));
}

export function mockFail(status: number, code: ApiError['code'], details: Record<string, unknown> = {}): Observable<never> {
  return throwError(() => new ApiError(status, code, details));
}

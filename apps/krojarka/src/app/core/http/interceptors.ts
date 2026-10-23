import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject, Injector } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { API_BASE_URL } from '../../data/api-config';
import { CsrfTokenStore } from '../../data/http/csrf-token.store';
import { AuthService } from '../auth/auth.service';
import { LOGIN_PATH } from '../auth/auth.guards';

/** HTTP interceptors from hosting doc chap. 8, in this order: credentials → auth errors → CSRF. */

const RETRIED = new HttpContextToken<boolean>(() => false);

function isApiRequest(request: HttpRequest<unknown>, baseUrl: string): boolean {
  return request.url === baseUrl || request.url.startsWith(baseUrl + '/');
}

/** Session cookie only to our API, never to other URLs. */
export const apiCredentialsInterceptor: HttpInterceptorFn = (request, next) =>
  next(isApiRequest(request, inject(API_BASE_URL)) ? request.clone({ withCredentials: true }) : request);

/** X-CSRF-Token from memory on every write to the API. */
export const csrfInterceptor: HttpInterceptorFn = (request, next) => {
  const token = inject(CsrfTokenStore).current();
  const write = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
  return next(
    write && token && isApiRequest(request, inject(API_BASE_URL))
      ? request.clone({ setHeaders: { 'X-CSRF-Token': token } })
      : request,
  );
};

const AUTH_PATHS_WITHOUT_REDIRECT = ['/auth/login', '/auth/me', '/auth/password-reset'];

/**
 * 401 → signed out and back to the login (except the auth calls that handle 401 themselves).
 * 403 csrf_token_invalid → refresh the token once via /auth/me and repeat the request.
 */
export const authErrorInterceptor: HttpInterceptorFn = (request, next) => {
  const baseUrl = inject(API_BASE_URL);
  const injector = inject(Injector);
  if (!isApiRequest(request, baseUrl)) {
    return next(request);
  }

  return next(request).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) {
        return throwError(() => error);
      }
      const path = request.url.slice(baseUrl.length);
      const auth = injector.get(AuthService);

      if (error.status === 401 && !AUTH_PATHS_WITHOUT_REDIRECT.some((p) => path.startsWith(p))) {
        auth.markSignedOut();
        const router = injector.get(Router);
        void router.navigate([LOGIN_PATH], { queryParams: { navrat: router.url } });
      }

      if (error.status === 403 && error.error?.error?.code === 'csrf_token_invalid' && !request.context.get(RETRIED)) {
        return from(auth.refresh()).pipe(
          switchMap(() => next(request.clone({ context: request.context.set(RETRIED, true) }))),
        );
      }

      return throwError(() => error);
    }),
  );
};

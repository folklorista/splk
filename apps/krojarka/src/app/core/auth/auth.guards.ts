import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const LOGIN_PATH = '/prihlaseni';

/** Signed-in area; otherwise to the login with the requested URL to come back to. */
// inject() only works before the first await, so both services are taken up front.
export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.init();
  return auth.status() === 'signed-in'
    ? true
    : router.createUrlTree([LOGIN_PATH], { queryParams: { navrat: state.url } });
};

/** Login and forgotten password only when signed out. */
export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.init();
  return auth.status() === 'signed-in' ? router.createUrlTree(['/']) : true;
};

/** Only same-app paths are followed after login (no open redirect). */
export function safeReturnUrl(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/';
}

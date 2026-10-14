import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isLoggedIn()) {
    return true;
  }
  // Po přihlášení se uživatel vrátí tam, kam původně mířil (reload, odkaz z notifikace…)
  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

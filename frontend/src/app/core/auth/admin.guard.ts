import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { isAdmin } from '../utils/visibility.utils';

export const adminGuard: CanActivateFn = (_route, _state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (isAdmin(auth.currentUser())) {
    return true;
  }
  return router.createUrlTree(['/app/dashboard']);
};

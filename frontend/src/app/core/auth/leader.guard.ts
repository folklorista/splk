import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { isLeaderOrAdmin } from '../utils/visibility.utils';

// Stránky pro výbor (např. docházka) – pustí vedoucího i administrátora
export const leaderGuard: CanActivateFn = (_route, _state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (isLeaderOrAdmin(auth.currentUser())) {
    return true;
  }
  return router.createUrlTree(['/app/dashboard']);
};

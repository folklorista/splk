import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { canManageCostumes, canViewCostumeStock } from './costume-permissions';

// Přehled skladu – krojárky, vedoucí, administrátoři; ostatní zpět na „Moje kroje“
export const costumeStockGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return canViewCostumeStock(auth.currentUser()) || inject(Router).createUrlTree(['/app/costumes']);
};

// Zápis do evidence – jen krojárky
export const costumeManagerGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return canManageCostumes(auth.currentUser()) || inject(Router).createUrlTree(['/app/costumes']);
};

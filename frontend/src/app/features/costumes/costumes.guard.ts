import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AccessService } from '../../core/access/access.service';

// Správa krojů (prohlížení) – pověření Správa krojů nebo Náhled do správy krojů; ostatní zpět na „Moje kroje“
export const costumeStockGuard: CanActivateFn = () => {
  const access = inject(AccessService);
  return (access.modules().costumes && access.canViewCostumeStock()) || inject(Router).createUrlTree(['/app/costumes']);
};

// Zápis do krojového fondu – jen pověřené krojařky (Správa krojů)
export const costumeManagerGuard: CanActivateFn = () => {
  const access = inject(AccessService);
  return (access.modules().costumes && access.canManageCostumes()) || inject(Router).createUrlTree(['/app/wardrobe']);
};

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AccessService } from '../../core/access/access.service';

// Krojárna (prohlížení) – pověření Správa krojů nebo Náhled do krojárky; ostatní zpět na „Moje kroje“
export const costumeStockGuard: CanActivateFn = () => {
  const access = inject(AccessService);
  return (access.modules().costumes && access.canViewCostumeStock()) || inject(Router).createUrlTree(['/app/costumes']);
};

// Zápis do krojového fondu – jen pověřené krojárky (Správa krojů)
export const costumeManagerGuard: CanActivateFn = () => {
  const access = inject(AccessService);
  return (access.modules().costumes && access.canManageCostumes()) || inject(Router).createUrlTree(['/app/wardrobe']);
};

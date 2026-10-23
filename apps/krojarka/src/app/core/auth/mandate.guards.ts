import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { FundContext } from '../fund/fund-context';
import { AuthService } from './auth.service';

// Child guards may run while the session is still loading (direct load of a deep URL), so each awaits it first.
// inject() only works before the first await.

/** Organization administration (D-48); the API checks it again. */
export const organizationAdminGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.init();
  return auth.hasMandate('organization.admin') || router.createUrlTree(['/nastaveni']);
};

/** Pages of a costume fund need at least one fund mandate. */
export const fundGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const funds = inject(FundContext);
  const router = inject(Router);
  await auth.init();
  return funds.current() !== null || router.createUrlTree(['/nastaveni']);
};

/** /nastaveni opens the first section the person may use; without any, it shows the no-access page. */
export const settingsHomeGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const funds = inject(FundContext);
  const router = inject(Router);
  await auth.init();
  if (funds.current()) {
    return router.createUrlTree(['/nastaveni/katalog']);
  }
  return auth.hasMandate('organization.admin') ? router.createUrlTree(['/nastaveni/uzivatele']) : true;
};

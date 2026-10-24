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
  await funds.init();
  return funds.current() !== null || router.createUrlTree(['/nastaveni']);
};

/** /nastaveni opens the first section the person may use; without any, it shows the no-access page. */
export const settingsHomeGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const funds = inject(FundContext);
  const router = inject(Router);
  await auth.init();
  await funds.init();
  if (funds.current()) {
    return router.createUrlTree(['/nastaveni/katalog']);
  }
  return auth.hasMandate('organization.admin') ? router.createUrlTree(['/nastaveni/uzivatele']) : true;
};

/** Cost evidence has its own read scope; costs.view never opens the general costume fund. */
export const costsGuard: CanActivateFn = async () => {
  const auth = inject(AuthService), router = inject(Router); await auth.init();
  const canRead = auth.user()?.mandates.some((m) => m.kind === 'costs.view' && m.scopeType === 'organization' || ['costumes.manage', 'costumes.view'].includes(m.kind));
  return canRead || router.createUrlTree(['/nastaveni']);
};
export const reportsHomeGuard: CanActivateFn = async () => {
  const auth = inject(AuthService), funds = inject(FundContext), router = inject(Router); await auth.init(); await funds.init();
  if (funds.current()) return true;
  return auth.user()?.mandates.some((m) => m.kind === 'costs.view' && m.scopeType === 'organization') ? router.createUrlTree(['/prehledy/naklady']) : router.createUrlTree(['/nastaveni']);
};

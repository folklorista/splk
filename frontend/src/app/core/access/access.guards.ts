import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AccessService } from './access.service';
import { EnsembleSettings } from '../models/ensemble-settings.model';

// Guard nad AccessService – bez oprávnění vrátí na Přehled. Jen pohodlí UI, ne bezpečnost.
function accessGuard(allowed: (access: AccessService) => boolean): CanActivateFn {
  return () => {
    const access = inject(AccessService);
    return allowed(access) || inject(Router).createUrlTree(['/app/dashboard']);
  };
}

// Správa (Členové, Skupiny, Konfigurace) – pověření Správa souboru
export const ensembleAdminGuard = accessGuard((a) => a.isEnsembleAdmin());

// Přehled skutečné docházky – pověření Evidence docházky
export const attendanceGuard = accessGuard((a) => a.modules().events && a.canViewAttendanceReport());

// Zakládání akcí – pověření Organizace akcí
export const eventCreateGuard = accessGuard((a) => a.modules().events && a.canCreateEvents());

// Vypnutý modul není v menu a jeho stránky nejsou dostupné
export function moduleGuard(module: keyof EnsembleSettings['modules']): CanActivateFn {
  return accessGuard((a) => a.modules()[module]);
}

// Založení skupiny mimo Správu (režim „zakládají všichni aktivní členové“)
export const groupCreateGuard = accessGuard((a) => a.canCreateGroup());

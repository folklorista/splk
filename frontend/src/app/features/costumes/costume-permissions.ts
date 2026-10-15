import { User } from '../../core/auth/models/user.model';
import { GROUP_IDS } from '../../core/data/mock-groups';

// Krojovou evidenci mění jen pověřené krojárky (členky skupiny Sklad).
// Role administrátora nebo vedoucího samy o sobě právo zápisu nedávají (docs/06, kap. 9).
export function canManageCostumes(user: User | null): boolean {
  return user?.groupIds.includes(GROUP_IDS.sklad) ?? false;
}

// Celý sklad (bez možnosti změn) vidí navíc vedoucí a administrátoři; běžný člen jen své kroje
export function canViewCostumeStock(user: User | null): boolean {
  if (!user) return false;
  return canManageCostumes(user) || user.roles.includes('leader') || user.roles.includes('admin');
}

import { Unavailability } from './unavailability.model';

const day = (iso: string) => iso.slice(0, 10);

// Překrývá se nedostupnost s obdobím akce? Porovnává se po dnech (od–do včetně).
export function overlapsRange(item: Pick<Unavailability, 'from' | 'to'>, startsAt: string, endsAt: string): boolean {
  return item.from <= day(endsAt) && item.to >= day(startsAt);
}

// Nedostupnosti daných členů v termínu akce, seřazené podle začátku
export function unavailableDuring(items: Unavailability[], startsAt: string, endsAt: string, memberIds?: number[]): Unavailability[] {
  return items
    .filter((u) => (!memberIds || memberIds.includes(u.memberId)) && overlapsRange(u, startsAt, endsAt))
    .sort((a, b) => a.from.localeCompare(b.from));
}

// Aktuální a budoucí nedostupnosti (proběhlé se v profilu nezobrazují)
export function upcomingUnavailability(items: Unavailability[], today = new Date().toISOString()): Unavailability[] {
  return items.filter((u) => u.to >= day(today)).sort((a, b) => a.from.localeCompare(b.from));
}

export function formatRange(item: Pick<Unavailability, 'from' | 'to'>): string {
  const fmt = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' });
  return item.from === item.to ? fmt(item.from) : `${fmt(item.from)} – ${fmt(item.to)}`;
}

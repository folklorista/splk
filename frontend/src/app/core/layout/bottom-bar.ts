import { IconName } from '../../shared/icon/icon.component';

// Osobní spodní lišta (docs/10 kap. 6.2): Přehled je pevně první, za ním nejvýš 4 pozice.
// Když uživatel vybere víc míst, zobrazí se první 3 a pátá pozice je „Více“ se zbytkem.
// Lišta se nikdy neposouvá do strany. Nastavení a Profil nejsou místa – jsou vždy v hlavičce.

export type PlaceCategory = 'main' | 'group' | 'hub' | 'costumes' | 'agenda' | 'tool';

export interface Place {
  key: string;
  path: string;
  label: string;
  icon: IconName;
  badge?: number;
  category: PlaceCategory;
  // Agenda se zápisem (Docházka, Správa krojů se Správou krojů) má ve výchozím návrhu přednost
  writes?: boolean;
  // false = místo je dostupné, ale do výchozí lišty ho nenavrhujeme (Moje kroje bez výpůjčky)
  suggest?: boolean;
}

export const BAR_SLOTS = 4;
export const DASHBOARD_KEY = 'dashboard';
export const GROUPS_HUB_KEY = 'groups';
export const MORE_KEY = 'more';

// Automatický výchozí návrh: Akce → skupiny → agendy se zápisem → Moje kroje → ostatní agendy.
// Nevejdou-li se, skupiny se sloučí do „Skupiny“; zbytek případně pod „Více“.
export function defaultBarKeys(places: Place[]): string[] {
  const pick = (filter: (p: Place) => boolean) => places.filter(filter).map((p) => p.key);
  const events = pick((p) => p.category === 'main');
  const groups = pick((p) => p.category === 'group');
  const agendasWrite = pick((p) => p.category === 'agenda' && !!p.writes);
  const costumes = pick((p) => p.category === 'costumes' && p.suggest !== false);
  const agendasRead = pick((p) => p.category === 'agenda' && !p.writes);
  const direct = [...events, ...groups, ...agendasWrite, ...costumes, ...agendasRead];
  if (direct.length <= BAR_SLOTS) return direct;
  const hub = places.some((p) => p.key === GROUPS_HUB_KEY) && groups.length ? [GROUPS_HUB_KEY] : groups;
  return [...events, ...hub, ...agendasWrite, ...costumes, ...agendasRead];
}

export interface ResolvedBar {
  // Pozice za Přehledem (bez „Více“)
  bar: Place[];
  // Vybraná místa, která se nevešla – patří pod „Více“; prázdné = „Více“ v liště není
  overflow: Place[];
}

// Uživatelský výběr (null = automatický návrh). Nedostupná místa (ztráta přístupu) se tiše vynechají.
export function resolveBar(places: Place[], chosen: string[] | null | undefined): ResolvedBar {
  const byKey = new Map(places.map((p) => [p.key, p]));
  const keys = (chosen ?? defaultBarKeys(places)).filter((k, i, all) => k !== DASHBOARD_KEY && byKey.has(k) && all.indexOf(k) === i);
  const selected = keys.map((k) => byKey.get(k)!);
  if (selected.length <= BAR_SLOTS) return { bar: selected, overflow: [] };
  return { bar: selected.slice(0, BAR_SLOTS - 1), overflow: selected.slice(BAR_SLOTS - 1) };
}

export function sumBadges(places: Place[]): number {
  return places.reduce((sum, p) => sum + (p.badge ?? 0), 0);
}

// Pořadí pro sidebar a „Moje místa“: nejdřív v pořadí lišty, pak ostatní v přirozeném pořadí
export function orderPlaces(places: Place[], chosen: string[] | null | undefined): Place[] {
  const keys = chosen ?? defaultBarKeys(places);
  const rank = (p: Place) => {
    const i = keys.indexOf(p.key);
    return i === -1 ? keys.length + places.indexOf(p) : i;
  };
  return [...places].sort((a, b) => rank(a) - rank(b));
}

// Úpravy výběru v Nastavení → Spodní lišta
export function moveKey(keys: string[], key: string, delta: -1 | 1): string[] {
  const i = keys.indexOf(key);
  const j = i + delta;
  if (i === -1 || j < 0 || j >= keys.length) return keys;
  const next = [...keys];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

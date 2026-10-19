import { Place, moveKey } from './bottom-bar';

// Desktopový sidebar (docs/10 kap. 6.4): pevné sekce podle kategorie místa. Uživatel smí jen řadit
// a skrývat položky uvnitř sekcí Moje skupiny a Agendy – nezávisle na spodní liště.

export type SidebarSectionKey = 'main' | 'groups' | 'agendas' | 'ensemble';

export interface SidebarMenuConfig {
  // Klíče míst v uživatelském pořadí (stačí relativní pořadí uvnitř sekce)
  order: string[];
  // Klíče míst schovaných pod „Další“ v jejich sekci
  hidden: string[];
}

export interface SidebarSection {
  key: SidebarSectionKey;
  label?: string;
  items: Place[];
  hidden: Place[];
}

export const CONFIGURABLE_SECTIONS: SidebarSectionKey[] = ['groups', 'agendas'];

export const SIDEBAR_SECTION_LABELS: Record<SidebarSectionKey, string | undefined> = {
  main: undefined,
  groups: 'Moje skupiny',
  agendas: 'Agendy',
  ensemble: 'Soubor',
};

export function sidebarSectionOf(place: Place): SidebarSectionKey {
  switch (place.category) {
    case 'main':
      return 'main';
    case 'group':
      return 'groups';
    case 'costumes':
    case 'agenda':
      return 'agendas';
    default:
      return 'ensemble';
  }
}

// Nejdřív místa v uloženém pořadí, pak nová (neuložená) v přirozeném pořadí
export function orderByKeys(places: Place[], order: string[]): Place[] {
  const rank = (p: Place) => {
    const i = order.indexOf(p.key);
    return i === -1 ? order.length + places.indexOf(p) : i;
  };
  return [...places].sort((a, b) => rank(a) - rank(b));
}

// Uložené klíče, které už nejsou dostupné (ztráta členství, pověření, vypnutý modul), se tiše ignorují.
// Skrývat a řadit lze jen v konfigurovatelných sekcích – jinde se konfigurace neuplatní.
export function resolveSidebar(places: Place[], config: SidebarMenuConfig | null | undefined): SidebarSection[] {
  const order = config?.order ?? [];
  const hidden = new Set(config?.hidden ?? []);
  const sections: SidebarSection[] = [];
  for (const key of ['main', 'groups', 'agendas', 'ensemble'] as SidebarSectionKey[]) {
    const inSection = places.filter((p) => sidebarSectionOf(p) === key);
    const configurable = CONFIGURABLE_SECTIONS.includes(key);
    const ordered = configurable ? orderByKeys(inSection, order) : inSection;
    const isHidden = (p: Place) => configurable && hidden.has(p.key);
    sections.push({ key, label: SIDEBAR_SECTION_LABELS[key], items: ordered.filter((p) => !isHidden(p)), hidden: ordered.filter(isHidden) });
  }
  return sections;
}

// Všechna místa sekce v uživatelském pořadí (včetně skrytých) – pro Nastavení → Boční menu
export function sectionPlaces(places: Place[], config: SidebarMenuConfig | null | undefined, section: SidebarSectionKey): Place[] {
  return orderByKeys(places.filter((p) => sidebarSectionOf(p) === section), config?.order ?? []);
}

// Uložené klíče míst, která teď nejsou dostupná, se ponechají – po návratu přístupu platí původní nastavení
function staleKeys(places: Place[], keys: string[]): string[] {
  const available = new Set(places.map((p) => p.key));
  return keys.filter((k) => !available.has(k));
}

// Posun jen uvnitř vlastní sekce – mezi sekcemi položky přesouvat nelze
export function moveInSidebar(places: Place[], config: SidebarMenuConfig | null | undefined, key: string, delta: -1 | 1): SidebarMenuConfig {
  const place = places.find((p) => p.key === key);
  const order = CONFIGURABLE_SECTIONS.flatMap((section) => {
    const keys = sectionPlaces(places, config, section).map((p) => p.key);
    return place && sidebarSectionOf(place) === section ? moveKey(keys, key, delta) : keys;
  });
  return { order: [...order, ...staleKeys(places, config?.order ?? [])], hidden: config?.hidden ?? [] };
}

export function toggleHiddenInSidebar(places: Place[], config: SidebarMenuConfig | null | undefined, key: string): SidebarMenuConfig {
  const place = places.find((p) => p.key === key);
  const hidden = config?.hidden ?? [];
  const order = config?.order ?? [];
  if (!place || !CONFIGURABLE_SECTIONS.includes(sidebarSectionOf(place))) return { order, hidden };
  return { order, hidden: hidden.includes(key) ? hidden.filter((k) => k !== key) : [...hidden, key] };
}

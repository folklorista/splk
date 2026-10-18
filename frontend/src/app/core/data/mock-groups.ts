import { Group } from '../models/group.model';

// Chat mají všechny skupiny dospělé Vonice (docs/08 kap. 8.1); dětský soubor ho má vypnutý.
// Výchozí záložka podle povahy skupiny – Muzika a Kluci se domlouvají v chatu, Výbor a Krojařky žijí z nástěnky.
export const MOCK_GROUPS: Group[] = [
  { id: 1, ensembleId: 1, name: 'Výbor', slug: 'vybor', icon: 'crown', description: 'Vedení souboru.', visibility: 'private', defaultTab: 'board' },
  { id: 2, ensembleId: 1, name: 'Taneční', slug: 'tanecni', icon: 'footprints', description: 'Taneční složka – všichni, kdo tančí.', visibility: 'private', defaultTab: 'board' },
  { id: 3, ensembleId: 1, name: 'Muzika', slug: 'muzika', icon: 'music-note', description: 'Cimbálová muzika.', visibility: 'private', defaultTab: 'chat' },
  { id: 4, ensembleId: 1, name: 'Kluci', slug: 'kluci', icon: 'shield', visibility: 'private', defaultTab: 'chat' },
  { id: 5, ensembleId: 1, name: 'Holky', slug: 'holky', icon: 'heart', visibility: 'private', defaultTab: 'chat' },
  { id: 6, ensembleId: 1, name: 'Malá Vonica', slug: 'mala-vonica', icon: 'person-child', description: 'Vedoucí dětského souboru.', visibility: 'private', chatEnabled: false },
  { id: 7, ensembleId: 1, name: 'Krojařky', slug: 'krojarky', icon: 'shirt', description: 'Krojařky a péče o krojový sklad.', visibility: 'private', defaultTab: 'board' },
];

export const GROUP_IDS = {
  vybor: 1,
  tanecni: 2,
  muzika: 3,
  kluci: 4,
  holky: 5,
  malaVonica: 6,
  sklad: 7,
} as const;

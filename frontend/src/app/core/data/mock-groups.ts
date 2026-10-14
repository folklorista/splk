import { Group } from '../models/group.model';

export const MOCK_GROUPS: Group[] = [
  { id: 1, ensembleId: 1, name: 'Výbor', slug: 'vybor', icon: 'crown' },
  { id: 2, ensembleId: 1, name: 'Taneční', slug: 'tanecni', icon: 'footprints' },
  { id: 3, ensembleId: 1, name: 'Muzika', slug: 'muzika', icon: 'music-note' },
  { id: 4, ensembleId: 1, name: 'Kluci', slug: 'kluci', icon: 'shield' },
  { id: 5, ensembleId: 1, name: 'Holky', slug: 'holky', icon: 'heart' },
  { id: 6, ensembleId: 1, name: 'Malá Vonica', slug: 'mala-vonica', icon: 'person-child' },
  { id: 7, ensembleId: 1, name: 'Sklad', slug: 'sklad', icon: 'shirt' },
];

// Členové výboru mají roli vedoucího (leader)
export const LEADERSHIP_GROUP_ID = 1;

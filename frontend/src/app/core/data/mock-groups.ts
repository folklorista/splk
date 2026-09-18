import { Group } from '../models/group.model';

export const MOCK_GROUPS: Group[] = [
  { id: 1, ensembleId: 1, name: 'Dospělí', slug: 'dospeli', icon: 'person-adult' },
  { id: 2, ensembleId: 1, name: 'Tanečníci', slug: 'tanecnici', icon: 'footprints' },
  { id: 3, ensembleId: 1, name: 'Vedení', slug: 'vedeni', icon: 'crown' },
  { id: 4, ensembleId: 1, name: 'Hudebníci', slug: 'hudebniky', icon: 'music-note' },
];

import { CostumeCategory, CostumeItem } from '../models/costume.model';

export const MOCK_COSTUME_CATEGORIES: CostumeCategory[] = [
  {
    id: 1,
    ensembleId: 1,
    name: 'Ženský kroj',
    allowedGroupIds: [],
  },
  {
    id: 2,
    ensembleId: 1,
    name: 'Mužský kroj',
    allowedGroupIds: [],
  },
  {
    id: 3,
    ensembleId: 1,
    name: 'Doplňky',
    allowedGroupIds: [],
  },
];

export const MOCK_COSTUME_ITEMS: CostumeItem[] = [
  {
    id: 1,
    ensembleId: 1,
    categoryId: 1,
    name: 'Sukně – slovácká modrá',
    size: 'M',
    condition: 'good',
    assignedMemberId: 1,
  },
  {
    id: 2,
    ensembleId: 1,
    categoryId: 1,
    name: 'Blůza – bílá vyšívaná',
    size: 'S',
    condition: 'good',
    assignedMemberId: 3,
  },
  {
    id: 3,
    ensembleId: 1,
    categoryId: 1,
    name: 'Sukně – slovácká modrá',
    size: 'L',
    condition: 'needs-repair',
    notes: 'Rozparek u zapínání',
  },
  {
    id: 4,
    ensembleId: 1,
    categoryId: 2,
    name: 'Kalhoty – bílé',
    size: 'L',
    condition: 'good',
    assignedMemberId: 2,
  },
  {
    id: 5,
    ensembleId: 1,
    categoryId: 2,
    name: 'Vesta – červená',
    size: 'M',
    condition: 'good',
    assignedMemberId: 4,
  },
  {
    id: 6,
    ensembleId: 1,
    categoryId: 2,
    name: 'Košile – bílá lidová',
    size: 'XL',
    condition: 'damaged',
    notes: 'Odtržený rukáv, nutná oprava před výjezdem',
  },
  {
    id: 7,
    ensembleId: 1,
    categoryId: 3,
    name: 'Čepec – zdobený',
    condition: 'good',
  },
  {
    id: 8,
    ensembleId: 1,
    categoryId: 3,
    name: 'Opasek – kožený hnědý',
    condition: 'good',
    assignedMemberId: 2,
  },
];

// Pověření = oprávnění přidělené osobě ve stanoveném rozsahu (docs/08 kap. 3).
// Souborová funkce (Member.functionTitle) ani členství ve skupině samy nic neopravňují.
export type MandateKind =
  // Správa souboru – osoby, skupiny, pověření, konfigurace; NEdává čtení soukromého obsahu
  | 'ensemble-admin'
  // Hlavní správce / spolusprávce konkrétní skupiny (groupId)
  | 'group-owner'
  | 'group-deputy'
  // Organizace akcí – celý soubor, akce organizované skupinou (groupId) nebo jedna akce (eventId)
  | 'events'
  // Evidence skutečné docházky – celý soubor, akce skupiny (groupId) nebo jedna akce (eventId)
  | 'attendance'
  // Správa krojů (krojařka) a jen náhled do ní
  | 'costumes'
  | 'costumes-view';

export interface Mandate {
  id: number;
  memberId: number;
  kind: MandateKind;
  groupId?: number;
  eventId?: number;
  grantedAt: string;
  grantedById?: number;
  // Přechodné pověření (např. správce souboru dočasně spravuje novou skupinu) – v UI viditelně označené
  temporary?: boolean;
}

export const MANDATE_LABELS: Record<MandateKind, string> = {
  'ensemble-admin': 'Správa souboru',
  'group-owner': 'Hlavní správce skupiny',
  'group-deputy': 'Spolusprávce skupiny',
  events: 'Organizace akcí',
  attendance: 'Evidence docházky',
  costumes: 'Správa krojů',
  'costumes-view': 'Náhled do správy krojů',
};

// Pověření s volitelným rozsahem (soubor / skupina / akce); ostatní mají pevný rozsah
export const SCOPED_MANDATE_KINDS: MandateKind[] = ['events', 'attendance'];
export const GROUP_MANDATE_KINDS: MandateKind[] = ['group-owner', 'group-deputy'];

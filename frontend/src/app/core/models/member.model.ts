// Osoba evidovaná v systému. Aktivní člen se může přihlásit; bývalý člen (isActive = false)
// v evidenci zůstává kvůli historii (docházka, zápůjčky). Externista (isExternal) není členem
// souboru – vidí jen akce, na které je výslovně pozván, a skupiny, kam byl přijat.
export interface MembershipInterval {
  from: string;
  // Chybí = členství trvá
  to?: string;
}

export interface Member {
  id: number;
  ensembleId: number;
  userId: number;
  firstName: string;
  lastName: string;
  // Veřejně zobrazované jméno; člen si ho může změnit sám, jméno a příjmení jen Správa souboru
  nickname: string;
  email?: string;
  phone?: string;
  groupIds: number[];
  // Intervaly členství ve skupinách (groupId → období); chybí = člen od počátku. Rozhodují
  // o viditelnosti chatu z období „od vstupu“ (docs/08 kap. 10.3).
  groupIntervals?: Record<number, MembershipInterval[]>;
  // Souborová funkce (kronikářka, ekonomka…) – jen informativní, sama nic neopravňuje
  functionTitle?: string;
  isExternal?: boolean;
  isActive: boolean;
  createdAt: string;
}

// Osoba evidovaná v systému. Aktivní člen se může přihlásit; bývalý člen (isActive = false)
// v evidenci zůstává kvůli historii (docházka, zápůjčky). Externista (isExternal) není členem
// souboru – vidí jen akce, na které je výslovně pozván, a skupiny, kam byl přijat.
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
  // Kdy člen vstoupil do skupiny (groupId → ISO čas); chybí = od počátku. Chat skupiny vidí od vstupu.
  groupJoinedAt?: Record<number, string>;
  // Souborová funkce (kronikářka, ekonomka…) – jen informativní, sama nic neopravňuje
  functionTitle?: string;
  isExternal?: boolean;
  isActive: boolean;
  createdAt: string;
}

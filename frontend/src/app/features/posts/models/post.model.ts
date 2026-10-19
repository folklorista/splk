export interface Post {
  id: number;
  ensembleId: number;
  title: string;
  body: string;
  authorId: number;
  // Nástěnka = skupina, na které příspěvek visí
  groupId: number;
  publishedAt: string;
  updatedAt: string;
  isPinned: boolean;
  requiresAction?: boolean;
  // Členové zmínění v textu příspěvku (@[member:ID]) – upozornění a zvýraznění
  mentionedMemberIds?: number[];
  readers?: number[];
  // Kdy člen příspěvek naposledy viděl (memberId → ISO čas) – podle toho se počítají nové komentáře
  lastVisitedAt?: Record<number, string>;
  archivedAt?: string;
  // Skrytí moderátorem (správce skupiny) – vidí ho jen autor a správci skupiny, chat ho nezobrazuje
  hiddenAt?: string;
  hiddenById?: number;
}

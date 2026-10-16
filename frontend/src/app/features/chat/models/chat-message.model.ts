// Běžná zpráva skupinového chatu. Komentáře příspěvků sem nepatří – v chatu se jen zobrazuje
// jejich aktivita, originál zůstává pod příspěvkem (docs/08 kap. 8.3).
export interface ChatMessage {
  id: number;
  groupId: number;
  authorId: number;
  // Text se zmínkami jako tokeny @[member:ID] (stejně jako komentáře)
  body: string;
  mentionedMemberIds: number[];
  createdAt: string;
  editedAt?: string;
  // Smazání autorem nebo moderátorem – zpráva zmizí, v chatu zůstane neutrální stopa
  deletedAt?: string;
  deletedById?: number;
}

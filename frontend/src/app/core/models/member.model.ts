export interface Member {
  id: number;
  ensembleId: number;
  userId: number;
  firstName: string;
  lastName: string;
  // Veřejně zobrazované jméno; člen si ho může změnit sám, jméno a příjmení jen administrátor
  nickname: string;
  email?: string;
  phone?: string;
  groupIds: number[];
  isAdmin: boolean;
  isActive: boolean;
  createdAt: string;
}

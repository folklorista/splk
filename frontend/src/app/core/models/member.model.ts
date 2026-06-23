export interface Member {
  id: number;
  ensembleId: number;
  userId: number;
  name: string;
  email: string;
  phone?: string;
  groupIds: number[];
  isActive: boolean;
}

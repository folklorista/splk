export type CostumeCondition = 'good' | 'needs-repair' | 'damaged' | 'retired';

export interface CostumeCategory {
  id: number;
  ensembleId: number;
  name: string;
  allowedGroupIds: number[];
}

export interface CostumeItem {
  id: number;
  ensembleId: number;
  categoryId: number;
  name: string;
  size?: string;
  condition: CostumeCondition;
  assignedMemberId?: number;
  notes?: string;
}

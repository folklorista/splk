export interface EventCategory {
  id: number;
  ensembleId: number;
  name: string;
  slug: string;
  color?: string;
  defaultLocation?: string;
  defaultTime?: string;
  targetGroupIds?: number[];
  requiresConfirmation: boolean;
}

export interface Post {
  id: number;
  ensembleId: number;
  title: string;
  body: string;
  authorId: number;
  targetGroupIds: number[];
  publishedAt: string;
  updatedAt: string;
  isPinned: boolean;
  requiresAction?: boolean;
  readers?: number[];
}

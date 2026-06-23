export interface Post {
  id: number;
  ensembleId: number;
  title: string;
  body: string;
  authorId: number;
  targetGroupIds: number[];
  publishedAt: string;
  isPinned: boolean;
}

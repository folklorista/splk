export interface PostComment {
  id: number;
  postId: number;
  authorId: number;
  body: string;
  createdAt: string;
  mentionedMemberIds: number[];
  seenByMemberIds: number[];
}

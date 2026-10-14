import { Post } from '../models/post.model';
import { PostComment } from '../models/comment.model';

// Nástěnka: připnuté nahoře, jinak od nejnovějších
export function sortBoardPosts(posts: Post[]): Post[] {
  return [...posts].sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || b.publishedAt.localeCompare(a.publishedAt));
}

// Archiv od nejnovějších (podle data archivace, pak publikace)
export function sortArchivedPosts(posts: Post[]): Post[] {
  return [...posts].sort((a, b) => (b.archivedAt ?? '').localeCompare(a.archivedAt ?? '') || b.publishedAt.localeCompare(a.publishedAt));
}

// Příspěvek, v jehož komentářích byl člen zmíněn a zmínku ještě neviděl
export function hasUnseenMention(post: Post, comments: PostComment[], memberId: number | null): boolean {
  if (!memberId) return false;
  return comments.some(
    (c) => c.postId === post.id && c.mentionedMemberIds.includes(memberId) && !c.seenByMemberIds.includes(memberId),
  );
}

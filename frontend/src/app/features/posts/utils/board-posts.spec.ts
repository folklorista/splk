import { hasUnseenMention, sortArchivedPosts, sortBoardPosts } from './board-posts';
import { Post } from '../models/post.model';
import { PostComment } from '../models/comment.model';

describe('board-posts', () => {
  const post = (id: number, publishedAt: string, isPinned = false, archivedAt?: string): Post => ({
    id, ensembleId: 1, title: `P${id}`, body: '', authorId: 1, groupId: 1, publishedAt, updatedAt: publishedAt, isPinned, archivedAt,
  });

  it('řadí připnuté nahoru, pak od nejnovějších', () => {
    const posts = [post(1, '2026-01-01'), post(2, '2026-03-01'), post(3, '2025-12-01', true), post(4, '2026-02-01', true)];
    expect(sortBoardPosts(posts).map((p) => p.id)).toEqual([4, 3, 2, 1]);
  });

  it('archiv řadí od nejnověji archivovaných', () => {
    const posts = [post(1, '2026-01-01', false, '2026-04-01'), post(2, '2026-02-01', false, '2026-05-01')];
    expect(sortArchivedPosts(posts).map((p) => p.id)).toEqual([2, 1]);
  });

  it('pozná neviděnou zmínku člena v komentářích příspěvku', () => {
    const comment = (postId: number, mentioned: number[], seen: number[]): PostComment => ({
      id: 1, postId, authorId: 2, body: '', createdAt: '', mentionedMemberIds: mentioned, seenByMemberIds: seen,
    });
    const p = post(1, '2026-01-01');
    expect(hasUnseenMention(p, [comment(1, [5], [])], 5)).toBeTrue();
    expect(hasUnseenMention(p, [comment(1, [5], [5])], 5)).toBeFalse();
    expect(hasUnseenMention(p, [comment(2, [5], [])], 5)).toBeFalse();
    expect(hasUnseenMention(p, [comment(1, [6], [])], 5)).toBeFalse();
    expect(hasUnseenMention(p, [comment(1, [5], [])], null)).toBeFalse();
  });
});

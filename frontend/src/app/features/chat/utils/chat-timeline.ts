import { ChatMessage } from '../models/chat-message.model';
import { Post } from '../../posts/models/post.model';
import { PostComment } from '../../posts/models/comment.model';
import { AuditEntry } from '../../audit/audit.model';
import { isChatSystemEvent } from '../../audit/audit-text';

// Jedna časová osa skupiny (docs/08 kap. 8): běžné zprávy, aktivita nástěnky a neutrální systémové
// události. Komentář má jeden originál pod příspěvkem – tady se jen odkazuje (žádná kopie).
export type TimelineItem =
  | { kind: 'message'; at: string; message: ChatMessage }
  | { kind: 'system'; at: string; entry: AuditEntry }
  | { kind: 'post'; at: string; post: Post }
  | { kind: 'comment'; at: string; post: Post; comment: PostComment; isNew: boolean }
  | { kind: 'comment-group'; at: string; post: Post; comments: PostComment[]; newCount: number };

export interface ChatGrouping {
  // Od kolika komentářů jednoho příspěvku vznikne souhrnná karta
  minComments: number;
  // Maximální pauza mezi komentáři, aby patřily do stejné aktivity
  windowMinutes: number;
}

export interface TimelineInput {
  groupId: number;
  viewerId: number;
  messages: ChatMessage[];
  posts: Post[];
  comments: PostComment[];
  audit: AuditEntry[];
  grouping: ChatGrouping;
  // Viditelnost podle režimu historie chatu a intervalů členství (chat-history.ts); chybí = vše
  isVisible?: (at: string) => boolean;
}

const time = (iso: string) => Date.parse(iso);

// Komentáře jednoho příspěvku rozdělené na úseky souvislé aktivity (mezi sousedy nejvýš windowMinutes)
export function clusterComments(comments: PostComment[], windowMinutes: number): PostComment[][] {
  const sorted = [...comments].sort((a, b) => time(a.createdAt) - time(b.createdAt));
  const clusters: PostComment[][] = [];
  for (const comment of sorted) {
    const current = clusters[clusters.length - 1];
    const last = current?.[current.length - 1];
    if (last && time(comment.createdAt) - time(last.createdAt) <= windowMinutes * 60_000) current.push(comment);
    else clusters.push([comment]);
  }
  return clusters;
}

// Nový komentář = cizí a novější než poslední návštěva příspěvku tímto členem (stav per uživatel)
export function isNewComment(comment: PostComment, post: Post, viewerId: number): boolean {
  if (comment.authorId === viewerId) return false;
  const visited = post.lastVisitedAt?.[viewerId];
  return !visited || time(comment.createdAt) > time(visited);
}

// Do chatu se promítají jen příspěvky, které jsou vidět všem členům (ne skryté ani archivované)
export function isPostInChat(post: Post, groupId: number): boolean {
  return post.groupId === groupId && !post.hiddenAt && !post.archivedAt;
}

export function buildGroupTimeline(input: TimelineInput): TimelineItem[] {
  const { groupId, viewerId, grouping } = input;
  const visible = input.isVisible ?? (() => true);
  const items: TimelineItem[] = [];

  for (const message of input.messages) {
    if (message.groupId === groupId && visible(message.createdAt)) items.push({ kind: 'message', at: message.createdAt, message });
  }

  for (const entry of input.audit) {
    if (isChatSystemEvent(entry, groupId) && visible(entry.at)) items.push({ kind: 'system', at: entry.at, entry });
  }

  const posts = input.posts.filter((p) => isPostInChat(p, groupId));
  for (const post of posts) {
    if (visible(post.publishedAt)) items.push({ kind: 'post', at: post.publishedAt, post });

    const comments = input.comments.filter((c) => c.postId === post.id && visible(c.createdAt));
    for (const cluster of clusterComments(comments, grouping.windowMinutes)) {
      const last = cluster[cluster.length - 1];
      if (cluster.length >= grouping.minComments) {
        const newCount = cluster.filter((c) => isNewComment(c, post, viewerId)).length;
        items.push({ kind: 'comment-group', at: last.createdAt, post, comments: cluster, newCount });
      } else {
        for (const comment of cluster) {
          items.push({ kind: 'comment', at: comment.createdAt, post, comment, isNew: isNewComment(comment, post, viewerId) });
        }
      }
    }
  }

  return items.sort((a, b) => time(a.at) - time(b.at));
}

// Nepřečtené v chatu = cizí běžné zprávy po posledním zobrazení chatu. Aktivita příspěvků se počítá
// na nástěnce (nepřečtený příspěvek, nové komentáře), aby se nic nezapočítalo dvakrát (docs/08 kap. 9.1).
export function unreadChatCount(messages: ChatMessage[], groupId: number, viewerId: number, lastReadAt?: string, isVisible?: (at: string) => boolean): number {
  const after = lastReadAt ? time(lastReadAt) : -Infinity;
  return messages.filter((m) => m.groupId === groupId && !m.deletedAt && m.authorId !== viewerId && time(m.createdAt) > after && (!isVisible || isVisible(m.createdAt))).length;
}

import { chatVisibility } from '../chat/utils/chat-history';
import { AccessSubject, canModerateGroup, canReadGroupContent, canSeeEvent } from '../../core/access/access.utils';
import { Group } from '../../core/models/group.model';
import { Member } from '../../core/models/member.model';
import { nicknameKey } from '../../core/utils/member.utils';
import { ChatMessage } from '../chat/models/chat-message.model';
import { AppEvent } from '../events/models/event.model';
import { PostComment } from '../posts/models/comment.model';
import { Post } from '../posts/models/post.model';
import { plainText } from '../posts/utils/mentions';

export type SearchHitKind = 'post' | 'comment' | 'message' | 'event';

export interface SearchHit {
  kind: SearchHitKind;
  id: number;
  at: string;
  groupId?: number;
  title: string;
  snippet: string;
  // Kam vede odkaz (routerLink + případně fragment / záložka)
  link: string[];
  fragment?: string;
  queryParams?: Record<string, string>;
}

export interface SearchInput {
  query: string;
  subject: AccessSubject;
  viewer: Pick<Member, 'groupIntervals' | 'groupIds'>;
  groups: Group[];
  posts: Post[];
  comments: PostComment[];
  messages: ChatMessage[];
  events: AppEvent[];
  memberName: (id: number) => string;
  groupId?: number;
  from?: string;
  to?: string;
}

const MIN_QUERY = 2;
const SNIPPET = 120;

function snippet(text: string, normalizedQuery: string): string {
  const index = nicknameKey(text).indexOf(normalizedQuery);
  const start = Math.max(0, index - 40);
  const cut = text.slice(start, start + SNIPPET);
  return `${start > 0 ? '…' : ''}${cut}${start + SNIPPET < text.length ? '…' : ''}`;
}

// Vyhledávání jen v obsahu, který smí uživatel číst (docs/08 kap. 10.3, 13.3): skupiny podle přístupu,
// skryté příspěvky jen autor a moderátoři, chat až od vstupu do skupiny, smazané zprávy ne, akce podle cílení.
export function searchContent(input: SearchInput): SearchHit[] {
  const q = nicknameKey(input.query);
  if (q.length < MIN_QUERY) return [];
  const matches = (...texts: (string | undefined)[]) => texts.some((t) => t && nicknameKey(t).includes(q));
  const inPeriod = (iso: string) => (!input.from || iso.slice(0, 10) >= input.from) && (!input.to || iso.slice(0, 10) <= input.to);
  const inGroup = (groupId: number) => input.groupId === undefined || input.groupId === groupId;
  const plain = (body: string) => plainText(body, input.memberName, (id) => input.events.find((e) => e.id === id && canSeeEvent(input.subject, e))?.title);

  const readable = new Map(input.groups.filter((g) => canReadGroupContent(input.subject, g)).map((g) => [g.id, g]));
  const postVisible = (post: Post) => {
    const group = readable.get(post.groupId);
    if (!group) return false;
    return !post.hiddenAt || post.authorId === input.subject.memberId || canModerateGroup(input.subject, group);
  };
  const visiblePosts = new Map(input.posts.filter(postVisible).map((p) => [p.id, p]));
  const hits: SearchHit[] = [];

  for (const post of visiblePosts.values()) {
    if (inGroup(post.groupId) && inPeriod(post.publishedAt) && matches(post.title, post.body)) {
      hits.push({ kind: 'post', id: post.id, at: post.publishedAt, groupId: post.groupId, title: post.title, snippet: snippet(post.body, q), link: ['/app/posts', String(post.id)] });
    }
  }

  for (const comment of input.comments) {
    const post = visiblePosts.get(comment.postId);
    if (!post || !inGroup(post.groupId) || !inPeriod(comment.createdAt)) continue;
    const text = plain(comment.body);
    if (matches(text)) {
      hits.push({ kind: 'comment', id: comment.id, at: comment.createdAt, groupId: post.groupId, title: `Komentář v „${post.title}“`, snippet: snippet(text, q), link: ['/app/posts', String(post.id)], fragment: `comment-${comment.id}` });
    }
  }

  for (const message of input.messages) {
    if (message.deletedAt || !readable.has(message.groupId) || !inGroup(message.groupId) || !inPeriod(message.createdAt)) continue;
    if (!chatVisibility(readable.get(message.groupId)!, input.viewer)(message.createdAt)) continue;
    const text = plain(message.body);
    if (matches(text)) {
      const group = readable.get(message.groupId)!;
      hits.push({ kind: 'message', id: message.id, at: message.createdAt, groupId: message.groupId, title: `${input.memberName(message.authorId)} v chatu ${group.name}`, snippet: snippet(text, q), link: ['/app/boards', group.slug], queryParams: { tab: 'chat' } });
    }
  }

  for (const event of input.events) {
    if (!canSeeEvent(input.subject, event) || !inPeriod(event.startsAt)) continue;
    if (input.groupId !== undefined && !event.targetGroupIds.includes(input.groupId) && !event.organizerGroupIds?.includes(input.groupId)) continue;
    if (matches(event.title, event.description, event.location)) {
      hits.push({ kind: 'event', id: event.id, at: event.startsAt, title: event.title, snippet: snippet(event.description || event.location, q), link: ['/app/events', String(event.id)] });
    }
  }

  return hits.sort((a, b) => b.at.localeCompare(a.at));
}

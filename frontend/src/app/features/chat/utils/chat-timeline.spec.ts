import { buildGroupTimeline, clusterComments, unreadChatCount, TimelineInput } from './chat-timeline';
import { Post } from '../../posts/models/post.model';
import { PostComment } from '../../posts/models/comment.model';
import { ChatMessage } from '../models/chat-message.model';
import { AuditEntry } from '../../audit/audit.model';

describe('chat-timeline', () => {
  const GROUP = 5;
  const VIEWER = 1;
  const at = (minute: number) => new Date(Date.UTC(2026, 9, 16, 18, minute)).toISOString();

  const post: Post = {
    id: 10, ensembleId: 1, title: 'Kroje na příští vystoupení', body: '', authorId: 2, groupId: GROUP,
    publishedAt: at(0), updatedAt: at(0), isPinned: false,
  };
  const comment = (id: number, minute: number, authorId = 2, postId = 10): PostComment => ({
    id, postId, authorId, body: `k${id}`, createdAt: at(minute), mentionedMemberIds: [], seenByMemberIds: [],
  });
  const message = (id: number, minute: number, authorId = 2, groupId = GROUP): ChatMessage => ({
    id, groupId, authorId, body: `m${id}`, mentionedMemberIds: [], createdAt: at(minute),
  });

  const input = (overrides: Partial<TimelineInput> = {}): TimelineInput => ({
    groupId: GROUP,
    viewerId: VIEWER,
    messages: [],
    posts: [post],
    comments: [],
    audit: [],
    grouping: { minComments: 3, windowMinutes: 10 },
    ...overrides,
  });

  it('skládá zprávy, příspěvek a komentáře chronologicky; cizí skupinu vynechá', () => {
    const items = buildGroupTimeline(input({
      messages: [message(1, 5), message(2, 1, 2, 99)],
      comments: [comment(1, 30)],
    }));
    expect(items.map((i) => i.kind)).toEqual(['post', 'message', 'comment']);
  });

  it('víc komentářů pod jedním příspěvkem v rychlém sledu dá jednu souhrnnou kartu', () => {
    const comments = [comment(1, 10), comment(2, 12), comment(3, 15), comment(4, 24)];
    const items = buildGroupTimeline(input({ comments, posts: [{ ...post, publishedAt: at(0) }] }));
    const groups = items.filter((i) => i.kind === 'comment-group');
    expect(groups.length).toBe(1);
    expect(items.filter((i) => i.kind === 'comment').length).toBe(0);
    const group = groups[0] as Extract<typeof items[number], { kind: 'comment-group' }>;
    expect(group.comments.map((c) => c.id)).toEqual([1, 2, 3, 4]);
    expect(group.at).toBe(at(24));
  });

  it('pod prahem zůstanou samostatné karty; vzdálené komentáře tvoří novou aktivitu', () => {
    const comments = [comment(1, 10), comment(2, 12), comment(3, 50)];
    const items = buildGroupTimeline(input({ comments }));
    expect(items.filter((i) => i.kind === 'comment').length).toBe(3);
  });

  it('seskupují se jen komentáře téhož příspěvku', () => {
    const other: Post = { ...post, id: 11, title: 'Jiný' };
    const comments = [comment(1, 10), comment(2, 11, 2, 11), comment(3, 12), comment(4, 13, 2, 11)];
    const items = buildGroupTimeline(input({ posts: [post, other], comments }));
    expect(items.filter((i) => i.kind === 'comment-group').length).toBe(0);
    expect(items.filter((i) => i.kind === 'comment').length).toBe(4);
  });

  it('počet nových komentářů je podle návštěvy konkrétního člena, bez jeho vlastních', () => {
    const visited: Post = { ...post, lastVisitedAt: { [VIEWER]: at(11) } };
    const comments = [comment(1, 10), comment(2, 12), comment(3, 13, VIEWER), comment(4, 14)];
    const group = buildGroupTimeline(input({ posts: [visited], comments })).find((i) => i.kind === 'comment-group') as { newCount: number };
    expect(group.newCount).toBe(2);
  });

  it('skrytý ani archivovaný příspěvek se do chatu nepromítne (ani jeho komentáře)', () => {
    const comments = [comment(1, 10)];
    expect(buildGroupTimeline(input({ posts: [{ ...post, hiddenAt: at(1) }], comments }))).toEqual([]);
    expect(buildGroupTimeline(input({ posts: [{ ...post, archivedAt: at(1) }], comments }))).toEqual([]);
  });

  it('nový člen vidí chat jen od svého vstupu', () => {
    const items = buildGroupTimeline(input({
      messages: [message(1, 5), message(2, 40)],
      comments: [comment(1, 10), comment(2, 45)],
      visibleFrom: at(30),
    }));
    expect(items.map((i) => (i.kind === 'message' ? `m${i.message.id}` : i.kind === 'comment' ? `c${i.comment.id}` : i.kind))).toEqual(['m2', 'c2']);
  });

  it('systémové události jen neutrální a jen pro danou skupinu', () => {
    const entry = (id: number, action: AuditEntry['action'], groupIds = [GROUP]): AuditEntry => ({ id, at: at(id), actorId: 3, action, groupIds, memberId: 4 });
    const items = buildGroupTimeline(input({
      posts: [],
      audit: [entry(1, 'member-added'), entry(2, 'request-rejected'), entry(3, 'member-removed', [99]), entry(4, 'event-updated')],
    }));
    expect(items.map((i) => (i.kind === 'system' ? i.entry.id : -1))).toEqual([1, 4]);
  });

  it('clusterComments řadí podle času', () => {
    const clusters = clusterComments([comment(2, 30), comment(1, 10), comment(3, 32)], 10);
    expect(clusters.map((c) => c.map((x) => x.id))).toEqual([[1], [2, 3]]);
  });

  it('nepřečtené zprávy: jen cizí, nesmazané, po posledním čtení a po vstupu do skupiny', () => {
    const messages = [message(1, 5), message(2, 20), message(3, 21, VIEWER), { ...message(4, 22), deletedAt: at(23) }, message(5, 25)];
    expect(unreadChatCount(messages, GROUP, VIEWER)).toBe(3);
    expect(unreadChatCount(messages, GROUP, VIEWER, at(10))).toBe(2);
    expect(unreadChatCount(messages, GROUP, VIEWER, undefined, at(21))).toBe(1);
  });
});

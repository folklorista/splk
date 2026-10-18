import { searchContent, SearchInput } from './search.utils';
import { Group } from '../../core/models/group.model';
import { Post } from '../posts/models/post.model';
import { AppEvent } from '../events/models/event.model';
import { testMandate } from '../../testing/access.testing';

describe('searchContent', () => {
  const groups: Group[] = [
    { id: 1, ensembleId: 1, name: 'Holky', slug: 'holky' },
    { id: 2, ensembleId: 1, name: 'Kluci', slug: 'kluci' },
  ];
  const post = (id: number, groupId: number, extra: Partial<Post> = {}): Post => ({
    id, ensembleId: 1, title: `Kroje ${id}`, body: 'Vezměte si kroje', authorId: 9, groupId, publishedAt: '2026-10-10T10:00:00', updatedAt: '', isPinned: false, ...extra,
  });
  const event: AppEvent = { id: 1, ensembleId: 1, title: 'Hody v krojích', type: 'performance', startsAt: '2026-11-01T10:00:00', endsAt: '2026-11-01T12:00:00', location: 'Náves', targetGroupIds: [2] };

  const input = (extra: Partial<SearchInput> = {}): SearchInput => ({
    query: 'kroj',
    subject: { memberId: 1, groupIds: [1], isExternal: false, mandates: [] },
    viewer: { groupIds: [1] },
    groups,
    posts: [post(1, 1), post(2, 2), post(3, 1, { hiddenAt: '2026-10-11T00:00:00' })],
    comments: [{ id: 1, postId: 2, authorId: 9, body: 'kroje mám', createdAt: '2026-10-10T11:00:00', mentionedMemberIds: [], seenByMemberIds: [] }],
    messages: [
      { id: 1, groupId: 1, authorId: 9, body: 'kroje ve skříni', mentionedMemberIds: [], createdAt: '2026-10-01T10:00:00' },
      { id: 2, groupId: 1, authorId: 9, body: 'kroje vyprané', mentionedMemberIds: [], createdAt: '2026-10-12T10:00:00', deletedAt: '2026-10-12T11:00:00' },
    ],
    events: [event],
    memberName: () => 'X',
    ...extra,
  });

  it('najde jen obsah skupin, které člen čte (ne cizí skupinu, skrytý příspěvek, smazanou zprávu ani cizí akci)', () => {
    const hits = searchContent(input());
    expect(hits.map((h) => `${h.kind}${h.id}`).sort()).toEqual(['message1', 'post1']);
  });

  it('chat z období „od vstupu“ jen od vstupu do skupiny; otevřená historie i starší zprávy', () => {
    const viewer = { groupIds: [1], groupIntervals: { 1: [{ from: '2026-10-05T00:00:00' }] } };
    const fromJoin = groups.map((g) => (g.id === 1 ? { ...g, chatHistory: 'from-join' as const } : g));
    expect(searchContent(input({ viewer, groups: fromJoin })).some((h) => h.kind === 'message')).toBeFalse();
    expect(searchContent(input({ viewer })).some((h) => h.kind === 'message')).toBeTrue();
  });

  it('Správa souboru neodemyká obsah cizí skupiny ve vyhledávání', () => {
    const hits = searchContent(input({ subject: { memberId: 1, groupIds: [1], isExternal: false, mandates: [testMandate(1, 'ensemble-admin')] } }));
    expect(hits.some((h) => h.groupId === 2)).toBeFalse();
  });

  it('filtr podle skupiny a období; bez diakritiky; krátký dotaz nic nevrací', () => {
    expect(searchContent(input({ query: 'K' }))).toEqual([]);
    expect(searchContent(input({ query: 'SKŘÍNI' })).map((h) => h.kind)).toEqual(['message']);
    expect(searchContent(input({ from: '2026-10-05' })).map((h) => h.kind)).toEqual(['post']);
    expect(searchContent(input({ groupId: 2 }))).toEqual([]);
  });

  it('člen cílové skupiny najde akci', () => {
    const hits = searchContent(input({ subject: { memberId: 1, groupIds: [2], isExternal: false, mandates: [] } }));
    expect(hits.map((h) => h.kind).sort()).toEqual(['comment', 'event', 'post']);
  });
});

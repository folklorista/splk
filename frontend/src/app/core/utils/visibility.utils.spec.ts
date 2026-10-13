import { canAccessBoard, getBoardBadgeCount, getNewCommentsCount, getUnconfirmedEventsCount, getUnseenMentionsCount, isAdmin, isItemVisibleToUser } from './visibility.utils';
import { User } from '../auth/models/user.model';

describe('visibility.utils', () => {
  const user: User = {
    id: 1,
    name: 'Jana Nováková',
    email: 'jana@soubor.cz',
    groupIds: [1, 2],
    roles: ['member'],
  };
  const currentMemberId = 10;

  describe('isItemVisibleToUser', () => {
    it('vrátí true, když položka nemá cílové skupiny', () => {
      expect(isItemVisibleToUser([], user.groupIds)).toBeTrue();
    });

    it('vrátí true, když se skupiny protínají', () => {
      expect(isItemVisibleToUser([2, 3], user.groupIds)).toBeTrue();
    });

    it('vrátí false, když se skupiny neprotínají', () => {
      expect(isItemVisibleToUser([3, 4], user.groupIds)).toBeFalse();
    });
  });

  describe('canAccessBoard', () => {
    it('pustí člena skupiny', () => {
      expect(canAccessBoard(2, [1, 2], false)).toBeTrue();
    });

    it('nepustí nečlena', () => {
      expect(canAccessBoard(3, [1, 2], false)).toBeFalse();
    });

    it('administrátora pustí i na nástěnku cizí skupiny', () => {
      expect(canAccessBoard(3, [], true)).toBeTrue();
    });
  });

  describe('isAdmin', () => {
    it('pozná administrátora podle role', () => {
      expect(isAdmin({ ...user, roles: ['member', 'admin'] })).toBeTrue();
      expect(isAdmin(user)).toBeFalse();
      expect(isAdmin(null)).toBeFalse();
    });
  });

  describe('getBoardBadgeCount', () => {
    it('vrátí 0 bez ID člena', () => {
      expect(getBoardBadgeCount([{ id: 1, groupId: 1, readers: [] }], [], 1, null)).toBe(0);
    });

    it('započítá nepřečtené nearchivované příspěvky dané nástěnky a neviděné zmínky u nich', () => {
      const posts = [
        { id: 1, groupId: 1, readers: [] },
        { id: 2, groupId: 1, readers: [currentMemberId] },
        { id: 3, groupId: 1, readers: [], archivedAt: '2026-01-01T00:00:00' },
        { id: 4, groupId: 2, readers: [] },
      ];
      const comments = [
        { postId: 2, mentionedMemberIds: [currentMemberId], seenByMemberIds: [] },
        { postId: 4, mentionedMemberIds: [currentMemberId], seenByMemberIds: [] },
      ];
      expect(getBoardBadgeCount(posts, comments, 1, currentMemberId)).toBe(2);
      expect(getBoardBadgeCount(posts, comments, 2, currentMemberId)).toBe(2);
    });
  });

  describe('getUnconfirmedEventsCount', () => {
    it('vrátí 0 bez uživatele nebo bez ID člena', () => {
      const events = [{ targetGroupIds: [], attendance: [] }];
      expect(getUnconfirmedEventsCount(events, null, currentMemberId)).toBe(0);
      expect(getUnconfirmedEventsCount(events, user, null)).toBe(0);
    });

    it('nezapočítá akci, kde už člen vyjádřil účast', () => {
      const events = [
        { targetGroupIds: [], attendance: [{ memberId: currentMemberId, status: 'yes' }] },
        { targetGroupIds: [], attendance: [{ memberId: currentMemberId, status: 'no' }] },
        { targetGroupIds: [], attendance: [{ memberId: currentMemberId, status: 'maybe' }] },
      ];
      expect(getUnconfirmedEventsCount(events, user, currentMemberId)).toBe(0);
    });

    it('započítá akci bez záznamu účasti nebo se stavem pending', () => {
      const events = [
        { targetGroupIds: [], attendance: [] },
        { targetGroupIds: [], attendance: [{ memberId: currentMemberId, status: 'pending' }] },
        { targetGroupIds: [], attendance: [{ memberId: 999, status: 'yes' }] },
      ];
      expect(getUnconfirmedEventsCount(events, user, currentMemberId)).toBe(3);
    });

    it('nezapočítá akci, která není určena pro skupiny uživatele', () => {
      const events = [{ targetGroupIds: [99], attendance: [] }];
      expect(getUnconfirmedEventsCount(events, user, currentMemberId)).toBe(0);
    });
  });

  describe('getNewCommentsCount', () => {
    const comments = [
      { postId: 1, authorId: 2, createdAt: '2026-01-01T10:00:00Z' },
      { postId: 1, authorId: 2, createdAt: '2026-01-03T10:00:00Z' },
      { postId: 1, authorId: currentMemberId, createdAt: '2026-01-04T10:00:00Z' },
      { postId: 2, authorId: 2, createdAt: '2026-01-05T10:00:00Z' },
    ];

    it('vrátí 0 bez ID člena', () => {
      expect(getNewCommentsCount(comments, { id: 1 }, null)).toBe(0);
    });

    it('u nenavštíveného příspěvku započítá všechny cizí komentáře', () => {
      expect(getNewCommentsCount(comments, { id: 1 }, currentMemberId)).toBe(2);
    });

    it('započítá jen cizí komentáře po poslední návštěvě', () => {
      const post = { id: 1, lastVisitedAt: { [currentMemberId]: '2026-01-02T00:00:00Z' } };
      expect(getNewCommentsCount(comments, post, currentMemberId)).toBe(1);
    });

    it('nepočítá s návštěvou jiného člena', () => {
      const post = { id: 1, lastVisitedAt: { 999: '2026-01-10T00:00:00Z' } };
      expect(getNewCommentsCount(comments, post, currentMemberId)).toBe(2);
    });
  });

  describe('getUnseenMentionsCount', () => {
    it('vrátí 0 bez ID člena', () => {
      const comments = [{ mentionedMemberIds: [currentMemberId], seenByMemberIds: [] }];
      expect(getUnseenMentionsCount(comments, null)).toBe(0);
    });

    it('započítá jen zmínky daného člena, které ještě neviděl', () => {
      const comments = [
        { mentionedMemberIds: [currentMemberId], seenByMemberIds: [] },
        { mentionedMemberIds: [currentMemberId], seenByMemberIds: [currentMemberId] },
        { mentionedMemberIds: [999], seenByMemberIds: [] },
      ];
      expect(getUnseenMentionsCount(comments, currentMemberId)).toBe(1);
    });
  });
});

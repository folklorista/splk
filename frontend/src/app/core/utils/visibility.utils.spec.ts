import { getUnconfirmedEventsCount, getUnreadPostsCount, getUnseenMentionsCount, isItemVisibleToUser } from './visibility.utils';
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

    it('vrátí true, když je uživatel v seznamu konkrétně cílených lidí, i mimo cílové skupiny', () => {
      expect(isItemVisibleToUser([3, 4], user.groupIds, [currentMemberId], currentMemberId)).toBeTrue();
    });

    it('vrátí false, když nesedí ani skupina, ani konkrétní cílení', () => {
      expect(isItemVisibleToUser([3, 4], user.groupIds, [999], currentMemberId)).toBeFalse();
    });

    it('vrátí true jen na základě shody skupiny, i bez memberId', () => {
      expect(isItemVisibleToUser([2, 3], user.groupIds, [999])).toBeTrue();
    });

    it('vrátí true, pokud jsou cílové skupiny prázdné, ale je konkrétně cílen', () => {
      expect(isItemVisibleToUser([], user.groupIds, [currentMemberId], currentMemberId)).toBeTrue();
    });
  });

  describe('getUnreadPostsCount', () => {
    it('vrátí 0 bez uživatele nebo bez ID člena', () => {
      const posts = [{ targetGroupIds: [], readers: [] }];
      expect(getUnreadPostsCount(posts, null, currentMemberId)).toBe(0);
      expect(getUnreadPostsCount(posts, user, null)).toBe(0);
    });

    it('započítá jen viditelné a nepřečtené příspěvky', () => {
      const posts = [
        { targetGroupIds: [], readers: [currentMemberId] },
        { targetGroupIds: [], readers: [] },
        { targetGroupIds: [99], readers: [] },
      ];
      expect(getUnreadPostsCount(posts, user, currentMemberId)).toBe(1);
    });

    it('započítá i příspěvek cílený konkrétně na člena mimo jeho skupiny', () => {
      const posts = [{ targetGroupIds: [99], targetMemberIds: [currentMemberId], readers: [] }];
      expect(getUnreadPostsCount(posts, user, currentMemberId)).toBe(1);
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

    it('započítá i akci cílenou konkrétně na člena mimo jeho skupiny', () => {
      const events = [{ targetGroupIds: [99], targetMemberIds: [currentMemberId], attendance: [] }];
      expect(getUnconfirmedEventsCount(events, user, currentMemberId)).toBe(1);
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

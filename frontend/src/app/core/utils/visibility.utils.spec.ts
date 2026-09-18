import { getUnconfirmedEventsCount, getUnreadPostsCount, isItemVisibleToUser } from './visibility.utils';
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
});

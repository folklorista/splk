import { getBoardBadgeCount, getNewCommentsCount, getUnconfirmedEventsCount, getUnseenMentionsCount, hasBoard, hasChat } from './visibility.utils';
import { AccessSubject } from '../access/access.utils';

describe('visibility.utils', () => {
  const currentMemberId = 10;
  const subject: AccessSubject = { memberId: currentMemberId, groupIds: [1, 2], isExternal: false, mandates: [] };

  describe('hasBoard / hasChat', () => {
    it('chybějící nastavení = zapnuto', () => {
      expect(hasBoard({})).toBeTrue();
      expect(hasChat({})).toBeTrue();
      expect(hasBoard({ boardEnabled: false })).toBeFalse();
      expect(hasChat({ chatEnabled: false })).toBeFalse();
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
    const FUTURE = '2099-01-01T18:00:00';

    it('vrátí 0 bez přihlášeného člena', () => {
      const events = [{ startsAt: FUTURE, targetGroupIds: [], attendance: [] }];
      expect(getUnconfirmedEventsCount(events, null)).toBe(0);
    });

    it('nezapočítá akci, kde už člen vyjádřil účast', () => {
      const events = [
        { startsAt: FUTURE, targetGroupIds: [], attendance: [{ memberId: currentMemberId, status: 'yes' }] },
        { startsAt: FUTURE, targetGroupIds: [], attendance: [{ memberId: currentMemberId, status: 'no' }] },
        { startsAt: FUTURE, targetGroupIds: [], attendance: [{ memberId: currentMemberId, status: 'maybe' }] },
      ];
      expect(getUnconfirmedEventsCount(events, subject)).toBe(0);
    });

    it('započítá akci bez záznamu účasti nebo se stavem pending', () => {
      const events = [
        { startsAt: FUTURE, targetGroupIds: [], attendance: [] },
        { startsAt: FUTURE, targetGroupIds: [], attendance: [{ memberId: currentMemberId, status: 'pending' }] },
        { startsAt: FUTURE, targetGroupIds: [], attendance: [{ memberId: 999, status: 'yes' }] },
      ];
      expect(getUnconfirmedEventsCount(events, subject)).toBe(3);
    });

    it('nezapočítá akci, která není určena pro skupiny uživatele', () => {
      const events = [{ startsAt: FUTURE, targetGroupIds: [99], attendance: [] }];
      expect(getUnconfirmedEventsCount(events, subject)).toBe(0);
    });

    it('započítá akci, kam je člen pozván jako host, ale ne akci pro celý soubor u externisty', () => {
      const events = [
        { startsAt: FUTURE, targetGroupIds: [99], guestMemberIds: [currentMemberId], attendance: [] },
        { startsAt: FUTURE, targetGroupIds: [], attendance: [] },
      ];
      expect(getUnconfirmedEventsCount(events, { ...subject, isExternal: true })).toBe(1);
    });

    it('nezapočítá proběhlou akci bez odpovědi', () => {
      const events = [{ startsAt: '2000-01-01T18:00:00', targetGroupIds: [], attendance: [] }];
      expect(getUnconfirmedEventsCount(events, subject)).toBe(0);
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

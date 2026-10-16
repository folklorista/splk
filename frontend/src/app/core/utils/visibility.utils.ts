import { AccessSubject, isEventAudience } from '../access/access.utils';

export function hasBoard(group: { boardEnabled?: boolean }): boolean {
  return group.boardEnabled !== false;
}

export function hasChat(group: { chatEnabled?: boolean }): boolean {
  return group.chatEnabled !== false;
}

// Badge nástěnky = nepřečtené (nearchivované) příspěvky + neviděné zmínky v komentářích k jejím příspěvkům
export function getBoardBadgeCount(posts: any[], comments: any[], groupId: number, currentMemberId: number | null): number {
  if (!currentMemberId) return 0;
  const boardPosts = posts.filter(p => p.groupId === groupId);
  const boardPostIds = new Set(boardPosts.map(p => p.id));
  const unreadPosts = boardPosts
    .filter(p => !p.archivedAt)
    .filter(p => !p.readers || !p.readers.includes(currentMemberId))
    .length;
  const unseenMentions = getUnseenMentionsCount(comments.filter(c => boardPostIds.has(c.postId)), currentMemberId);
  return unreadPosts + unseenMentions;
}

// Počítají se jen nadcházející akce, kterými je člen osloven – na proběhlé už účast potvrzovat nejde
export function getUnconfirmedEventsCount(events: any[], subject: AccessSubject | null, now = new Date()): number {
  if (!subject) return 0;
  const currentMemberId = subject.memberId;
  return events
    .filter(e => new Date(e.startsAt) >= now)
    .filter(e => isEventAudience({ id: currentMemberId, groupIds: subject.groupIds, isActive: true, isExternal: subject.isExternal }, e))
    .filter(e => {
      const memberAttendance = e.attendance?.find((a: any) => a.memberId === currentMemberId);
      return !memberAttendance || memberAttendance.status === 'pending';
    })
    .length;
}

// Počet komentářů k příspěvku od poslední návštěvy člena (bez jeho vlastních).
// Pokud příspěvek ještě nenavštívil, jsou nové všechny komentáře.
export function getNewCommentsCount(comments: any[], post: any, currentMemberId: number | null): number {
  if (!currentMemberId) return 0;
  const lastVisit: string | undefined = post.lastVisitedAt?.[currentMemberId];
  return comments
    .filter(c => c.postId === post.id)
    .filter(c => c.authorId !== currentMemberId)
    .filter(c => !lastVisit || Date.parse(c.createdAt) > Date.parse(lastVisit))
    .length;
}

// Počet zmínek (@Jméno v komentáři), které daný člen ještě neviděl
export function getUnseenMentionsCount(comments: any[], currentMemberId: number | null): number {
  if (!currentMemberId) return 0;
  return comments
    .filter(c => c.mentionedMemberIds?.includes(currentMemberId))
    .filter(c => !c.seenByMemberIds?.includes(currentMemberId))
    .length;
}

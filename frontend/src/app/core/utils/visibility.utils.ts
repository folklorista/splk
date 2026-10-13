import { User } from '../auth/models/user.model';

// Položka (akce) je viditelná, když nemá žádné cílení (= pro všechny),
// nebo když se protíná skupina uživatele s cílovými skupinami.
export function isItemVisibleToUser(targetGroupIds: number[] | undefined, userGroups: number[]): boolean {
  if (!targetGroupIds || targetGroupIds.length === 0) {
    return true;
  }
  return targetGroupIds.some(gid => userGroups.includes(gid));
}

// Nástěnku skupiny vidí (a píše na ni) jen člen té skupiny; administrátor vidí všechny.
export function canAccessBoard(groupId: number, memberGroupIds: number[], isAdmin: boolean): boolean {
  return isAdmin || memberGroupIds.includes(groupId);
}

export function isAdmin(user: User | null): boolean {
  return user?.roles.includes('admin') ?? false;
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

// Počítají se jen nadcházející akce – na proběhlé už účast potvrzovat nejde
export function getUnconfirmedEventsCount(events: any[], user: User | null, currentMemberId: number | null, now = new Date()): number {
  if (!user || !currentMemberId) return 0;
  return events
    .filter(e => new Date(e.startsAt) >= now)
    .filter(e => isItemVisibleToUser(e.targetGroupIds, user.groupIds))
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

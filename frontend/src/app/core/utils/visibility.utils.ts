import { User } from '../auth/models/user.model';

// Položka (příspěvek/akce) je viditelná, když nemá žádné cílení (= pro všechny),
// nebo když se protíná skupina uživatele s cílovými skupinami, nebo je uživatel
// v seznamu konkrétně cílených lidí. Obě pravidla se sčítají přes NEBO.
export function isItemVisibleToUser(
  targetGroupIds: number[] | undefined,
  userGroups: number[],
  targetMemberIds?: number[],
  memberId?: number | null,
): boolean {
  const hasGroupTargets = !!targetGroupIds && targetGroupIds.length > 0;
  const hasMemberTargets = !!targetMemberIds && targetMemberIds.length > 0;

  if (!hasGroupTargets && !hasMemberTargets) {
    return true;
  }
  if (hasGroupTargets && targetGroupIds!.some(gid => userGroups.includes(gid))) {
    return true;
  }
  if (hasMemberTargets && memberId != null && targetMemberIds!.includes(memberId)) {
    return true;
  }
  return false;
}

export function getUnreadPostsCount(posts: any[], user: User | null, currentMemberId: number | null): number {
  if (!user || !currentMemberId) return 0;
  return posts
    .filter(p => isItemVisibleToUser(p.targetGroupIds, user.groupIds, p.targetMemberIds, currentMemberId))
    .filter(p => !p.readers || !p.readers.includes(currentMemberId))
    .length;
}

export function getUnconfirmedEventsCount(events: any[], user: User | null, currentMemberId: number | null): number {
  if (!user || !currentMemberId) return 0;
  return events
    .filter(e => isItemVisibleToUser(e.targetGroupIds, user.groupIds, e.targetMemberIds, currentMemberId))
    .filter(e => {
      const memberAttendance = e.attendance?.find((a: any) => a.memberId === currentMemberId);
      return !memberAttendance || memberAttendance.status === 'pending';
    })
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

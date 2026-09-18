import { User } from '../auth/models/user.model';

export function isItemVisibleToUser(targetGroupIds: number[], userGroups: number[]): boolean {
  if (!targetGroupIds || targetGroupIds.length === 0) {
    return true;
  }

  return targetGroupIds.some(gid => userGroups.includes(gid));
}

export function getUnreadPostsCount(posts: any[], user: User | null, currentMemberId: number | null): number {
  if (!user || !currentMemberId) return 0;
  return posts
    .filter(p => isItemVisibleToUser(p.targetGroupIds, user.groupIds))
    .filter(p => !p.readers || !p.readers.includes(currentMemberId))
    .length;
}

export function getUnconfirmedEventsCount(events: any[], user: User | null, currentMemberId: number | null): number {
  if (!user || !currentMemberId) return 0;
  return events
    .filter(e => isItemVisibleToUser(e.targetGroupIds, user.groupIds))
    .filter(e => {
      const memberAttendance = e.attendance?.find((a: any) => a.memberId === currentMemberId);
      return !memberAttendance || memberAttendance.status === 'pending';
    })
    .length;
}

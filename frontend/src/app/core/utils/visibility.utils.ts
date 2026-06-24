import { User } from '../auth/models/user.model';

export function isItemVisibleToUser(targetGroupIds: number[], userGroups: string[]): boolean {
  if (!targetGroupIds || targetGroupIds.length === 0) {
    return true;
  }
  const groupMap: Record<string, number> = {
    'dospeli': 1,
    'tanecni-skupina': 2,
    'vedeni': 3,
    'hudebnici': 4,
  };
  return targetGroupIds.some(gid => userGroups.some(ug => groupMap[ug] === gid));
}

export function getUnreadPostsCount(posts: any[], user: User | null): number {
  if (!user) return 0;
  return posts
    .filter(p => isItemVisibleToUser(p.targetGroupIds, user.groups))
    .filter(p => !p.readers || !p.readers.includes(user.id))
    .length;
}

export function getUnconfirmedEventsCount(events: any[], user: User | null): number {
  if (!user) return 0;
  return events
    .filter(e => isItemVisibleToUser(e.targetGroupIds, user.groups))
    .filter(e => {
      const userAttendance = e.attendance?.find((a: any) => a.userId === user.id);
      return !userAttendance;
    })
    .length;
}

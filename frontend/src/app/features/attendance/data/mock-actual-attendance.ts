import { ActualAttendance } from '../models/actual-attendance.model';
import { MOCK_EVENTS } from '../../events/data/mock-events';
import { MOCK_MEMBERS } from '../../members/data/mock-members';
import { MOCK_ATTENDANCE } from './mock-attendance';
import { LEADERSHIP_GROUP_ID } from '../../../core/data/mock-groups';
import { isItemVisibleToUser } from '../../../core/utils/visibility.utils';

// Proběhlé zkoušky mají zapsanou skutečnou docházku – kromě té poslední, kterou si vedoucí
// v demu může zapsat sám. Skutečnost se občas liší od nahlášené účasti (přislíbil a nepřišel apod.).
function generateActualAttendance(): ActualAttendance[] {
  const now = Date.now();
  const recorder = MOCK_MEMBERS.find((m) => m.isActive && m.groupIds.includes(LEADERSHIP_GROUP_ID));
  if (!recorder) return [];

  const pastRehearsals = MOCK_EVENTS
    .filter((e) => e.type === 'rehearsal' && Date.parse(e.startsAt) <= now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, -1);

  const records: ActualAttendance[] = [];
  for (const event of pastRehearsals) {
    const recordedAt = new Date(Date.parse(event.endsAt) + 30 * 60 * 1000).toISOString();
    const members = MOCK_MEMBERS.filter((m) => m.isActive && isItemVisibleToUser(event.targetGroupIds, m.groupIds));
    for (const member of members) {
      const rsvp = MOCK_ATTENDANCE.find((r) => r.eventId === event.id && r.memberId === member.id)?.status;
      const roll = (event.id * 11 + member.id * 7) % 10;
      const present = rsvp === 'no' ? roll === 0 : rsvp === 'maybe' ? roll % 2 === 0 : roll !== 3;
      records.push({ eventId: event.id, memberId: member.id, present, recordedByMemberId: recorder.id, recordedAt });
    }
  }
  return records;
}

export const MOCK_ACTUAL_ATTENDANCE: ActualAttendance[] = generateActualAttendance();

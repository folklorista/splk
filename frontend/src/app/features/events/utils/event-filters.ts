import { AppEvent, EventType } from '../models/event.model';
import { AttendanceStatus } from '../../attendance/models/attendance.model';
import { needsResponse } from './event-reminders';

export type ResponseFilter = 'all' | 'pending' | 'answered';

export interface EventFilters {
  type: EventType | 'all';
  response: ResponseFilter;
}

export const DEFAULT_EVENT_FILTERS: EventFilters = { type: 'all', response: 'all' };

export interface AttendanceCounts {
  yes: number;
  no: number;
  maybe: number;
  pending: number;
}

export function ownAttendanceStatus(event: AppEvent, memberId: number | null): AttendanceStatus {
  return event.attendance?.find((a) => a.memberId === memberId)?.status ?? 'pending';
}

// Filtry lze kombinovat: typ akce a moje odpověď. „Čeká na odpověď“ = aktivní výzva (předstih nastal,
// bez odpovědi, po měkké uzávěrce i MOŽNÁ) – stejně jako badge. „Odpovězeno“ = jakákoli odpověď.
export function filterEvents(events: AppEvent[], filters: EventFilters, memberId: number | null, now = new Date()): AppEvent[] {
  return events.filter((event) => {
    if (filters.type !== 'all' && event.type !== filters.type) return false;
    if (filters.response === 'all') return true;
    const status = ownAttendanceStatus(event, memberId);
    return filters.response === 'pending' ? needsResponse(event, status, now) : status !== 'pending';
  });
}

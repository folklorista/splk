import { AppEvent, EventType } from '../models/event.model';
import { AttendanceStatus } from '../../attendance/models/attendance.model';

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

// Filtry lze kombinovat: typ akce a moje odpověď (nepotvrzené = bez odpovědi nebo „pending“)
export function filterEvents(events: AppEvent[], filters: EventFilters, memberId: number | null): AppEvent[] {
  return events.filter((event) => {
    if (filters.type !== 'all' && event.type !== filters.type) return false;
    if (filters.response === 'all') return true;
    const pending = ownAttendanceStatus(event, memberId) === 'pending';
    return filters.response === 'pending' ? pending : !pending;
  });
}

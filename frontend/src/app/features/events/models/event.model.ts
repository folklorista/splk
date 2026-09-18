export type EventType = 'rehearsal' | 'performance' | 'camp' | 'meeting' | 'other';

import { AttendanceRecord } from '../../attendance/models/attendance.model';

export interface AppEvent {
  id: number;
  ensembleId: number;
  title: string;
  type: EventType;
  startsAt: string;
  endsAt: string;
  location: string;
  description?: string;
  targetGroupIds: number[];
  targetMemberIds?: number[];
  requiresAction?: boolean;
  attendance?: AttendanceRecord[];
}

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
  // Komu je akce určena: skupiny (prázdné = všichni členové souboru) a jednotliví hosté
  targetGroupIds: number[];
  guestMemberIds?: number[];
  // Kdo akci pořádá – oddělené od cílení; správu akce dává až pověření (Mandate 'events')
  organizerGroupIds?: number[];
  requiresAction?: boolean;
  attendance?: AttendanceRecord[];
}

export type EventType = 'rehearsal' | 'performance' | 'camp' | 'meeting' | 'other';

export type AttendanceStatus = 'yes' | 'no' | 'maybe';

export interface AttendanceRecord {
  userId: string;
  status: AttendanceStatus;
}

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
  requiresAction?: boolean;
  attendance?: AttendanceRecord[];
}

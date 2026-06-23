export type AttendanceStatus = 'yes' | 'no' | 'maybe' | 'pending';

export interface AttendanceRecord {
  eventId: number;
  memberId: number;
  status: AttendanceStatus;
  note?: string;
}

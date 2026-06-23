import { AttendanceRecord } from '../models/attendance.model';

export const MOCK_ATTENDANCE: AttendanceRecord[] = [
  // Event 1 – zkouška celý soubor
  { eventId: 1, memberId: 1, status: 'yes' },
  { eventId: 1, memberId: 2, status: 'yes' },
  { eventId: 1, memberId: 3, status: 'no', note: 'Pracovní povinnost' },
  { eventId: 1, memberId: 4, status: 'maybe' },
  { eventId: 1, memberId: 5, status: 'yes' },
  { eventId: 1, memberId: 7, status: 'pending' },
  { eventId: 1, memberId: 8, status: 'yes' },

  // Event 2 – vystoupení Strážnice
  { eventId: 2, memberId: 1, status: 'yes' },
  { eventId: 2, memberId: 2, status: 'yes' },
  { eventId: 2, memberId: 3, status: 'yes' },
  { eventId: 2, memberId: 4, status: 'no', note: 'Dovolená' },
  { eventId: 2, memberId: 5, status: 'yes' },
  { eventId: 2, memberId: 7, status: 'yes' },
  { eventId: 2, memberId: 8, status: 'maybe' },
];

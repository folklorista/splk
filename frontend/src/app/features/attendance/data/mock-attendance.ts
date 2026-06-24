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
  { eventId: 1, memberId: 9, status: 'yes' },
  { eventId: 1, memberId: 10, status: 'yes' },

  // Event 2 – vystoupení Strážnice
  { eventId: 2, memberId: 1, status: 'yes' },
  { eventId: 2, memberId: 2, status: 'yes' },
  { eventId: 2, memberId: 3, status: 'yes' },
  { eventId: 2, memberId: 4, status: 'no', note: 'Dovolená' },
  { eventId: 2, memberId: 5, status: 'yes' },
  { eventId: 2, memberId: 7, status: 'yes' },
  { eventId: 2, memberId: 8, status: 'maybe' },
  { eventId: 2, memberId: 9, status: 'yes' },
  { eventId: 2, memberId: 10, status: 'yes' },

  // Event 3 – zkouška taneční skupina
  { eventId: 3, memberId: 1, status: 'yes' },
  { eventId: 3, memberId: 3, status: 'yes' },
  { eventId: 3, memberId: 5, status: 'maybe', note: 'Možná později' },
  { eventId: 3, memberId: 7, status: 'yes' },
  { eventId: 3, memberId: 9, status: 'pending' },

  // Event 4 – letní soustředění
  { eventId: 4, memberId: 1, status: 'yes' },
  { eventId: 4, memberId: 2, status: 'yes' },
  { eventId: 4, memberId: 3, status: 'no', note: 'Nemůžu se zúčastnit' },
  { eventId: 4, memberId: 4, status: 'pending' },
  { eventId: 4, memberId: 5, status: 'yes' },
  { eventId: 4, memberId: 7, status: 'yes' },
  { eventId: 4, memberId: 8, status: 'yes' },
  { eventId: 4, memberId: 9, status: 'maybe' },
  { eventId: 4, memberId: 10, status: 'yes' },

  // Event 5 – schůzka vedení
  { eventId: 5, memberId: 2, status: 'yes' },
  { eventId: 5, memberId: 3, status: 'yes' },
  { eventId: 5, memberId: 5, status: 'yes' },
  { eventId: 5, memberId: 8, status: 'maybe' },

  // Event 6 – zkouška hudebníci
  { eventId: 6, memberId: 1, status: 'pending' },
  { eventId: 6, memberId: 2, status: 'yes' },
  { eventId: 6, memberId: 4, status: 'yes' },
];

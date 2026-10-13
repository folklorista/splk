import { AttendanceRecord, AttendanceStatus } from '../models/attendance.model';
import { FIRST_REHEARSAL_ID, MOCK_EVENTS } from '../../events/data/mock-events';
import { MOCK_MEMBERS } from '../../members/data/mock-members';
import { isItemVisibleToUser } from '../../../core/utils/visibility.utils';

const BASE_ATTENDANCE: AttendanceRecord[] = [
  // Event 1 – zkouška celý soubor
  { eventId: 1, memberId: 1, status: 'yes', note: 'Přijedu autem' },
  { eventId: 1, memberId: 2, status: 'yes' },
  { eventId: 1, memberId: 3, status: 'no', note: 'Pracovní povinnost' },
  { eventId: 1, memberId: 4, status: 'maybe' },
  { eventId: 1, memberId: 5, status: 'yes' },
  { eventId: 1, memberId: 7, status: 'pending' },
  { eventId: 1, memberId: 8, status: 'yes' },
  { eventId: 1, memberId: 9, status: 'yes' },
  { eventId: 1, memberId: 10, status: 'yes' },

  // Event 2 – vystoupení Strážnice
  { eventId: 2, memberId: 1, status: 'no', note: 'Nemůžu se zúčastnit' },
  { eventId: 2, memberId: 2, status: 'yes' },
  { eventId: 2, memberId: 3, status: 'yes' },
  { eventId: 2, memberId: 4, status: 'no', note: 'Dovolená' },
  { eventId: 2, memberId: 5, status: 'yes' },
  { eventId: 2, memberId: 7, status: 'yes' },
  { eventId: 2, memberId: 8, status: 'maybe' },
  { eventId: 2, memberId: 9, status: 'yes' },
  { eventId: 2, memberId: 10, status: 'yes' },

  // Event 3 – zkouška taneční skupina
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

// Deterministicky „náhodné“ odpovědi na pravidelné nácviky: proběhlé mají odpověď od všech,
// nadcházející jen od části členů (zbytek čeká na odpověď)
function generateRehearsalAttendance(): AttendanceRecord[] {
  const now = new Date().toISOString();
  const records: AttendanceRecord[] = [];
  for (const event of MOCK_EVENTS.filter((e) => e.id >= FIRST_REHEARSAL_ID)) {
    const isPast = event.startsAt < now;
    const members = MOCK_MEMBERS.filter((m) => m.isActive && isItemVisibleToUser(event.targetGroupIds, m.groupIds));
    for (const member of members) {
      const roll = (event.id * 7 + member.id * 13) % 10;
      const status: AttendanceStatus | null = isPast
        ? roll === 7 ? 'no' : roll === 8 ? 'maybe' : 'yes'
        : roll <= 3 ? 'yes' : roll === 4 ? 'maybe' : roll === 5 ? 'no' : null;
      if (status) {
        records.push({ eventId: event.id, memberId: member.id, status });
      }
    }
  }
  return records;
}

export const MOCK_ATTENDANCE: AttendanceRecord[] = [...BASE_ATTENDANCE, ...generateRehearsalAttendance()];

import { AttendanceRecord, AttendanceStatus } from '../models/attendance.model';
import { MOCK_EVENTS } from '../../events/data/mock-events';
import { MOCK_MEMBERS } from '../../members/data/mock-members';
import { isItemVisibleToUser } from '../../../core/utils/visibility.utils';

const NO_NOTES = ['Pracovní povinnost', 'Jsem nemocná/ý', 'Rodinná oslava', 'Nestihnu to z práce'];
const MAYBE_NOTES = ['Dorazím později', 'Podle toho, jak skončím v práci', 'Možná jen na první hodinu'];

// Deterministicky „náhodné“ odpovědi pro členy skupin, kterým je akce určená (ne pevná ID členů –
// stejná logika funguje pro vymyšlené i reálné členy v demu). Proběhlé akce mají odpověď od všech,
// nadcházející jen od části členů (zbytek čeká na odpověď).
function generateAttendance(): AttendanceRecord[] {
  const now = new Date().toISOString();
  const records: AttendanceRecord[] = [];
  for (const event of MOCK_EVENTS) {
    const isPast = event.startsAt < now;
    const members = MOCK_MEMBERS.filter((m) => m.isActive && isItemVisibleToUser(event.targetGroupIds, m.groupIds));
    for (const member of members) {
      const roll = (event.id * 7 + member.id * 13) % 10;
      const status: AttendanceStatus | null = isPast
        ? roll === 7 ? 'no' : roll === 8 ? 'maybe' : 'yes'
        : roll <= 3 ? 'yes' : roll === 4 ? 'maybe' : roll === 5 ? 'no' : null;
      if (!status) continue;
      const notes = status === 'no' ? NO_NOTES : status === 'maybe' ? MAYBE_NOTES : [];
      // Jen část odmítnutí/„možná“ má poznámku
      const note = notes.length && (event.id + member.id) % 2 === 0 ? notes[(event.id + member.id) % notes.length] : undefined;
      records.push({ eventId: event.id, memberId: member.id, status, ...(note ? { note } : {}) });
    }
  }
  return records;
}

export const MOCK_ATTENDANCE: AttendanceRecord[] = generateAttendance();

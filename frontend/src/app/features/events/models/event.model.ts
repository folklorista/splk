export type EventType = 'rehearsal' | 'performance' | 'camp' | 'meeting' | 'other';

import { AttendanceRecord } from '../../attendance/models/attendance.model';

export interface EventImportantChange {
  at: string;
  note: string;
  // Výjimečná zpráva, jejíž přečtení má člen výslovně potvrdit
  requiresConfirmation?: boolean;
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
  // Komu je akce určena: skupiny (prázdné = všichni členové souboru) a jednotliví hosté
  targetGroupIds: number[];
  guestMemberIds?: number[];
  // Kdo akci pořádá – oddělené od cílení; správu akce dává až pověření (Mandate 'events')
  organizerGroupIds?: number[];
  requiresAction?: boolean;
  // Předstih výzvy k odpovědi ve dnech; chybí = podle typu (nácvik 7, vystoupení 14), max. 365 (docs/07 kap. 18)
  reminderLeadDays?: number;
  // Nepovinná měkká uzávěrka: po ní se výzva zopakuje nerozhodnutým (MOŽNÁ / bez odpovědi)
  responseDeadline?: string;
  // Poslední důležitá změna (organizátor ji výslovně označil): kdy, co a zda vyžaduje potvrzení přečtení
  importantChange?: EventImportantChange;
  attendance?: AttendanceRecord[];
}

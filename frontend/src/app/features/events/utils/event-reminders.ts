import { AppEvent, EventType } from '../models/event.model';
import { AttendanceStatus } from '../../attendance/models/attendance.model';

// Výzvy k odpovědi (docs/07 kap. 18): odpovědět lze kdykoli od zveřejnění, ale badge a seznam
// „čeká na odpověď“ se rozsvítí až v předstihu výzvy. Volitelná měkká uzávěrka zopakuje výzvu
// nerozhodnutým (MOŽNÁ / bez odpovědi); pozdější změny odpovědi zůstávají možné.

export const MAX_REMINDER_LEAD_DAYS = 365;

const DEFAULT_LEAD_DAYS: Record<EventType, number> = {
  rehearsal: 7,
  performance: 14,
  camp: 14,
  meeting: 7,
  other: 7,
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function defaultReminderLeadDays(type: EventType): number {
  return DEFAULT_LEAD_DAYS[type];
}

export function reminderLeadDays(event: Pick<AppEvent, 'type' | 'reminderLeadDays'>): number {
  const days = event.reminderLeadDays ?? defaultReminderLeadDays(event.type);
  return Math.min(Math.max(0, days), MAX_REMINDER_LEAD_DAYS);
}

// Od kdy akce vyzývá k odpovědi
export function reminderStartsAt(event: Pick<AppEvent, 'type' | 'reminderLeadDays' | 'startsAt'>): Date {
  return new Date(Date.parse(event.startsAt) - reminderLeadDays(event) * DAY_MS);
}

// Nadcházející akce, u níž už nastal předstih výzvy
export function isReminderActive(event: Pick<AppEvent, 'type' | 'reminderLeadDays' | 'startsAt'>, now = new Date()): boolean {
  return now >= reminderStartsAt(event) && now < new Date(event.startsAt);
}

export function isSoftDeadlinePassed(event: Pick<AppEvent, 'responseDeadline'>, now = new Date()): boolean {
  return !!event.responseDeadline && now >= new Date(event.responseDeadline);
}

// ANO/NE jsou pro plánování definitivní; MOŽNÁ a bez odpovědi ne
export function isDecided(status: AttendanceStatus): boolean {
  return status === 'yes' || status === 'no';
}

// Čeká akce na moji odpověď? Bez odpovědi v době výzvy; po měkké uzávěrce i MOŽNÁ.
export function needsResponse(event: Pick<AppEvent, 'type' | 'reminderLeadDays' | 'startsAt' | 'responseDeadline'>, status: AttendanceStatus, now = new Date()): boolean {
  if (!isReminderActive(event, now)) return false;
  if (status === 'pending') return true;
  return status === 'maybe' && isSoftDeadlinePassed(event, now);
}

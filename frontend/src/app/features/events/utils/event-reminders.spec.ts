import { AppEvent } from '../models/event.model';
import { defaultReminderLeadDays, isDecided, isReminderActive, needsResponse, reminderLeadDays, reminderStartsAt } from './event-reminders';

describe('event-reminders', () => {
  const now = new Date('2026-10-18T12:00:00Z');
  const day = (offset: number) => new Date(now.getTime() + offset * 24 * 60 * 60 * 1000).toISOString();
  const ev = (extra: Partial<AppEvent> = {}): AppEvent => ({ id: 1, ensembleId: 1, title: 'Nácvik', type: 'rehearsal', startsAt: day(5), endsAt: day(5), location: '', targetGroupIds: [], ...extra });

  it('výchozí předstih: nácvik 7 dní, vystoupení 14 dní; vlastní předstih max. 365', () => {
    expect(defaultReminderLeadDays('rehearsal')).toBe(7);
    expect(defaultReminderLeadDays('performance')).toBe(14);
    expect(reminderLeadDays(ev({ reminderLeadDays: 30 }))).toBe(30);
    expect(reminderLeadDays(ev({ reminderLeadDays: 1000 }))).toBe(365);
    expect(reminderStartsAt(ev()).toISOString()).toBe(day(-2));
  });

  it('výzva platí od předstihu do začátku akce', () => {
    expect(isReminderActive(ev({ startsAt: day(8) }), now)).toBeFalse();
    expect(isReminderActive(ev({ startsAt: day(6) }), now)).toBeTrue();
    expect(isReminderActive(ev({ startsAt: day(-1) }), now)).toBeFalse();
  });

  it('ANO/NE jsou definitivní, MOŽNÁ a bez odpovědi ne', () => {
    expect(isDecided('yes')).toBeTrue();
    expect(isDecided('no')).toBeTrue();
    expect(isDecided('maybe')).toBeFalse();
    expect(isDecided('pending')).toBeFalse();
  });

  it('na odpověď čeká bez odpovědi; po měkké uzávěrce i MOŽNÁ', () => {
    expect(needsResponse(ev(), 'pending', now)).toBeTrue();
    expect(needsResponse(ev(), 'maybe', now)).toBeFalse();
    expect(needsResponse(ev({ responseDeadline: day(-1) }), 'maybe', now)).toBeTrue();
    expect(needsResponse(ev({ responseDeadline: day(-1) }), 'yes', now)).toBeFalse();
    expect(needsResponse(ev({ startsAt: day(30) }), 'pending', now)).toBeFalse();
  });
});

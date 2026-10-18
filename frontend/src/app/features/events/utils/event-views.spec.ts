import { AppEvent } from '../models/event.model';
import { AttendanceRecord } from '../../attendance/models/attendance.model';
import { changeAcknowledgement, confirmedChange, viewedSinceChange } from './event-views';

describe('event-views', () => {
  const base: Pick<AppEvent, 'importantChange'> = {};
  const changed = (requiresConfirmation = false): Pick<AppEvent, 'importantChange'> => ({ importantChange: { at: '2026-10-10T10:00:00Z', note: 'Sraz v 17:30', requiresConfirmation } });
  const record = (extra: Partial<AttendanceRecord> = {}): AttendanceRecord => ({ eventId: 1, memberId: 1, status: 'pending', ...extra });

  it('bez změny stačí jakékoli otevření detailu', () => {
    expect(viewedSinceChange(base, record({ firstViewedAt: '2026-10-01T00:00:00Z' }))).toBeTrue();
    expect(viewedSinceChange(base, undefined)).toBeFalse();
    expect(changeAcknowledgement(base, undefined)).toBeNull();
  });

  it('po důležité změně se počítá jen otevření po ní', () => {
    expect(viewedSinceChange(changed(), record({ lastViewedAt: '2026-10-09T00:00:00Z' }))).toBeFalse();
    expect(viewedSinceChange(changed(), record({ lastViewedAt: '2026-10-11T00:00:00Z' }))).toBeTrue();
    expect(changeAcknowledgement(changed(), record({ lastViewedAt: '2026-10-09T00:00:00Z' }))).toBe('view');
    expect(changeAcknowledgement(changed(), record({ lastViewedAt: '2026-10-11T00:00:00Z' }))).toBeNull();
  });

  it('výslovné potvrzení je jiný údaj než zobrazení', () => {
    const viewedOnly = record({ lastViewedAt: '2026-10-11T00:00:00Z' });
    expect(changeAcknowledgement(changed(true), viewedOnly)).toBe('confirm');
    expect(confirmedChange(changed(true), record({ confirmedAt: '2026-10-09T00:00:00Z' }))).toBeFalse();
    expect(changeAcknowledgement(changed(true), record({ confirmedAt: '2026-10-11T00:00:00Z' }))).toBeNull();
  });
});

import { filterEvents } from './event-filters';
import { AppEvent } from '../models/event.model';

describe('filterEvents', () => {
  const event = (id: number, type: AppEvent['type'], status?: 'yes' | 'pending'): AppEvent => ({
    id, ensembleId: 1, title: `Akce ${id}`, type, startsAt: '2099-01-01T18:00:00', endsAt: '2099-01-01T20:00:00',
    location: '', targetGroupIds: [],
    attendance: status ? [{ eventId: id, memberId: 1, status }] : [],
  });
  const events = [event(1, 'rehearsal', 'yes'), event(2, 'rehearsal'), event(3, 'performance', 'pending'), event(4, 'performance', 'yes')];
  const ids = (list: AppEvent[]) => list.map((e) => e.id);

  it('bez filtrů vrátí vše', () => {
    expect(ids(filterEvents(events, { type: 'all', response: 'all' }, 1))).toEqual([1, 2, 3, 4]);
  });

  it('filtruje podle typu', () => {
    expect(ids(filterEvents(events, { type: 'performance', response: 'all' }, 1))).toEqual([3, 4]);
  });

  it('nepotvrzené = bez záznamu nebo pending, potvrzené = zbytek', () => {
    expect(ids(filterEvents(events, { type: 'all', response: 'pending' }, 1))).toEqual([2, 3]);
    expect(ids(filterEvents(events, { type: 'all', response: 'answered' }, 1))).toEqual([1, 4]);
  });

  it('filtry lze kombinovat', () => {
    expect(ids(filterEvents(events, { type: 'rehearsal', response: 'pending' }, 1))).toEqual([2]);
  });

  it('odpověď jiného člena se nepočítá', () => {
    expect(ids(filterEvents(events, { type: 'all', response: 'pending' }, 2))).toEqual([1, 2, 3, 4]);
  });
});

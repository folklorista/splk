import { groupEvents } from './group-events.component';
import { groupTabs } from './group-tabs';
import { AppEvent } from '../../events/models/event.model';

describe('groupEvents', () => {
  const ev = (id: number, targetGroupIds: number[], organizerGroupIds?: number[]): AppEvent => ({ id, ensembleId: 1, title: `A${id}`, type: 'rehearsal', startsAt: '', endsAt: '', location: '', targetGroupIds, organizerGroupIds });
  const events = [ev(1, [2]), ev(2, [3], [2]), ev(3, [2], [2]), ev(4, [5])];

  it('rozliší akce pořádané skupinou a akce pro skupinu', () => {
    expect(groupEvents(events, 2, 'all').map((e) => e.id)).toEqual([1, 2, 3]);
    expect(groupEvents(events, 2, 'organizer').map((e) => e.id)).toEqual([2, 3]);
    expect(groupEvents(events, 2, 'target').map((e) => e.id)).toEqual([1, 3]);
  });

  it('záložka Akce jen se zapnutým modulem Akce', () => {
    const group = { id: 2, ensembleId: 1, name: 'Kluci', slug: 'kluci' };
    expect(groupTabs(group, false, true)).toContain('events');
    expect(groupTabs(group, false, false)).not.toContain('events');
  });
});

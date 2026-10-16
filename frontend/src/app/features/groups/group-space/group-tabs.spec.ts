import { defaultGroupTab, groupTabs, resolveGroupTab } from './group-tabs';
import { Group } from '../../../core/models/group.model';

describe('group-tabs', () => {
  const group: Group = { id: 1, ensembleId: 1, name: 'Muzika', slug: 'muzika' };

  it('výchozí záložka podle nastavení, jen když má skupina chat i nástěnku', () => {
    expect(defaultGroupTab({ ...group, defaultTab: 'chat' })).toBe('chat');
    expect(defaultGroupTab(group)).toBe('board');
    expect(defaultGroupTab({ ...group, defaultTab: 'board', boardEnabled: false })).toBe('chat');
    expect(defaultGroupTab({ ...group, defaultTab: 'chat', chatEnabled: false })).toBe('board');
    expect(defaultGroupTab({ ...group, chatEnabled: false, boardEnabled: false })).toBe('members');
  });

  it('záložka Správa jen správcům; neplatná záložka z URL spadne na výchozí', () => {
    expect(groupTabs(group, false)).toEqual(['chat', 'board', 'members']);
    expect(groupTabs(group, true)).toContain('manage');
    expect(resolveGroupTab('manage', group, false)).toBe('board');
    expect(resolveGroupTab('chat', { ...group, chatEnabled: false }, false)).toBe('board');
    expect(resolveGroupTab('members', group, false)).toBe('members');
  });
});

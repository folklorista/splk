import { Group } from '../../../core/models/group.model';
import { hasBoard, hasChat } from '../../../core/utils/visibility.utils';

export type GroupSpaceTab = 'chat' | 'board' | 'events' | 'members' | 'manage';

// Dostupné záložky skupiny: chat a nástěnka podle nastavení, akce se zapnutým modulem Akce,
// členové vždy, správa jen správcům
export function groupTabs(group: Group, canManage: boolean, eventsModule = false): GroupSpaceTab[] {
  return [
    ...(hasChat(group) ? (['chat'] as const) : []),
    ...(hasBoard(group) ? (['board'] as const) : []),
    ...(eventsModule ? (['events'] as const) : []),
    'members',
    ...(canManage ? (['manage'] as const) : []),
  ];
}

// Výchozí záložka: nastavená (má-li skupina chat i nástěnku), jinak ta jediná zapnutá, jinak členové
export function defaultGroupTab(group: Group): GroupSpaceTab {
  if (hasChat(group) && hasBoard(group)) return group.defaultTab ?? 'board';
  if (hasChat(group)) return 'chat';
  if (hasBoard(group)) return 'board';
  return 'members';
}

export function resolveGroupTab(requested: string | null, group: Group, canManage: boolean, eventsModule = false): GroupSpaceTab {
  const tabs = groupTabs(group, canManage, eventsModule);
  return tabs.includes(requested as GroupSpaceTab) ? (requested as GroupSpaceTab) : defaultGroupTab(group);
}

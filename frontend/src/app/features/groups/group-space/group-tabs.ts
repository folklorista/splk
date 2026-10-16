import { Group } from '../../../core/models/group.model';
import { hasBoard, hasChat } from '../../../core/utils/visibility.utils';

export type GroupSpaceTab = 'chat' | 'board' | 'members' | 'manage';

// Dostupné záložky skupiny: chat a nástěnka podle nastavení, členové vždy, správa jen správcům
export function groupTabs(group: Group, canManage: boolean): GroupSpaceTab[] {
  return [
    ...(hasChat(group) ? (['chat'] as const) : []),
    ...(hasBoard(group) ? (['board'] as const) : []),
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

export function resolveGroupTab(requested: string | null, group: Group, canManage: boolean): GroupSpaceTab {
  const tabs = groupTabs(group, canManage);
  return tabs.includes(requested as GroupSpaceTab) ? (requested as GroupSpaceTab) : defaultGroupTab(group);
}

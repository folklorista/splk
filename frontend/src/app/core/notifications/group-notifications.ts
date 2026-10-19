// Volba upozornění pro skupinu – platí pro konkrétního člena a skupinu (docs/08 kap. 11.1)
// 'mentions' = zmínky + nové příspěvky, 'muted' = jen zmínky, 'off' = nic (ani zmínky)
export type GroupNotifyMode = 'all' | 'mentions' | 'muted' | 'off';

export const GROUP_NOTIFY_LABELS: Record<GroupNotifyMode, string> = {
  all: 'Vše',
  mentions: 'Jen důležité (zmínky a oznámení)',
  muted: 'Jen když mě někdo zmíní',
  off: 'Vypnuto',
};

// Ztlumený nebo vypnutý chat se nepočítá do badge (zprávy jsou dál vidět v záložce Chat)
export function isChatSilenced(mode: GroupNotifyMode): boolean {
  return mode === 'muted' || mode === 'off';
}

export type GroupActivityKind = 'chat-message' | 'post' | 'comment';

export interface GroupActivity {
  kind: GroupActivityKind;
  groupId: number;
  authorId: number;
  mentionedMemberIds: number[];
}

// Upozornit? Vlastní aktivita nikdy; bez přístupu k obsahu nikdy (oprávnění v okamžiku odeslání).
// „Vypnuto“ neupozorní na nic. Jinak zmínka upozorní vždy, nový příspěvek (oznámení) v režimech „Vše“
// a „Jen důležité“, běžná zpráva chatu a komentáře jen v režimu „Vše“.
export function shouldNotify(activity: GroupActivity, viewerId: number, canRead: boolean, mode: GroupNotifyMode): boolean {
  if (!canRead || activity.authorId === viewerId || mode === 'off') return false;
  if (activity.mentionedMemberIds.includes(viewerId)) return true;
  if (mode === 'muted') return false;
  if (activity.kind === 'post') return true;
  return mode === 'all';
}

// Volba upozornění pro skupinu – platí pro konkrétního člena a skupinu (docs/08 kap. 11.1)
export type GroupNotifyMode = 'all' | 'mentions' | 'muted';

export const GROUP_NOTIFY_LABELS: Record<GroupNotifyMode, string> = {
  all: 'Všechny zprávy',
  mentions: 'Jen zmínky a příspěvky',
  muted: 'Ztlumit chat',
};

export type GroupActivityKind = 'chat-message' | 'post' | 'comment';

export interface GroupActivity {
  kind: GroupActivityKind;
  groupId: number;
  authorId: number;
  mentionedMemberIds: number[];
}

// Upozornit? Vlastní aktivita nikdy; bez přístupu k obsahu nikdy (oprávnění v okamžiku odeslání).
// Zmínka upozorní vždy (i ve ztlumené skupině). Nový příspěvek je důležité sdělení – upozorní,
// pokud skupina není ztlumená. Běžná zpráva chatu a komentáře jen v režimu „Všechny zprávy“.
export function shouldNotify(activity: GroupActivity, viewerId: number, canRead: boolean, mode: GroupNotifyMode): boolean {
  if (!canRead || activity.authorId === viewerId) return false;
  if (activity.mentionedMemberIds.includes(viewerId)) return true;
  if (mode === 'muted') return false;
  if (activity.kind === 'post') return true;
  return mode === 'all';
}

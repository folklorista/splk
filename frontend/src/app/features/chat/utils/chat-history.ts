import { ChatHistoryMode, Group } from '../../../core/models/group.model';
import { Member, MembershipInterval } from '../../../core/models/member.model';

// Kdo vidí starší chat skupiny (docs/08 kap. 10.3):
// - zpráva z období s otevřenou historií je vidět každému, kdo smí číst obsah skupiny,
// - zpráva z období „od vstupu“ je vidět jen tomu, kdo byl v tu dobu členem.
// Přepnutí režimu proto zpětně nic neodkryje a mezera mezi dvěma členstvími zůstane skrytá.

export const DEFAULT_CHAT_HISTORY: ChatHistoryMode = 'open';

const time = (iso: string) => Date.parse(iso);

// Režim platný v daném okamžiku podle záznamu změn; bez záznamu platí aktuální režim odjakživa
export function chatHistoryModeAt(group: Pick<Group, 'chatHistory' | 'chatHistoryLog'>, at: string): ChatHistoryMode {
  const log = group.chatHistoryLog ?? [];
  let mode: ChatHistoryMode = log.length ? log[0].mode : (group.chatHistory ?? DEFAULT_CHAT_HISTORY);
  for (const entry of log) {
    if (time(entry.from) <= time(at)) mode = entry.mode;
  }
  return mode;
}

export function wasMemberAt(intervals: MembershipInterval[] | undefined, at: string): boolean {
  const t = time(at);
  return (intervals ?? []).some((i) => time(i.from) <= t && (!i.to || t < time(i.to)));
}

// Predikát viditelnosti pro konkrétního čtenáře (zprávy, náhledy komentářů a události v chatu, hledání)
export function chatVisibility(group: Pick<Group, 'id' | 'chatHistory' | 'chatHistoryLog'>, viewer: Pick<Member, 'groupIntervals' | 'groupIds'> | undefined): (at: string) => boolean {
  // Člen bez záznamu intervalů je členem od počátku
  const intervals = viewer?.groupIntervals?.[group.id] ?? (viewer?.groupIds.includes(group.id) ? [{ from: new Date(0).toISOString() }] : []);
  return (at) => chatHistoryModeAt(group, at) === 'open' || wasMemberAt(intervals, at);
}

// Změna režimu: doplní záznam, aby dosavadní období zůstala pod původním pravidlem
export function withChatHistoryChange(group: Group, mode: ChatHistoryMode, now: string): Pick<Group, 'chatHistory' | 'chatHistoryLog'> {
  const current = group.chatHistory ?? DEFAULT_CHAT_HISTORY;
  if (current === mode) return { chatHistory: group.chatHistory, chatHistoryLog: group.chatHistoryLog };
  const log = group.chatHistoryLog?.length ? [...group.chatHistoryLog] : [{ from: new Date(0).toISOString(), mode: current }];
  return { chatHistory: mode, chatHistoryLog: [...log, { from: now, mode }] };
}

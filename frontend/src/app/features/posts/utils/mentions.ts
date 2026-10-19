import { Member } from '../../../core/models/member.model';
import { nicknameKey } from '../../../core/utils/member.utils';

// Odkazy v textu (příspěvek, komentář, chat): zmínka člena @[member:ID] a odkaz na akci #[event:ID].
// Ukládá se jen ID – jméno i název akce se vykreslí z aktuálních dat (přejmenování odkaz nerozbije)
// a cíl odkazu odpovídá routě (/app/events/ID). Při psaní uživatel vidí „@Přezdívka“ / „#Název · d. M.“,
// na token se převede až při odeslání; při úpravě se tokeny převedou zpět na čitelný text.
const TOKEN = /@\[member:(\d+)\]|#\[event:(\d+)\]/g;
const MAX_QUERY_LENGTH = 40;

export type CommentSegment =
  | { type: 'text'; text: string }
  | { type: 'mention'; memberId: number }
  | { type: 'event'; eventId: number };

export type MentionTrigger = '@' | '#';

export interface MentionQuery {
  // pozice spouštěcího znaku „@“ (člen) nebo „#“ (akce)
  start: number;
  query: string;
  trigger: MentionTrigger;
}

// Minimum o akci pro nabídku a čitelný text
export interface EventRef {
  id: number;
  title: string;
  startsAt: string;
}

// Rozepsaná zmínka před kurzorem: „@“ nebo „#“ na začátku nebo po mezeře, za ním text bez zalomení řádku
export function activeMentionQuery(text: string, caret: number): MentionQuery | null {
  const before = text.slice(0, caret);
  const start = Math.max(before.lastIndexOf('@'), before.lastIndexOf('#'));
  if (start === -1) return null;
  if (start > 0 && !/\s/.test(before[start - 1])) return null;
  const query = before.slice(start + 1);
  if (query.includes('\n') || query.length > MAX_QUERY_LENGTH) return null;
  return { start, query, trigger: before[start] as MentionTrigger };
}

// Bez ohledu na diakritiku a velikost písmen; nejdřív ti, jejichž přezdívka dotazem začíná
export function filterMentionCandidates(members: Member[], query: string, limit = 6): Member[] {
  const q = nicknameKey(query);
  const matching = members.filter((m) => nicknameKey(m.nickname).includes(q));
  const starts = matching.filter((m) => nicknameKey(m.nickname).startsWith(q));
  const rest = matching.filter((m) => !nicknameKey(m.nickname).startsWith(q));
  return [...starts, ...rest].slice(0, limit);
}

// „Letní soustředění · 12. 7.“ – datum odliší termíny série se stejným názvem
export function eventMentionLabel(event: EventRef): string {
  const d = new Date(event.startsAt);
  return `${event.title} · ${d.getDate()}. ${d.getMonth() + 1}.`;
}

// Akce podle názvu nebo data; nejdřív nadcházející (nejbližší první), pak proběhlé (nejnovější první)
export function filterEventCandidates(events: EventRef[], query: string, limit = 6, now = new Date()): EventRef[] {
  const q = nicknameKey(query);
  const matching = events.filter((e) => nicknameKey(eventMentionLabel(e)).includes(q));
  const upcoming = matching.filter((e) => new Date(e.startsAt) >= now).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const past = matching.filter((e) => new Date(e.startsAt) < now).sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  return [...upcoming, ...past].slice(0, limit);
}

function insertText(text: string, mention: MentionQuery, caret: number, inserted: string): { text: string; caret: number } {
  return {
    text: text.slice(0, mention.start) + inserted + text.slice(caret),
    caret: mention.start + inserted.length,
  };
}

// Nahradí rozepsané „@Jak“ za „@Jakub “ a vrátí novou pozici kurzoru
export function insertMention(text: string, mention: MentionQuery, caret: number, member: Member): { text: string; caret: number } {
  return insertText(text, mention, caret, `@${member.nickname} `);
}

// Nahradí rozepsané „#Letn“ za „#Letní soustředění · 12. 7. “
export function insertEventMention(text: string, mention: MentionQuery, caret: number, event: EventRef): { text: string; caret: number } {
  return insertText(text, mention, caret, `#${eventMentionLabel(event)} `);
}

// Při odeslání: „@Přezdívka“ vybraných členů a „#Název · d. M.“ vybraných akcí → tokeny.
// Když uživatel text mezitím přepsal, odkaz se neuloží.
export function encodeMentions(text: string, selected: Member[], selectedEvents: EventRef[] = []): { body: string; mentionedMemberIds: number[] } {
  let body = text;
  const mentioned: number[] = [];
  // Delší texty první, aby „@Kuba D“ nepřebila „@Kuba“
  for (const member of [...selected].sort((a, b) => b.nickname.length - a.nickname.length)) {
    const needle = `@${member.nickname}`;
    if (!body.includes(needle)) continue;
    body = body.split(needle).join(`@[member:${member.id}]`);
    if (!mentioned.includes(member.id)) mentioned.push(member.id);
  }
  for (const event of [...selectedEvents].sort((a, b) => eventMentionLabel(b).length - eventMentionLabel(a).length)) {
    const needle = `#${eventMentionLabel(event)}`;
    if (body.includes(needle)) body = body.split(needle).join(`#[event:${event.id}]`);
  }
  return { body, mentionedMemberIds: mentioned };
}

// Úprava uloženého textu: tokeny zpět na čitelný text a seznamy odkazovaných členů a akcí
export function decodeMentions(body: string, members: Member[], events: EventRef[]): { text: string; members: Member[]; events: EventRef[] } {
  const usedMembers: Member[] = [];
  const usedEvents: EventRef[] = [];
  const text = body.replace(TOKEN, (token, memberId, eventId) => {
    if (memberId) {
      const member = members.find((m) => m.id === Number(memberId));
      if (!member) return token;
      if (!usedMembers.includes(member)) usedMembers.push(member);
      return `@${member.nickname}`;
    }
    const event = events.find((e) => e.id === Number(eventId));
    if (!event) return token;
    if (!usedEvents.includes(event)) usedEvents.push(event);
    return `#${eventMentionLabel(event)}`;
  });
  return { text, members: usedMembers, events: usedEvents };
}

// Pro vykreslení v šabloně (žádné innerHTML → žádné XSS)
export function parseCommentBody(body: string): CommentSegment[] {
  const segments: CommentSegment[] = [];
  let last = 0;
  for (const match of body.matchAll(TOKEN)) {
    if (match.index! > last) segments.push({ type: 'text', text: body.slice(last, match.index) });
    segments.push(match[1] ? { type: 'mention', memberId: Number(match[1]) } : { type: 'event', eventId: Number(match[2]) });
    last = match.index! + match[0].length;
  }
  if (last < body.length) segments.push({ type: 'text', text: body.slice(last) });
  return segments;
}

// Čistý text (hledání, upozornění, náhledy): zmínky jako „@Přezdívka“, akce jako „#Název“
export function plainText(body: string, memberName: (id: number) => string, eventTitle: (id: number) => string | undefined): string {
  return parseCommentBody(body)
    .map((s) => (s.type === 'mention' ? `@${memberName(s.memberId)}` : s.type === 'event' ? `#${eventTitle(s.eventId) ?? 'akce'}` : s.text))
    .join('');
}

export function mentionToken(memberId: number): string {
  return `@[member:${memberId}]`;
}

export function eventToken(eventId: number): string {
  return `#[event:${eventId}]`;
}

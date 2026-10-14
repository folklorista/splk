import { Member } from '../../../core/models/member.model';
import { nicknameKey } from '../../../core/utils/member.utils';

// Zmínka je v uloženém textu komentáře token @[member:ID] – přežije i změnu přezdívky.
// Při psaní uživatel vidí „@Přezdívka“, na token se převede až při odeslání.
const TOKEN = /@\[member:(\d+)\]/g;
const MAX_QUERY_LENGTH = 30;

export type CommentSegment = { type: 'text'; text: string } | { type: 'mention'; memberId: number };

export interface MentionQuery {
  // pozice znaku „@“
  start: number;
  query: string;
}

// Rozepsaná zmínka před kurzorem: „@“ na začátku nebo po mezeře, za ním text bez zalomení řádku
export function activeMentionQuery(text: string, caret: number): MentionQuery | null {
  const before = text.slice(0, caret);
  const at = before.lastIndexOf('@');
  if (at === -1) return null;
  if (at > 0 && !/\s/.test(before[at - 1])) return null;
  const query = before.slice(at + 1);
  if (query.includes('\n') || query.length > MAX_QUERY_LENGTH) return null;
  return { start: at, query };
}

// Bez ohledu na diakritiku a velikost písmen; nejdřív ti, jejichž přezdívka dotazem začíná
export function filterMentionCandidates(members: Member[], query: string, limit = 6): Member[] {
  const q = nicknameKey(query);
  const matching = members.filter((m) => nicknameKey(m.nickname).includes(q));
  const starts = matching.filter((m) => nicknameKey(m.nickname).startsWith(q));
  const rest = matching.filter((m) => !nicknameKey(m.nickname).startsWith(q));
  return [...starts, ...rest].slice(0, limit);
}

// Nahradí rozepsané „@Jak“ za „@Jakub “ a vrátí novou pozici kurzoru
export function insertMention(text: string, mention: MentionQuery, caret: number, member: Member): { text: string; caret: number } {
  const inserted = `@${member.nickname} `;
  return {
    text: text.slice(0, mention.start) + inserted + text.slice(caret),
    caret: mention.start + inserted.length,
  };
}

// Při odeslání: „@Přezdívka“ vybraných členů → token. Když uživatel jméno mezitím přepsal, zmínka se neuloží.
export function encodeMentions(text: string, selected: Member[]): { body: string; mentionedMemberIds: number[] } {
  let body = text;
  const mentioned: number[] = [];
  // Delší přezdívky první, aby „@Kuba D“ nepřebila „@Kuba“
  for (const member of [...selected].sort((a, b) => b.nickname.length - a.nickname.length)) {
    const needle = `@${member.nickname}`;
    if (!body.includes(needle)) continue;
    body = body.split(needle).join(`@[member:${member.id}]`);
    if (!mentioned.includes(member.id)) mentioned.push(member.id);
  }
  return { body, mentionedMemberIds: mentioned };
}

// Pro vykreslení v šabloně (žádné innerHTML → žádné XSS)
export function parseCommentBody(body: string): CommentSegment[] {
  const segments: CommentSegment[] = [];
  let last = 0;
  for (const match of body.matchAll(TOKEN)) {
    if (match.index! > last) segments.push({ type: 'text', text: body.slice(last, match.index) });
    segments.push({ type: 'mention', memberId: Number(match[1]) });
    last = match.index! + match[0].length;
  }
  if (last < body.length) segments.push({ type: 'text', text: body.slice(last) });
  return segments;
}

export function mentionToken(memberId: number): string {
  return `@[member:${memberId}]`;
}

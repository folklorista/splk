import { ChatMessage } from '../models/chat-message.model';
import { GROUP_IDS } from '../../../core/data/mock-groups';
import { Member } from '../../../core/models/member.model';
import { otherDemoMember } from '../../members/data/demo-authors';
import { mentionToken } from '../../posts/utils/mentions';

const { vybor, tanecni, muzika, kluci, holky, sklad } = GROUP_IDS;

// Čas relativně k dnešku (minuty zpět), aby demo chat nezestárl
function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

const HOUR = 60;
const DAY = 24 * HOUR;

let nextId = 1;
function msg(groupId: number, author: Member | undefined, body: string, ago: number, mentioned: (Member | undefined)[] = []): ChatMessage[] {
  if (!author || mentioned.some((m) => !m)) return [];
  const members = mentioned as Member[];
  return [{
    id: nextId++,
    groupId,
    authorId: author.id,
    body: members.reduce((text, m, i) => text.replace(`{${i}}`, mentionToken(m.id)), body),
    mentionedMemberIds: members.map((m) => m.id),
    createdAt: minutesAgo(ago),
  }];
}

// Autoři se vybírají ze členů skupiny (demo běží s vymyšlenými i reálnými členy)
const of = (groupId: number, nth: number, exclude: (Member | undefined)[] = []) =>
  otherDemoMember([groupId], nth, exclude.filter(Boolean).map((m) => m!.id));

const h1 = of(holky, 1);
const h2 = of(holky, 4, [h1]);
const h3 = of(holky, 6, [h1, h2]);
const k1 = of(kluci, 1);
const k2 = of(kluci, 3, [k1]);
const m1 = of(muzika, 0);
const m2 = of(muzika, 1, [m1]);
const v1 = of(vybor, 0);
const v2 = of(vybor, 2, [v1]);
const t1 = of(tanecni, 5);
const t2 = of(tanecni, 9, [t1]);
const s1 = of(sklad, 0);

export const MOCK_CHAT_MESSAGES: ChatMessage[] = [
  ...msg(holky, h1, 'Holky, kdo jde v sobotu na zkoušku zpěvů?', 2 * DAY + 3 * HOUR),
  ...msg(holky, h2, 'Já určitě, vezmu i zpěvník.', 2 * DAY + 2 * HOUR),
  ...msg(holky, h3, 'Je tu někdo? Neměly jsme na 19 h sraz?', 5 * HOUR + 50),
  ...msg(holky, h1, 'Jsme dole na pivu 🙂', 5 * HOUR + 49),
  ...msg(holky, h2, '{0} díky za fotky ze včerejška!', 40, [h1]),
  ...msg(kluci, k1, 'Kluci, obchůzka začíná v 8:30 u kostela.', DAY + 4 * HOUR),
  ...msg(kluci, k2, 'Beru basu a pentli.', DAY + 3 * HOUR),
  ...msg(kluci, k1, 'Kdo nemá klobouk, ozvěte se do pátku.', 3 * HOUR),
  ...msg(muzika, m1, 'Zítra ladíme v 17:30, cimbál už je na sále.', 7 * HOUR),
  ...msg(muzika, m2, 'Dorazím až v 18:00, mám službu.', 6 * HOUR),
  ...msg(vybor, v1, 'Program schůze je na nástěnce, prosím doplňte body.', DAY + 6 * HOUR),
  ...msg(vybor, v2, 'Doplnil jsem rozpočet na hody.', DAY + 2 * HOUR),
  ...msg(tanecni, t1, 'Nezapomeňte na pátek – zkoušíme nový tanec.', 9 * HOUR),
  ...msg(tanecni, t2, 'Super, těším se!', 8 * HOUR),
  ...msg(sklad, s1, 'Dnes jsem vyprala šátky, jsou ve skříni č. 3.', 2 * DAY),
];

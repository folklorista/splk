import { PostComment } from '../models/comment.model';
import { GROUP_IDS } from '../../../core/data/mock-groups';
import { Member } from '../../../core/models/member.model';
import { demoMember, otherDemoMember } from '../../members/data/demo-authors';
import { MOCK_MEMBERS } from '../../members/data/mock-members';
import { MOCK_POSTS, daysAgo } from './mock-posts';
import { mentionToken } from '../utils/mentions';

const { vybor, tanecni, muzika, kluci, holky, malaVonica, sklad } = GROUP_IDS;

let nextId = 1;
function comment(postId: number, author: Member | undefined, body: string, createdDaysAgo: number, hour: number, mentioned: (Member | undefined)[] = []): PostComment[] {
  if (!author || mentioned.some((m) => !m)) return [];
  const members = mentioned as Member[];
  return [{
    id: nextId++,
    postId,
    authorId: author.id,
    body: members.reduce((text, m, i) => text.replace(`{${i}}`, mentionToken(m.id)), body),
    createdAt: daysAgo(createdDaysAgo, hour),
    mentionedMemberIds: members.map((m) => m.id),
    seenByMemberIds: [],
  }];
}

const authorOf = (postId: number) => MOCK_POSTS.find((p) => p.id === postId)!.authorId;


// Taneční: dotaz k soustředění, žádosti o výměnu krojových součástek → odpovídá Sklad
const camper = otherDemoMember([tanecni], 4, [authorOf(1)]);
const committee = otherDemoMember([vybor, tanecni], 0, [camper?.id ?? 0]);
const swapper = otherDemoMember([tanecni], 6, [authorOf(4)]);
const shirtNeeder = otherDemoMember([tanecni], 7, [authorOf(4), swapper?.id ?? 0]);
const storekeeper = otherDemoMember([sklad, tanecni], 0, [swapper?.id ?? 0]);
// Muzika: kdo může hrát – různí členové Muziky kromě autora (skupina může být malá)
const musicians = MOCK_MEMBERS.filter((m) => m.isActive && m.groupIds.includes(muzika) && m.id !== authorOf(6));
// Kluci: obchůzka
const boy = otherDemoMember([kluci], 2, [authorOf(8)]);
// Holky: zpěvy
const girl = otherDemoMember([holky], 3, [authorOf(9)]);
// Malá Vonica, Sklad: domluva uvnitř skupiny
const childrenLeader = otherDemoMember([malaVonica], 1, [authorOf(10)]);
const seamstress = otherDemoMember([sklad], 1, [authorOf(11)]);

export const MOCK_COMMENTS: PostComment[] = [
  // comment() vrací pole – prázdné, když pro komentář není vhodný člen
  ...comment(1, camper, '{0} staví autobus i na zastávce u nádraží?', 5, 8, [committee]),
  ...comment(1, committee, '{0} ano, v 15:10 u nádraží.', 5, 12, [camper]),

  ...comment(4, swapper, 'Potřebuju vyměnit kordulku za menší, ta současná je mi velká. Ideálně do pátečního nácviku.', 3, 19),
  ...comment(4, storekeeper, '{0} menší kordulku máme, přines tu svoji ve čtvrtek do skladu (18–19 h) a vyměníme.', 2, 9, [swapper]),
  ...comment(4, shirtNeeder, 'Prosím o rukávce velikosti L, na jedněch mi chybí knoflík.', 1, 20),

  ...[
    'Můžu, kontr mám.',
    'Já mám ten den svatbu v rodině, nemůžu.',
    'Basa může, jen budu potřebovat odvoz.',
  ].flatMap((text, i) => comment(6, musicians[i], text, 1, 20 + i)),

  ...comment(8, boy, 'Pomlázku mám, ale koš na vajíčka zase ponesu já? :)', 4, 18),

  ...comment(9, girl, 'Nahrála jsem melodii do sdílené složky, ať se to dá doma procvičit.', 6, 21),

  ...comment(10, childrenLeader, '15. listopadu nemůžu, vyměním si to s někým za 22.', 3, 17),

  ...comment(11, seamstress, 'Souhlas. Jen bych přidala ještě dvě zástěry, ty staré jsou už hodně sešlé.', 2, 18),
];

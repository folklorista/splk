import { PostComment } from '../models/comment.model';
import { GROUP_IDS } from '../../../core/data/mock-groups';
import { Member } from '../../../core/models/member.model';
import { demoMember } from '../../members/data/demo-authors';
import { MOCK_POSTS, daysAgo } from './mock-posts';

const { vybor, tanecni, holky, malaVonica, sklad } = GROUP_IDS;

let nextId = 1;
function comment(postId: number, author: Member, body: string, createdDaysAgo: number, hour: number, mentioned: Member[] = []): PostComment {
  return {
    id: nextId++,
    postId,
    authorId: author.id,
    body: mentioned.reduce((text, m, i) => text.replace(`{${i}}`, `@${m.nickname}`), body),
    createdAt: daysAgo(createdDaysAgo, hour),
    mentionedMemberIds: mentioned.map((m) => m.id),
    seenByMemberIds: [],
  };
}

const authorOf = (postId: number) => MOCK_POSTS.find((p) => p.id === postId)!.authorId;

// Dotazy na kroje odpovídá Sklad, na dětský soubor Malá Vonica, na organizaci výbor
const camper = demoMember([tanecni], 4, [authorOf(1)]);
const storekeeper = demoMember([sklad, tanecni]);
const helper = demoMember([tanecni], 5, [authorOf(4)]);
const parent = demoMember([malaVonica], 1, [authorOf(6)]);
const childrenLeader = demoMember([malaVonica], 0);
const girl = demoMember([holky], 2, [authorOf(8)]);
const girlsStorekeeper = demoMember([sklad, holky]);
const committee = demoMember([vybor, tanecni]);

export const MOCK_COMMENTS: PostComment[] = [
  comment(1, camper, 'Budou na soustředění potřeba kroje, nebo si je máme vzít ze skladu?', 5, 18),
  comment(1, storekeeper, '{0} kroje přivezeme ze skladu my, vlastní si vezměte jen boty a košili.', 5, 20, [camper]),
  comment(1, camper, 'Díky! {0}, staví autobus i na zastávce u nádraží?', 4, 8, [committee]),
  comment(4, helper, 'V sobotu dopoledne můžu pomoct.', 1, 19),
  comment(6, parent, 'Od kolika let můžou děti začít a co si mají na zkoušku vzít?', 4, 12),
  comment(6, childrenLeader, '{0} od 5 let, stačí cvičky, pohodlné oblečení a pití.', 4, 17, [parent]),
  comment(8, girl, 'Kde přesně si šátky ve skladu vyzvednu a kdy je otevřeno?', 6, 10),
  comment(8, girlsStorekeeper, '{0} sklad je otevřený ve čtvrtek 18–19 h, šátky jsou v krabici u vchodu.', 6, 15, [girl]),
];

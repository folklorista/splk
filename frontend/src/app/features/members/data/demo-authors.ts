import { Member } from '../../../core/models/member.model';
import { MOCK_MEMBERS } from './mock-members';

// Autoři ukázkového obsahu (příspěvky, komentáře) se vybírají podle skupin, ne pevným ID –
// v demu s reálnými členy tak oznámení výboru píše někdo z výboru, na kroje odpovídá Sklad atd.
// Výběr je deterministický (n-tý vhodný člen), aby data byla při každém načtení stejná.

const activeMembers = (): Member[] => MOCK_MEMBERS.filter((m) => m.isActive);

// n-tý aktivní člen, který je ve VŠECH zadaných skupinách. Když takový není, hledá se jen
// v poslední skupině (typicky nástěnka, kam se píše – psát tam smí jen její členové).
export function demoMember(groupIds: number[], nth = 0, excludeIds: number[] = []): Member {
  const pick = (candidates: Member[]) => {
    const allowed = candidates.filter((m) => !excludeIds.includes(m.id));
    return allowed.length ? allowed[nth % allowed.length] : undefined;
  };
  const inAll = activeMembers().filter((m) => groupIds.every((g) => m.groupIds.includes(g)));
  const inLast = activeMembers().filter((m) => m.groupIds.includes(groupIds[groupIds.length - 1]));
  const member = pick(inAll) ?? pick(inLast) ?? pick(activeMembers());
  if (!member) throw new Error('Demo data need at least one active member');
  return member;
}

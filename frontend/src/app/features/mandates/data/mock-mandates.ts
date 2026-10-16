import { Mandate, MandateKind } from '../../../core/models/mandate.model';
import { Member } from '../../../core/models/member.model';
import { GROUP_IDS } from '../../../core/data/mock-groups';
import { MOCK_ENSEMBLE_ADMIN_IDS, MOCK_MEMBERS } from '../../members/data/mock-members';
import { nicknameKey } from '../../../core/utils/member.utils';

// Výchozí pověření demo dat – převod dřívějších pevných rolí (docs/08 kap. 12, etapa A bod 6):
// - příznak „administrátor“ → Správa souboru a Organizace akcí (dřív spravoval akce v administraci),
// - Výbor (dřív role vedoucí) → Evidence docházky a Náhled do krojárky,
// - skupina Sklad → Správa krojů,
// - hlavní správci a spolusprávci skupin podle docs/08 kap. 6.2.
// Demo běží s reálnými (lokálně importovanými) i s vymyšlenými členy, proto se správci vybírají
// podle přezdívky a když chybí, vezme se první aktivní člen skupiny.

const SEED_DATE = '2026-10-16T00:00:00';

const GROUP_MANAGERS: Record<number, { owner: string[]; deputies: string[] }> = {
  [GROUP_IDS.vybor]: { owner: ['Ivoš', 'Vedoucí'], deputies: ['Kuba D', 'Admin'] },
  [GROUP_IDS.tanecni]: { owner: ['Kuba D', 'Vedoucí'], deputies: ['Tezi', 'Aňyčka', 'Staňa', 'Admin'] },
  [GROUP_IDS.muzika]: { owner: ['Pája', 'Karlos'], deputies: [] },
  [GROUP_IDS.kluci]: { owner: ['Staňa', 'Vedoucí'], deputies: ['Kuba D', 'Péťa'] },
  [GROUP_IDS.holky]: { owner: ['Aňyčka', 'Jana'], deputies: ['Tezi', 'Admin'] },
  [GROUP_IDS.malaVonica]: { owner: ['Marci', 'Lucka'], deputies: [] },
  [GROUP_IDS.sklad]: { owner: ['Lucka Š', 'Maky'], deputies: [] },
};

export function seedMandates(members: Member[] = MOCK_MEMBERS, adminIds: number[] = MOCK_ENSEMBLE_ADMIN_IDS): Mandate[] {
  const active = members.filter((m) => m.isActive);
  const mandates: Mandate[] = [];
  const add = (memberId: number, kind: MandateKind, groupId?: number) =>
    mandates.push({ id: mandates.length + 1, memberId, kind, ...(groupId ? { groupId } : {}), grantedAt: SEED_DATE });

  for (const id of adminIds) {
    if (!active.some((m) => m.id === id)) continue;
    add(id, 'ensemble-admin');
    add(id, 'events');
  }

  for (const [groupIdKey, seed] of Object.entries(GROUP_MANAGERS)) {
    const groupId = Number(groupIdKey);
    const inGroup = active.filter((m) => m.groupIds.includes(groupId));
    const byNickname = (nickname: string) => inGroup.find((m) => nicknameKey(m.nickname) === nicknameKey(nickname));
    const owner = seed.owner.map(byNickname).find(Boolean) ?? inGroup[0];
    if (!owner) continue;
    add(owner.id, 'group-owner', groupId);
    seed.deputies
      .map(byNickname)
      .filter((m): m is Member => !!m && m.id !== owner.id)
      .forEach((m) => add(m.id, 'group-deputy', groupId));
  }

  for (const member of active) {
    const inVybor = member.groupIds.includes(GROUP_IDS.vybor);
    const inSklad = member.groupIds.includes(GROUP_IDS.sklad);
    if (inVybor) add(member.id, 'attendance');
    if (inSklad) add(member.id, 'costumes');
    else if (inVybor || adminIds.includes(member.id)) add(member.id, 'costumes-view');
  }

  return mandates;
}

// Souborové funkce ze vzorového scénáře (docs/08 kap. 6.1) – jen informativní popisky
export const DEMO_FUNCTION_TITLES: Record<string, string> = {
  'Kuba D': 'Organizační vedoucí',
  'Aňyčka': 'Vedoucí holek',
  'Áďa': 'Kronikářka',
  'Tezi': 'Umělecká vedoucí',
  'Staňa': 'Vedoucí kluků',
  'Lucka Š': 'Krojárka',
  'Ivoš': 'Hlavní vedoucí',
  'Marci': 'Vedoucí dětského souboru',
  'Lucka Z': 'Ekonomka',
  'Vedoucí': 'Hlavní vedoucí',
  'Admin': 'Organizační vedoucí',
  'Maky': 'Krojárka',
};

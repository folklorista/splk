import { AuditEntry } from '../audit.model';
import { GROUP_IDS } from '../../../core/data/mock-groups';
import { MOCK_MEMBERS } from '../../members/data/mock-members';
import { seedMandates } from '../../mandates/data/mock-mandates';

// Ukázková historie, aby chat skupin ukazoval i neutrální systémové události (docs/08 kap. 8.2)
export function seedAudit(): AuditEntry[] {
  const mandates = seedMandates();
  const ownerOf = (groupId: number) => mandates.find((m) => m.kind === 'group-owner' && m.groupId === groupId)?.memberId;
  const memberOf = (groupId: number, nth: number) => MOCK_MEMBERS.filter((m) => m.isActive && m.groupIds.includes(groupId) && m.id !== ownerOf(groupId))[nth]?.id;
  const ago = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

  const entries: Omit<AuditEntry, 'id'>[] = [
    { at: ago(30), actorId: ownerOf(GROUP_IDS.holky) ?? 0, action: 'member-added', groupIds: [GROUP_IDS.holky], memberId: memberOf(GROUP_IDS.holky, 5) },
    { at: ago(20), actorId: memberOf(GROUP_IDS.kluci, 2) ?? 0, action: 'member-joined', groupIds: [GROUP_IDS.kluci], memberId: memberOf(GROUP_IDS.kluci, 2) },
  ];
  return entries.filter((e) => e.actorId && e.memberId).map((e, i) => ({ ...e, id: i + 1 }));
}

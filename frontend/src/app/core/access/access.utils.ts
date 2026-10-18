import { Group, isGroupArchived } from '../models/group.model';
import { Mandate, MandateKind } from '../models/mandate.model';
import { EnsembleSettings } from '../models/ensemble-settings.model';
import { Member } from '../models/member.model';

// Vyhodnocení přístupu: osoba + činnost + konkrétní objekt (docs/08 kap. 3.5).
// Čisté funkce – stejná pravidla bude zrcadlit backend; skrytí tlačítka není bezpečnostní opatření.
// Při pochybnosti se přístup nepovolí.

export interface AccessSubject {
  memberId: number;
  groupIds: number[];
  isExternal: boolean;
  mandates: Mandate[];
}

export interface EventScope {
  id: number;
  targetGroupIds: number[];
  guestMemberIds?: number[];
  organizerGroupIds?: number[];
}

export type GroupRole = 'owner' | 'deputy';

export function toAccessSubject(member: Member, mandates: Mandate[]): AccessSubject {
  return {
    memberId: member.id,
    groupIds: member.isActive ? member.groupIds : [],
    isExternal: !!member.isExternal,
    // Bývalý člen nemá žádná platná pověření
    mandates: member.isActive ? mandates.filter((m) => m.memberId === member.id) : [],
  };
}

function hasKind(s: AccessSubject | null, kind: MandateKind): Mandate[] {
  return s ? s.mandates.filter((m) => m.kind === kind) : [];
}

// --- Soubor ---

export function isEnsembleAdmin(s: AccessSubject | null): boolean {
  return hasKind(s, 'ensemble-admin').length > 0;
}

export function canCreateGroup(s: AccessSubject | null, settings: Pick<EnsembleSettings, 'groupCreation'>): boolean {
  if (!s) return false;
  return isEnsembleAdmin(s) || (settings.groupCreation === 'members' && !s.isExternal);
}

// --- Skupiny ---

export function isGroupMember(s: AccessSubject | null, groupId: number): boolean {
  return !!s && s.groupIds.includes(groupId);
}

export function groupRole(s: AccessSubject | null, groupId: number): GroupRole | null {
  if (hasKind(s, 'group-owner').some((m) => m.groupId === groupId)) return 'owner';
  if (hasKind(s, 'group-deputy').some((m) => m.groupId === groupId)) return 'deputy';
  return null;
}

export function isGroupManager(s: AccessSubject | null, groupId: number): boolean {
  return groupRole(s, groupId) !== null;
}

// Znát existenci skupiny není totéž co číst její obsah
export function canSeeGroup(s: AccessSubject | null, group: Group): boolean {
  if (!s) return false;
  if (isGroupMember(s, group.id) || isGroupManager(s, group.id) || isEnsembleAdmin(s)) return true;
  return (group.visibility ?? 'private') !== 'hidden' && !s.isExternal;
}

// Čtení chatu a nástěnky: členství, u otevřené skupiny i ostatní členové souboru.
// Správa souboru ani technická správa skupiny obsah neodemyká.
export function canReadGroupContent(s: AccessSubject | null, group: Group): boolean {
  if (!s) return false;
  if (isGroupMember(s, group.id)) return true;
  return group.visibility === 'open' && !s.isExternal;
}

// Archivovaná skupina je jen ke čtení – nikdo do ní nepíše ani ji nemoderuje
export function canPostInGroup(s: AccessSubject | null, group: Group): boolean {
  return isGroupMember(s, group.id) && !isGroupArchived(group);
}

// Moderovat (připnout, skrýt, archivovat cizí příspěvek) smí správce skupiny, který obsah oprávněně čte
export function canModerateGroup(s: AccessSubject | null, group: Group): boolean {
  return isGroupManager(s, group.id) && canReadGroupContent(s, group) && !isGroupArchived(group);
}

// Statistiky čtenosti patří k obsahu – jen správce skupiny, který obsah čte
export function canSeeReadStats(s: AccessSubject | null, group: Group): boolean {
  return canModerateGroup(s, group);
}

// Členství (žádosti, pozvánky, přidání, odebrání) a komunikační volby (chat, nástěnka, výchozí záložka)
export function canManageGroupMembership(s: AccessSubject | null, groupId: number): boolean {
  return isEnsembleAdmin(s) || isGroupManager(s, groupId);
}

export function canEditGroupCommunication(s: AccessSubject | null, groupId: number): boolean {
  return isEnsembleAdmin(s) || isGroupManager(s, groupId);
}

// Název, slug, ikona, popis, viditelnost – správa souboru a hlavní správce
export function canEditGroupMetadata(s: AccessSubject | null, groupId: number): boolean {
  return isEnsembleAdmin(s) || groupRole(s, groupId) === 'owner';
}

// Spolusprávce dál pověřovat nesmí (docs/08 kap. 3.2) – jen hlavní správce a správa souboru
export function canAssignGroupManagers(s: AccessSubject | null, groupId: number): boolean {
  return isEnsembleAdmin(s) || groupRole(s, groupId) === 'owner';
}

// Archivovat a obnovit smí hlavní správce a Správa souboru; smazat jen Správa souboru a jen archivovanou skupinu
export function canArchiveGroup(s: AccessSubject | null, groupId: number): boolean {
  return canEditGroupMetadata(s, groupId);
}

export function canDeleteGroup(s: AccessSubject | null, group?: Group): boolean {
  return isEnsembleAdmin(s) && (!group || isGroupArchived(group));
}

// Do otevřené skupiny lze vstoupit hned, do soukromé jen žádostí, do skryté jen na pozvání
export function canJoinDirectly(s: AccessSubject | null, group: Group): boolean {
  return !!s && !s.isExternal && group.visibility === 'open' && !isGroupMember(s, group.id) && !isGroupArchived(group);
}

export function canRequestToJoin(s: AccessSubject | null, group: Group): boolean {
  return !!s && !s.isExternal && (group.visibility ?? 'private') === 'private' && !isGroupMember(s, group.id) && !isGroupArchived(group);
}

// Navrhnout nového člena smí kterýkoli člen skupiny; rozhoduje správce a pak pozvaný
export function canProposeMember(s: AccessSubject | null, group: Group): boolean {
  return isGroupMember(s, group.id) && !isGroupArchived(group);
}

// --- Akce ---

function inEventScope(mandates: Mandate[], event: EventScope, groupIds: number[]): boolean {
  return mandates.some(
    (m) =>
      (m.groupId === undefined && m.eventId === undefined) ||
      (m.eventId !== undefined && m.eventId === event.id) ||
      (m.groupId !== undefined && groupIds.includes(m.groupId)),
  );
}

// Kdo je akcí osloven (má potvrzovat účast): hosté, členové cílových skupin; akce bez cílení = celý soubor
export function isEventAudience(
  member: Pick<Member, 'id' | 'groupIds' | 'isActive' | 'isExternal'>,
  event: Pick<EventScope, 'targetGroupIds' | 'guestMemberIds'>,
): boolean {
  if (!member.isActive) return false;
  if (event.guestMemberIds?.includes(member.id)) return true;
  if (!event.targetGroupIds?.length) return !member.isExternal;
  return event.targetGroupIds.some((g) => member.groupIds.includes(g));
}

export function canSeeEvent(s: AccessSubject | null, event: EventScope): boolean {
  if (!s) return false;
  if (event.guestMemberIds?.includes(s.memberId)) return true;
  if (canEditEvent(s, event) || canRecordAttendance(s, event)) return true;
  if (!event.targetGroupIds?.length) return !s.isExternal;
  return event.targetGroupIds.some((g) => s.groupIds.includes(g));
}

// Založit akci: pověření pro celý soubor nebo pro skupinu (pak akci pořádá ta skupina)
export function canCreateEvents(s: AccessSubject | null): boolean {
  return hasKind(s, 'events').some((m) => m.eventId === undefined);
}

// Skupiny, za které smí založit akci (prázdné + ensembleWide = libovolná)
export function eventOrganizerScope(s: AccessSubject | null): { ensembleWide: boolean; groupIds: number[] } {
  const mandates = hasKind(s, 'events');
  return {
    ensembleWide: mandates.some((m) => m.groupId === undefined && m.eventId === undefined),
    groupIds: mandates.filter((m) => m.groupId !== undefined).map((m) => m.groupId!),
  };
}

export function canEditEvent(s: AccessSubject | null, event: EventScope): boolean {
  return inEventScope(hasKind(s, 'events'), event, event.organizerGroupIds ?? []);
}

// Skutečnou docházku zapisuje pověřený správce docházky v rozsahu (soubor / skupina pořádající nebo
// pozvaná / akce) a organizátor konkrétní akce
export function canRecordAttendance(s: AccessSubject | null, event: EventScope): boolean {
  const groups = [...(event.organizerGroupIds ?? []), ...(event.targetGroupIds ?? [])];
  if (inEventScope(hasKind(s, 'attendance'), event, groups)) return true;
  return hasKind(s, 'events').some((m) => m.eventId === event.id);
}

// Počty odpovědí a kdo akci viděl – kdo akci spravuje nebo eviduje její docházku
export function canSeeEventResponses(s: AccessSubject | null, event: EventScope): boolean {
  return canEditEvent(s, event) || canRecordAttendance(s, event);
}

export function canViewAttendanceReport(s: AccessSubject | null): boolean {
  return hasKind(s, 'attendance').length > 0;
}

// --- Kroje ---

export function canManageCostumes(s: AccessSubject | null): boolean {
  return hasKind(s, 'costumes').length > 0;
}

export function canViewCostumeStock(s: AccessSubject | null): boolean {
  return canManageCostumes(s) || hasKind(s, 'costumes-view').length > 0;
}

// --- Náhled skutečných přístupů (Správa → detail osoby) ---

export interface AccessOverview {
  readableGroupIds: number[];
  // Spravuje technicky, ale obsah nečte
  managedWithoutContentGroupIds: number[];
  ensembleAdmin: boolean;
  events: 'none' | 'ensemble' | 'scoped';
  attendance: 'none' | 'ensemble' | 'scoped';
  costumes: 'none' | 'view' | 'manage';
}

export function accessOverview(s: AccessSubject | null, groups: Group[]): AccessOverview {
  const scopeOf = (kind: MandateKind) => {
    const list = hasKind(s, kind);
    if (!list.length) return 'none' as const;
    return list.some((m) => m.groupId === undefined && m.eventId === undefined) ? ('ensemble' as const) : ('scoped' as const);
  };
  return {
    readableGroupIds: groups.filter((g) => canReadGroupContent(s, g)).map((g) => g.id),
    managedWithoutContentGroupIds: groups.filter((g) => isGroupManager(s, g.id) && !canReadGroupContent(s, g)).map((g) => g.id),
    ensembleAdmin: isEnsembleAdmin(s),
    events: scopeOf('events'),
    attendance: scopeOf('attendance'),
    costumes: canManageCostumes(s) ? 'manage' : canViewCostumeStock(s) ? 'view' : 'none',
  };
}

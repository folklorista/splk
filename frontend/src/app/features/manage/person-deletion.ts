import { AuditAction, AuditEntry } from '../audit/audit.model';
import { CostumeState } from '../costumes/models/costume.model';

// Trvalé smazání osoby je jen pro „čistou“ osobu (typicky založenou omylem). Jakmile o ní evidence
// něco ví (odpovědi, docházka, obsah, kroje, vlastní činnost v historii), zůstává – lze jen ukončit
// členství / vyřadit externistu (docs/08 kap. 4.1: historie a zápůjčky se nemažou).

// Co o osobě evidují jednotlivé moduly
export interface PersonFootprint {
  self: boolean;
  responses: boolean;
  actualAttendance: boolean;
  posts: boolean;
  comments: boolean;
  chat: boolean;
  mentions: boolean;
  eventGuest: boolean;
  costumes: boolean;
  history: boolean;
}

// Správní úkony nad osobou, které smazání nebrání (založení, úpravy, zařazení do skupin, pověření)
const ADMINISTRATIVE_ACTIONS = new Set<AuditAction>([
  'person-created',
  'person-updated',
  'member-added',
  'member-removed',
  'mandate-granted',
  'mandate-revoked',
  'invitation-created',
  'invitation-cancelled',
  'proposal-created',
]);

// Má osoba v historii vlastní stopu? (sama něco udělala, nebo se jí týká jiná než správní událost)
export function hasOwnHistory(entries: AuditEntry[], memberId: number): boolean {
  return entries.some((e) => e.actorId === memberId || (e.memberId === memberId && !ADMINISTRATIVE_ACTIONS.has(e.action)));
}

// memberId, issuedByMemberId, bookedByMemberId… / memberIds, guestMemberIds…
const MEMBER_ID_KEY = /^(memberId|[a-zA-Z]+MemberId)$/;
const MEMBER_IDS_KEY = /^(memberIds|[a-zA-Z]+MemberIds)$/;

// Odkazuje evidence krojů na osobu? (zápůjčky, úkoly, události, inventury…). Výchozí kroj je jen
// preference v profilu – smaže se spolu s osobou.
export function costumeReferencesMember(state: CostumeState, memberId: number): boolean {
  const { defaultCostumes: _preference, ...records } = state;
  const visit = (value: unknown): boolean => {
    if (Array.isArray(value)) return value.some(visit);
    if (!value || typeof value !== 'object') return false;
    return Object.entries(value).some(([key, v]) => {
      if (MEMBER_ID_KEY.test(key) && v === memberId) return true;
      if (MEMBER_IDS_KEY.test(key) && Array.isArray(v) && v.includes(memberId)) return true;
      return visit(v);
    });
  };
  return visit(records);
}

const REASONS: Record<keyof PersonFootprint, string> = {
  self: 'jde o váš vlastní účet',
  responses: 'odpověděla na akce',
  actualAttendance: 'má zapsanou docházku',
  posts: 'napsala příspěvky',
  comments: 'napsala komentáře',
  chat: 'psala do chatu',
  mentions: 'je zmíněna v obsahu ostatních',
  eventGuest: 'je pozvaná na akci jako host',
  costumes: 'má záznamy v evidenci krojů',
  history: 'má vlastní činnost v historii',
};

// Proč osobu nelze smazat (prázdné = lze)
export function deletionBlockers(footprint: PersonFootprint): string[] {
  return (Object.keys(REASONS) as (keyof PersonFootprint)[]).filter((k) => footprint[k]).map((k) => REASONS[k]);
}

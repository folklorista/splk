import { MANDATE_LABELS } from '../../core/models/mandate.model';
import { AuditAction, AuditEntry } from './audit.model';

// Příznak v details: ukončení/obnovení se týká externisty (není člen, „vyřazení z evidence“)
export const EXTERNAL_DETAIL = 'externista';

export interface AuditTextContext {
  memberName: (id: number | undefined) => string;
  groupName: (id: number | undefined) => string;
  eventTitle: (id: number | undefined) => string;
}

// Popis záznamu historie pro Správu (bez interní poznámky – ta se zobrazuje zvlášť jen oprávněným)
export function auditText(entry: AuditEntry, ctx: AuditTextContext): string {
  const who = ctx.memberName(entry.memberId);
  const group = ctx.groupName(entry.groupIds[0]);
  const mandate = entry.mandateKind ? MANDATE_LABELS[entry.mandateKind] : '';
  const scope = entry.mandateKind && entry.groupIds[0] ? ` (${group})` : entry.eventId ? ` (akce ${ctx.eventTitle(entry.eventId)})` : '';
  const texts: Record<AuditAction, string> = {
    'member-added': `${who} přidán/a do skupiny ${group}`,
    'member-removed': `${who} odebrán/a ze skupiny ${group}`,
    'member-left': `${who} opustil/a skupinu ${group}`,
    'member-joined': `${who} vstoupil/a do skupiny ${group}`,
    'request-created': `${who} žádá o vstup do skupiny ${group}`,
    'request-approved': `Žádost: ${who} do skupiny ${group} schválena`,
    'request-rejected': `Žádost: ${who} do skupiny ${group} zamítnuta`,
    'request-cancelled': `Žádost: ${who} do skupiny ${group} zrušena`,
    'invitation-created': `${who} pozván/a do skupiny ${group}`,
    'invitation-declined': `${who} odmítl/a pozvánku do skupiny ${group}`,
    'invitation-cancelled': `Pozvánka pro ${who} do skupiny ${group} zrušena`,
    'proposal-created': `Návrh přijmout ${who} do skupiny ${group}`,
    'mandate-granted': `${who}: přiděleno pověření ${mandate}${scope}`,
    'mandate-revoked': `${who}: odebráno pověření ${mandate}${scope}`,
    'group-created': `Založena skupina ${group}`,
    'group-updated': `Změněno nastavení skupiny ${group}${entry.details ? ` (${entry.details})` : ''}`,
    'group-archived': `Skupina ${group} archivována (jen ke čtení)`,
    'group-restored': `Skupina ${group} obnovena z archivu`,
    'group-deleted': `Smazána skupina ${group}`,
    'person-created': `Založena osoba ${who}`,
    'person-updated': `Upraveny údaje osoby ${who}`,
    'person-deactivated': entry.details === EXTERNAL_DETAIL ? `${who}: externista vyřazen z evidence` : `${who}: ukončeno aktivní členství v souboru`,
    'person-reactivated': entry.details === EXTERNAL_DETAIL ? `${who}: externista vrácen do evidence` : `${who}: obnoveno aktivní členství v souboru`,
    'person-deleted': `Trvale smazána osoba ${entry.details ?? ''} (založená omylem, bez stop v evidenci)`,
    'post-published': `Nový příspěvek ve skupině ${group}`,
    'post-pinned': `Příspěvek připnut ve skupině ${group}`,
    'post-unpinned': `Příspěvek odepnut ve skupině ${group}`,
    'post-hidden': `Příspěvek skryt moderátorem ve skupině ${group}`,
    'post-unhidden': `Příspěvek znovu zobrazen ve skupině ${group}`,
    'post-archived': `Příspěvek archivován ve skupině ${group}`,
    'post-restored': `Příspěvek obnoven z archivu ve skupině ${group}`,
    'event-created': `Založena akce ${ctx.eventTitle(entry.eventId)}`,
    'series-created': `Založena série ${ctx.eventTitle(entry.eventId)}${entry.details ? ` (${entry.details})` : ''}`,
    'event-updated': `Změna akce ${ctx.eventTitle(entry.eventId)}${entry.details ? `: ${entry.details}` : ''}`,
    'settings-updated': `Změněna konfigurace souboru${entry.details ? ` (${entry.details})` : ''}`,
  };
  return texts[entry.action];
}

// Které události historie se jako neutrální systémové zprávy promítnou do chatu skupiny.
// Žádosti, zamítnutí ani interní poznámky do chatu nepatří (docs/08 kap. 8.2, 8.5).
const CHAT_ACTIONS: AuditAction[] = ['member-added', 'member-removed', 'member-left', 'member-joined', 'post-pinned', 'event-created', 'series-created', 'event-updated'];

export function isChatSystemEvent(entry: AuditEntry, groupId: number): boolean {
  if (!entry.groupIds.includes(groupId)) return false;
  if (CHAT_ACTIONS.includes(entry.action)) return true;
  return (entry.action === 'mandate-granted' || entry.action === 'mandate-revoked') && (entry.mandateKind === 'group-owner' || entry.mandateKind === 'group-deputy');
}

// Text systémové zprávy v chatu – stručně, s aktérem
export function chatSystemText(entry: AuditEntry, ctx: AuditTextContext): string {
  const actor = ctx.memberName(entry.actorId);
  const who = ctx.memberName(entry.memberId);
  switch (entry.action) {
    case 'member-added':
      return `${who} přidán/a do skupiny · provedl/a ${actor}`;
    case 'member-removed':
      return `${who} odebrán/a ze skupiny · provedl/a ${actor}`;
    case 'member-left':
      return `${who} opustil/a skupinu`;
    case 'member-joined':
      return `${who} vstoupil/a do skupiny`;
    case 'mandate-granted':
      return `${who} je nově ${entry.mandateKind === 'group-owner' ? 'hlavním správcem' : 'spolusprávcem'} skupiny · provedl/a ${actor}`;
    case 'mandate-revoked':
      return `${who} už není ${entry.mandateKind === 'group-owner' ? 'hlavním správcem' : 'spolusprávcem'} skupiny`;
    case 'post-pinned':
      return `${actor} připnul/a příspěvek`;
    case 'event-created':
      return `Nová akce ${ctx.eventTitle(entry.eventId)}`;
    case 'series-created':
      return `Nová série ${ctx.eventTitle(entry.eventId)}${entry.details ? ` – ${entry.details}` : ''}`;
    case 'event-updated':
      return `Změna akce ${ctx.eventTitle(entry.eventId)}: ${entry.details ?? ''}`.trim();
    default:
      return auditText(entry, ctx);
  }
}

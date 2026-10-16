import { MandateKind } from '../../core/models/mandate.model';

export type AuditAction =
  | 'member-added'
  | 'member-removed'
  | 'member-left'
  | 'member-joined'
  | 'request-created'
  | 'request-approved'
  | 'request-rejected'
  | 'request-cancelled'
  | 'invitation-created'
  | 'invitation-declined'
  | 'invitation-cancelled'
  | 'proposal-created'
  | 'mandate-granted'
  | 'mandate-revoked'
  | 'group-created'
  | 'group-updated'
  | 'group-deleted'
  | 'person-created'
  | 'person-updated'
  | 'person-deactivated'
  | 'person-reactivated'
  | 'post-published'
  | 'post-pinned'
  | 'post-unpinned'
  | 'post-hidden'
  | 'post-unhidden'
  | 'post-archived'
  | 'post-restored'
  | 'event-created'
  | 'event-updated'
  | 'settings-updated';

// Záznam historie: kdo, kdy, co (docs/08 kap. 7.2, 10.2). Interní poznámka (note) zůstává jen
// v oprávněné správě; do chatu skupiny se promítají jen neutrální události (viz chat-timeline).
export interface AuditEntry {
  id: number;
  at: string;
  actorId: number;
  action: AuditAction;
  // Skupiny, kterých se událost týká (u akce cílové a pořádající skupiny)
  groupIds: number[];
  memberId?: number;
  postId?: number;
  eventId?: number;
  mandateKind?: MandateKind;
  // Neutrální popis pro člověka (např. co se na akci změnilo)
  details?: string;
  note?: string;
  // Mimořádný zásah správy souboru do skupiny, kde není správcem – zvýrazní se a oznámí správcům
  extraordinary?: boolean;
}

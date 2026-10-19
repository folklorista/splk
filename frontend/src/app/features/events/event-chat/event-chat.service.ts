import { Injectable, signal } from '@angular/core';
import { Observable, defer, of } from 'rxjs';
import { AccessService } from '../../../core/access/access.service';
import { canEditEvent, canSeeEvent, isEventAudience } from '../../../core/access/access.utils';
import { AccessDeniedError, RuleViolationError } from '../../../core/access/mandate-rules';
import { loadDemoData, saveDemoData } from '../../../core/data/demo-storage';
import { AppEvent } from '../models/event.model';

// Zpráva v chatu akce (záložka Chat v detailu akce; jen když má akce chat povolený)
export interface EventChatMessage {
  id: number;
  eventId: number;
  authorId: number;
  body: string;
  mentionedMemberIds: number[];
  createdAt: string;
  deletedAt?: string;
  deletedById?: number;
}

const STORAGE = 'event-chat';

export function isEventChatEnabled(event: Pick<AppEvent, 'chatEnabled' | 'skippedReason'>): boolean {
  return event.chatEnabled !== false && !event.skippedReason;
}

// Chat akce (mock). Číst smí, kdo akci vidí; psát oslovení členové a organizátoři akce;
// smazat vlastní zprávu autor, cizí organizátor akce.
@Injectable({ providedIn: 'root' })
export class EventChatService {
  private readonly messages = signal<EventChatMessage[]>(loadDemoData<EventChatMessage[]>(STORAGE, () => []));

  constructor(private access: AccessService) {}

  private commit(next: EventChatMessage[]): void {
    this.messages.set(next);
    saveDemoData(STORAGE, next);
  }

  messagesFor(event: AppEvent): EventChatMessage[] {
    if (!canSeeEvent(this.access.subject(), event)) return [];
    return this.messages().filter((m) => m.eventId === event.id);
  }

  canWrite(event: AppEvent): boolean {
    const member = this.access.currentMember();
    return isEventChatEnabled(event) && !!member && (isEventAudience(member, event) || canEditEvent(this.access.subject(), event));
  }

  send(event: AppEvent, body: string, mentionedMemberIds: number[]): Observable<EventChatMessage> {
    return defer(() => {
      const memberId = this.access.memberId();
      if (!memberId || !this.canWrite(event)) throw new AccessDeniedError('Do chatu akce píšou oslovení členové a organizátoři.');
      if (!body.trim()) throw new RuleViolationError('Zpráva je prázdná.');
      const message: EventChatMessage = {
        id: Math.max(0, ...this.messages().map((m) => m.id)) + 1,
        eventId: event.id,
        authorId: memberId,
        body: body.trim(),
        mentionedMemberIds,
        createdAt: new Date().toISOString(),
      };
      this.commit([...this.messages(), message]);
      return of(message);
    });
  }

  remove(event: AppEvent, messageId: number): Observable<void> {
    return defer(() => {
      const memberId = this.access.memberId();
      const message = this.messages().find((m) => m.id === messageId);
      if (!message || !memberId) return of(undefined);
      if (message.authorId !== memberId && !canEditEvent(this.access.subject(), event)) throw new AccessDeniedError('Cizí zprávu smaže jen organizátor akce.');
      this.commit(this.messages().map((m) => (m.id === messageId ? { ...m, deletedAt: new Date().toISOString(), deletedById: memberId } : m)));
      return of(undefined);
    });
  }
}

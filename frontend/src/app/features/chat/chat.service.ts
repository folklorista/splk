import { Injectable, signal } from '@angular/core';
import { Observable, defer, of } from 'rxjs';
import { ChatMessage } from './models/chat-message.model';
import { MOCK_CHAT_MESSAGES } from './data/mock-chat';
import { demoStorageKey, loadDemoData, saveDemoData } from '../../core/data/demo-storage';
import { AccessService } from '../../core/access/access.service';
import { AccessDeniedError, RuleViolationError } from '../../core/access/mandate-rules';
import { canModerateGroup, canPostInGroup, canReadGroupContent } from '../../core/access/access.utils';
import { GroupsService } from '../groups/groups.service';
import { hasChat } from '../../core/utils/visibility.utils';

const MESSAGES = 'chat-messages';
const READ_STATE = 'chat-read';
const MAX_LENGTH = 2000;

// Kdy člen naposledy viděl chat skupiny – klíč „memberId:groupId“
export type ChatReadState = Record<string, string>;

export const chatReadKey = (memberId: number, groupId: number) => `${memberId}:${groupId}`;

// Mock skupinového chatu. Bez WebSocketu: komponenty si stav periodicky čtou (docs/08 kap. 11.2),
// mezi záložkami prohlížeče se změny šíří přes událost „storage“.
@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly _messages = signal<ChatMessage[]>(loadDemoData(MESSAGES, () => [...MOCK_CHAT_MESSAGES]));
  private readonly _readState = signal<ChatReadState>(loadDemoData<ChatReadState>(READ_STATE, () => ({})));
  readonly messages = this._messages.asReadonly();
  readonly readState = this._readState.asReadonly();

  constructor(
    private access: AccessService,
    private groupsService: GroupsService,
  ) {
    window.addEventListener('storage', (event) => {
      if (!event.newValue) return;
      if (event.key === demoStorageKey(MESSAGES)) this._messages.set(JSON.parse(event.newValue));
      if (event.key === demoStorageKey(READ_STATE)) this._readState.set(JSON.parse(event.newValue));
    });
  }

  private commit(next: ChatMessage[]): void {
    this._messages.set(next);
    saveDemoData(MESSAGES, next);
  }

  private group(groupId: number) {
    const group = this.groupsService.findGroup(groupId);
    if (!group) throw new RuleViolationError('Skupina neexistuje.');
    return group;
  }

  // Zprávy skupiny jen pro toho, kdo smí číst její obsah
  messagesFor(groupId: number): ChatMessage[] {
    const group = this.groupsService.findGroup(groupId);
    if (!group || !canReadGroupContent(this.access.subject(), group)) return [];
    return this._messages().filter((m) => m.groupId === groupId);
  }

  isAuthor(memberId: number): boolean {
    return this._messages().some((m) => m.authorId === memberId);
  }

  mentions(memberId: number): boolean {
    return this._messages().some((m) => m.mentionedMemberIds.includes(memberId));
  }

  send(groupId: number, body: string, mentionedMemberIds: number[]): Observable<ChatMessage> {
    return defer(() => {
      const group = this.group(groupId);
      const memberId = this.access.memberId();
      if (!memberId || !canPostInGroup(this.access.subject(), group)) throw new AccessDeniedError('Do chatu píší jen členové skupiny.');
      if (!hasChat(group)) throw new RuleViolationError('Skupina má chat vypnutý.');
      const text = body.trim();
      if (!text) throw new RuleViolationError('Zpráva je prázdná.');
      if (text.length > MAX_LENGTH) throw new RuleViolationError(`Zpráva je delší než ${MAX_LENGTH} znaků.`);
      const message: ChatMessage = {
        id: Math.max(0, ...this._messages().map((m) => m.id)) + 1,
        groupId,
        authorId: memberId,
        body: text,
        mentionedMemberIds,
        createdAt: new Date().toISOString(),
      };
      this.commit([...this._messages(), message]);
      this.markRead(groupId);
      return of(message);
    });
  }

  // Upravit smí jen autor; smazat autor nebo správce skupiny (moderace)
  edit(messageId: number, body: string, mentionedMemberIds: number[]): Observable<ChatMessage> {
    return defer(() => {
      const message = this._messages().find((m) => m.id === messageId);
      if (!message || message.deletedAt) throw new RuleViolationError('Zpráva neexistuje.');
      if (message.authorId !== this.access.memberId()) throw new AccessDeniedError('Zprávu upravuje jen její autor.');
      const updated = { ...message, body: body.trim(), mentionedMemberIds, editedAt: new Date().toISOString() };
      this.commit(this._messages().map((m) => (m.id === messageId ? updated : m)));
      return of(updated);
    });
  }

  remove(messageId: number): Observable<void> {
    return defer(() => {
      const message = this._messages().find((m) => m.id === messageId);
      if (!message || message.deletedAt) return of(undefined);
      const isAuthor = message.authorId === this.access.memberId();
      if (!isAuthor && !canModerateGroup(this.access.subject(), this.group(message.groupId))) {
        throw new AccessDeniedError('Cizí zprávu smaže jen správce skupiny.');
      }
      const deleted: ChatMessage = { ...message, body: '', mentionedMemberIds: [], deletedAt: new Date().toISOString(), deletedById: this.access.memberId() ?? undefined };
      this.commit(this._messages().map((m) => (m.id === messageId ? deleted : m)));
      return of(undefined);
    });
  }

  lastReadAt(groupId: number, memberId: number | null = this.access.memberId()): string | undefined {
    return memberId ? this._readState()[chatReadKey(memberId, groupId)] : undefined;
  }

  // Přečtení chatu neoznačuje příspěvky ani jejich komentáře (docs/08 kap. 9.1)
  markRead(groupId: number): void {
    const memberId = this.access.memberId();
    if (!memberId) return;
    const next = { ...this._readState(), [chatReadKey(memberId, groupId)]: new Date().toISOString() };
    this._readState.set(next);
    saveDemoData(READ_STATE, next);
  }

  // Smazání archivované skupiny: odstraní celý její chat
  purgeGroup(groupId: number): void {
    this.commit(this._messages().filter((m) => m.groupId !== groupId));
  }

  resetCache(): void {
    this._messages.set([...MOCK_CHAT_MESSAGES]);
    this._readState.set({});
  }
}

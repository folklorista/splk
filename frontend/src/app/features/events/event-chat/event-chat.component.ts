import { Component, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AppEvent } from '../models/event.model';
import { Member } from '../../../core/models/member.model';
import { EventChatMessage, EventChatService } from './event-chat.service';
import { MentionInputComponent, MentionSubmit } from '../../../shared/mention-input/mention-input.component';
import { AccessService } from '../../../core/access/access.service';
import { EventsService } from '../events.service';

// Záložka Chat v detailu akce – diskuze k akci (kdo veze kroje, sraz…)
import { RichTextComponent } from '../../../shared/rich-text/rich-text.component';
@Component({
  selector: 'app-event-chat',
  standalone: true,
  imports: [DatePipe, MentionInputComponent, RichTextComponent],
  template: `
    <div class="chat">
      <div class="chat__log" role="log" aria-live="polite" aria-label="Chat akce">
        @for (m of messages(); track m.id) {
          <div class="chat-msg" [class.chat-msg--own]="m.authorId === me()">
            <div class="chat-msg__meta"><strong>{{ name(m.authorId) }}</strong> · {{ m.createdAt | date: 'd. M. HH:mm' }}</div>
            @if (m.deletedAt) {
              <p class="chat-msg__body chat-msg__body--deleted">Zpráva byla odstraněna.</p>
            } @else {
              <p class="chat-msg__body"><app-rich-text [body]="m.body" /></p>
              @if (m.authorId === me() || canModerate()) {
                <button type="button" class="chat-msg__action" (click)="remove(m)">Smazat</button>
              }
            }
          </div>
        } @empty {
          <p class="state-note">Zatím tu nic není. Zeptejte se nebo domluvte podrobnosti k akci.</p>
        }
      </div>
      @if (error()) { <p class="cs-error" role="alert">{{ error() }}</p> }
      @if (canWrite()) {
        <div class="chat__composer">
          <app-mention-input [candidates]="members()" [events]="linkableEvents()" [sendOnEnter]="true" placeholder="Zpráva k akci… (@ člen, # akce)" label="Zpráva do chatu akce" (submitted)="send($event)" />
        </div>
      }
    </div>
  `,
})
export class EventChatComponent {
  readonly event = input.required<AppEvent>();
  // Oslovení členové (pro zmínky a jména)
  readonly members = input<Member[]>([]);
  readonly canModerate = input(false);

  private service = inject(EventChatService);
  readonly me = inject(AccessService).memberId;
  readonly linkableEvents = inject(EventsService).linkableEvents;
  readonly error = signal('');
  readonly messages = computed(() => this.service.messagesFor(this.event()));
  readonly canWrite = computed(() => this.service.canWrite(this.event()));

  name(memberId: number): string {
    return this.members().find((m) => m.id === memberId)?.nickname ?? 'člen';
  }

  send(input: MentionSubmit): void {
    this.error.set('');
    this.service.send(this.event(), input.body, input.mentionedMemberIds).subscribe({ error: (e) => this.error.set(e?.message ?? 'Zprávu se nepodařilo odeslat.') });
  }

  remove(message: EventChatMessage): void {
    this.service.remove(this.event(), message.id).subscribe({ error: (e) => this.error.set(e?.message ?? 'Zprávu se nepodařilo smazat.') });
  }
}

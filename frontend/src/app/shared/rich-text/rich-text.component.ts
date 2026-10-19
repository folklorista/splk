import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommentSegment, EventRef, eventMentionLabel, parseCommentBody } from '../../features/posts/utils/mentions';
import { MembersService } from '../../features/members/members.service';
import { EventsService } from '../../features/events/events.service';

// Vykreslení textu s odkazy (příspěvek, komentář, chat): @zmínka zvýrazněná, #akce jako odkaz na detail akce.
// Akci, kterou čtenář nesmí vidět, ukáže jen jako „akce“ bez názvu. Žádné innerHTML → žádné XSS.
@Component({
  selector: 'app-rich-text',
  standalone: true,
  imports: [RouterLink],
  template: `@for (s of segments(); track $index) {@switch (s.type) {@case ('mention') {<span class="mention">&#64;{{ memberName(s.memberId) }}</span>}@case ('event') {@if (event(s.eventId); as e) {<a class="event-link" [routerLink]="['/app/events', e.id]">{{ label(e) }}</a>} @else {<span class="event-link event-link--hidden" title="Akci nemáte k dispozici">akce</span>}}@default {{{ s.text }}}}}`,
  styles: [`:host { white-space: pre-line; }`],
})
export class RichTextComponent {
  readonly body = input('');

  private members = inject(MembersService);
  private events = inject(EventsService);
  readonly segments = computed<CommentSegment[]>(() => parseCommentBody(this.body()));
  private visibleEvents = computed(() => new Map(this.events.linkableEvents().map((e) => [e.id, e])));

  memberName(memberId: number): string {
    return this.members.members().find((m) => m.id === memberId)?.nickname ?? 'člen';
  }

  event(eventId: number): EventRef | undefined {
    return this.visibleEvents().get(eventId);
  }

  label(event: EventRef): string {
    return eventMentionLabel(event);
  }
}

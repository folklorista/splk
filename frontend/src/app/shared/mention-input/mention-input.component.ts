import { Component, ElementRef, computed, effect, input, output, signal, untracked, viewChild } from '@angular/core';
import { Member } from '../../core/models/member.model';
import {
  EventRef,
  MentionQuery,
  activeMentionQuery,
  decodeMentions,
  encodeMentions,
  eventMentionLabel,
  filterEventCandidates,
  filterMentionCandidates,
  insertEventMention,
  insertMention,
} from '../../features/posts/utils/mentions';

export interface MentionSubmit {
  body: string;
  mentionedMemberIds: number[];
}

type Suggestion = { kind: 'member'; member: Member } | { kind: 'event'; event: EventRef };

let nextId = 0;

// Textové pole s odkazy: „@“ nabídne členy, „#“ akce (šipky/Enter/Tab/Esc). Při odeslání se čitelné
// „@Přezdívka“ / „#Název · d. M.“ převede na tokeny. Bez contenteditable a innerHTML.
// Režim bez tlačítka (showSubmit = false) průběžně posílá zakódovaný text přes valueChange (formulář příspěvku).
@Component({
  selector: 'app-mention-input',
  standalone: true,
  template: `
    <div class="mi">
      <div class="mention-input mi__field">
        <textarea
          #area
          class="comment-form__input mi__textarea"
          [rows]="rows()"
          [placeholder]="placeholder()"
          [attr.aria-label]="label()"
          role="combobox"
          aria-autocomplete="list"
          [attr.aria-controls]="listId"
          [attr.aria-expanded]="suggestions().length > 0"
          [value]="text()"
          (input)="onInput(area)"
          (click)="onInput(area)"
          (keydown)="onKeydown($event, area)"
          (blur)="query.set(null)"
        ></textarea>
        @if (suggestions().length) {
          <ul [id]="listId" class="mention-input__menu" role="listbox">
            @for (s of suggestions(); track $index; let i = $index) {
              <li role="option" class="mention-input__option" [class.mention-input__option--active]="i === active()" [attr.aria-selected]="i === active()"
                (mousedown)="$event.preventDefault(); choose(s, area)">{{ suggestionLabel(s) }}</li>
            }
          </ul>
        }
      </div>
      @if (showSubmit()) {
        <button type="button" class="attendance-btn attendance-btn--active mi__send" [disabled]="!text().trim() || disabled()" (click)="submit(area)">{{ submitLabel() }}</button>
      }
    </div>
  `,
  styles: [`
    .mi { display: flex; gap: var(--spacing-sm); align-items: flex-end; }
    .mi__field { flex: 1; min-width: 0; }
    .mi__textarea { width: 100%; resize: vertical; }
    .mi__send { flex: none; }
  `],
})
export class MentionInputComponent {
  readonly candidates = input<Member[]>([]);
  // Akce, na které lze odkázat přes „#“ (jen ty, které autor smí vidět)
  readonly events = input<EventRef[]>([]);
  readonly placeholder = input('Napište zprávu… (@ člen, # akce)');
  readonly label = input('Zpráva');
  readonly submitLabel = input('Odeslat');
  readonly rows = input(1);
  readonly disabled = input(false);
  readonly showSubmit = input(true);
  // Uložený text s tokeny k úpravě – převede se na čitelný text (jen dokud uživatel nezačal psát)
  readonly initialBody = input('');
  // V chatu odešle Enter (Shift+Enter = nový řádek)
  readonly sendOnEnter = input(false);
  readonly submitted = output<MentionSubmit>();
  readonly valueChange = output<MentionSubmit>();

  private area = viewChild<ElementRef<HTMLTextAreaElement>>('area');
  readonly listId = `mention-list-${nextId++}`;
  readonly text = signal('');
  readonly query = signal<MentionQuery | null>(null);
  readonly active = signal(0);
  private selected: Member[] = [];
  private selectedEvents: EventRef[] = [];
  private caret = 0;
  private touched = false;

  readonly suggestions = computed<Suggestion[]>(() => {
    const q = this.query();
    if (!q) return [];
    return q.trigger === '#'
      ? filterEventCandidates(this.events(), q.query).map((event) => ({ kind: 'event' as const, event }))
      : filterMentionCandidates(this.candidates(), q.query).map((member) => ({ kind: 'member' as const, member }));
  });

  constructor() {
    effect(() => {
      const body = this.initialBody();
      const members = this.candidates();
      const events = this.events();
      untracked(() => {
        if (this.touched || !body) return;
        const decoded = decodeMentions(body, members, events);
        this.text.set(decoded.text);
        this.selected = decoded.members;
        this.selectedEvents = decoded.events;
      });
    });
  }

  suggestionLabel(s: Suggestion): string {
    return s.kind === 'member' ? `@${s.member.nickname}` : `#${eventMentionLabel(s.event)}`;
  }

  onInput(area: HTMLTextAreaElement): void {
    this.touched = true;
    this.text.set(area.value);
    this.caret = area.selectionStart ?? area.value.length;
    this.query.set(activeMentionQuery(area.value, this.caret));
    this.active.set(0);
    this.emitValue();
  }

  onKeydown(event: KeyboardEvent, area: HTMLTextAreaElement): void {
    const suggestions = this.suggestions();
    if (suggestions.length) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        this.active.update((i) => (i + step + suggestions.length) % suggestions.length);
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        this.choose(suggestions[this.active()], area);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        this.query.set(null);
        return;
      }
    }
    if (this.sendOnEnter() && event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      this.submit(area);
    }
  }

  choose(suggestion: Suggestion, area?: HTMLTextAreaElement): void {
    const q = this.query();
    if (!q) return;
    this.touched = true;
    const result = suggestion.kind === 'member'
      ? insertMention(this.text(), q, this.caret, suggestion.member)
      : insertEventMention(this.text(), q, this.caret, suggestion.event);
    if (suggestion.kind === 'member' && !this.selected.some((m) => m.id === suggestion.member.id)) this.selected.push(suggestion.member);
    if (suggestion.kind === 'event' && !this.selectedEvents.some((e) => e.id === suggestion.event.id)) this.selectedEvents.push(suggestion.event);
    this.text.set(result.text);
    this.caret = result.caret;
    this.query.set(null);
    const el = area ?? this.area()?.nativeElement;
    if (el) {
      el.value = result.text;
      el.focus();
      el.setSelectionRange(result.caret, result.caret);
    }
    this.emitValue();
  }

  // Zakódovaný aktuální text (bez odeslání)
  encoded(): MentionSubmit {
    return encodeMentions(this.text().trim(), this.selected, this.selectedEvents);
  }

  private emitValue(): void {
    if (!this.showSubmit()) this.valueChange.emit(this.encoded());
  }

  submit(area?: HTMLTextAreaElement): void {
    const text = this.text().trim();
    if (!text || this.disabled()) return;
    this.submitted.emit(this.encoded());
    this.text.set('');
    this.selected = [];
    this.selectedEvents = [];
    this.query.set(null);
    const el = area ?? this.area()?.nativeElement;
    if (el) el.value = '';
  }

  focus(): void {
    this.area()?.nativeElement.focus();
  }
}

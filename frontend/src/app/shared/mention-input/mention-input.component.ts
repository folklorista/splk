import { Component, ElementRef, computed, input, output, signal, viewChild } from '@angular/core';
import { Member } from '../../core/models/member.model';
import { MentionQuery, activeMentionQuery, encodeMentions, filterMentionCandidates, insertMention } from '../../features/posts/utils/mentions';

export interface MentionSubmit {
  body: string;
  mentionedMemberIds: number[];
}

let nextId = 0;

// Textové pole se zmínkami přes „@“ (stejné chování jako komentáře): nabídka členů, šipky/Enter/Tab/Esc,
// při odeslání se „@Přezdívka“ převede na token. Bez contenteditable a innerHTML.
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
            @for (m of suggestions(); track m.id; let i = $index) {
              <li role="option" class="mention-input__option" [class.mention-input__option--active]="i === active()" [attr.aria-selected]="i === active()"
                (mousedown)="$event.preventDefault(); choose(m, area)">&#64;{{ m.nickname }}</li>
            }
          </ul>
        }
      </div>
      <button type="button" class="attendance-btn attendance-btn--active mi__send" [disabled]="!text().trim() || disabled()" (click)="submit(area)">{{ submitLabel() }}</button>
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
  readonly placeholder = input('Napište zprávu… (@ pro zmínku)');
  readonly label = input('Zpráva');
  readonly submitLabel = input('Odeslat');
  readonly rows = input(1);
  readonly disabled = input(false);
  // V chatu odešle Enter (Shift+Enter = nový řádek)
  readonly sendOnEnter = input(false);
  readonly submitted = output<MentionSubmit>();

  private area = viewChild<ElementRef<HTMLTextAreaElement>>('area');
  readonly listId = `mention-list-${nextId++}`;
  readonly text = signal('');
  readonly query = signal<MentionQuery | null>(null);
  readonly active = signal(0);
  private selected: Member[] = [];
  private caret = 0;

  readonly suggestions = computed(() => {
    const q = this.query();
    return q ? filterMentionCandidates(this.candidates(), q.query) : [];
  });

  onInput(area: HTMLTextAreaElement): void {
    this.text.set(area.value);
    this.caret = area.selectionStart ?? area.value.length;
    this.query.set(activeMentionQuery(area.value, this.caret));
    this.active.set(0);
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

  choose(member: Member, area: HTMLTextAreaElement): void {
    const q = this.query();
    if (!q) return;
    const result = insertMention(this.text(), q, this.caret, member);
    this.text.set(result.text);
    this.caret = result.caret;
    this.query.set(null);
    if (!this.selected.some((m) => m.id === member.id)) this.selected.push(member);
    area.value = result.text;
    area.focus();
    area.setSelectionRange(result.caret, result.caret);
  }

  submit(area?: HTMLTextAreaElement): void {
    const text = this.text().trim();
    if (!text || this.disabled()) return;
    this.submitted.emit(encodeMentions(text, this.selected));
    this.text.set('');
    this.selected = [];
    this.query.set(null);
    const el = area ?? this.area()?.nativeElement;
    if (el) el.value = '';
  }

  focus(): void {
    this.area()?.nativeElement.focus();
  }
}

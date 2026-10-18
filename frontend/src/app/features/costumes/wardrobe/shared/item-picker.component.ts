import { Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { CostumeItem, CostumeState } from '../../models/costume.model';
import { itemLabel, matchesSearch } from '../../utils/costume-logic';
import { WARDROBE_STYLES } from './wardrobe.styles';

// Výběr existujících fyzických kusů (vydání, výměna). Žádný volný text nového čísla.
@Component({
  selector: 'app-item-picker',
  standalone: true,
  template: `
    <div class="stack">
      <input class="input" type="search" placeholder="Hledat řadu, číslo, variantu…" [value]="search()" (input)="search.set($any($event.target).value)" aria-label="Hledat kus" />
      @if (!filtered().length) {
        <p class="state-note">Žádný dostupný kus neodpovídá.</p>
      }
      <div class="picker">
        @for (item of filtered(); track item.id) {
          <label class="check picker__row">
            <input [type]="multiple ? 'checkbox' : 'radio'" name="picker" [checked]="selected.includes(item.id)" (change)="toggle(item.id)" />
            <span>{{ label(item) }}@if (item.size) {<span class="muted"> · vel. {{ item.size }}</span>}</span>
          </label>
        }
      </div>
    </div>
  `,
  styles: [WARDROBE_STYLES, `.picker { max-height: 260px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; } .picker__row { min-height: 32px; }`],
})
export class ItemPickerComponent {
  @Input({ required: true }) state!: CostumeState;
  @Input({ required: true }) set items(value: CostumeItem[]) { this.items_.set(value); }
  @Input() multiple = false;
  @Input() selected: number[] = [];
  @Output() selectedChange = new EventEmitter<number[]>();

  private items_ = signal<CostumeItem[]>([]);
  readonly search = signal('');
  readonly filtered = computed(() => this.items_().filter((i) => matchesSearch(`${itemLabel(this.state, i)} ${i.number ?? ''}`, this.search())));

  label(item: CostumeItem): string {
    return itemLabel(this.state, item);
  }

  toggle(id: number): void {
    const next = this.multiple ? (this.selected.includes(id) ? this.selected.filter((x) => x !== id) : [...this.selected, id]) : [id];
    this.selected = next;
    this.selectedChange.emit(next);
  }
}

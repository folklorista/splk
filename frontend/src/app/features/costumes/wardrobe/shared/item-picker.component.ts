import { Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { CostumeItem, CostumeState } from '../../models/costume.model';
import { genderLabel, itemLabel, matchesDefaultCostume, matchesSearch } from '../../utils/costume-logic';
import { WARDROBE_STYLES } from './wardrobe.styles';

// Výběr existujících fyzických kusů (vydání, výměna). Žádný volný text nového čísla.
// S výchozím krojem osoby nabízí nejdřív odpovídající kusy; ostatní jsou o jedno klepnutí dál (docs/06 kap. 5.1a).
@Component({
  selector: 'app-item-picker',
  standalone: true,
  template: `
    <div class="stack">
      <input class="input" type="search" placeholder="Hledat řadu, číslo, variantu…" [value]="search()" (input)="search.set($any($event.target).value)" aria-label="Hledat kus" />
      @if (preferredLabel(); as label) {
        <p class="muted">{{ showAll() ? 'Všechny kusy, nejdřív ' + label + ' kroj (výchozí kroj osoby).' : 'Nabízí se ' + label + ' kroj podle výchozího kroje osoby.' }}</p>
      }
      @if (!filtered().length) {
        <p class="state-note">Žádný dostupný kus neodpovídá.</p>
      }
      <div class="picker">
        @for (item of filtered(); track item.id) {
          <label class="check picker__row">
            <input [type]="multiple ? 'checkbox' : 'radio'" name="picker" [checked]="selected.includes(item.id)" (change)="toggle(item.id)" />
            <span>{{ label(item) }}@if (item.size) {<span class="muted"> · vel. {{ item.size }}</span>}@if (offDefault(item)) {<span class="muted"> · mimo výchozí kroj</span>}</span>
          </label>
        }
      </div>
      @if (hiddenCount()) {
        <button type="button" class="btn-secondary picker__more" (click)="showAll.set(true)">Zobrazit všechny kusy (další {{ hiddenCount() }})</button>
      } @else if (showAll() && preferredLabel()) {
        <button type="button" class="btn-secondary picker__more" (click)="showAll.set(false)">Jen {{ preferredLabel() }} kroj</button>
      }
    </div>
  `,
  styles: [WARDROBE_STYLES, `.picker { max-height: 260px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; } .picker__row { min-height: 32px; } .picker__more { align-self: flex-start; }`],
})
export class ItemPickerComponent {
  @Input({ required: true }) set state(value: CostumeState) { this.state_.set(value); }
  get state(): CostumeState { return this.state_()!; }
  @Input({ required: true }) set items(value: CostumeItem[]) { this.items_.set(value); }
  // Výchozí kroj osoby, které se kus vydává (pohlaví kroje); prázdné = nabízí se vše
  @Input() set preferredGenderId(value: string | undefined) { this.preferred.set(value); }
  @Input() multiple = false;
  @Input() set selected(value: number[]) { this.selected_.set(value); }
  get selected(): number[] { return this.selected_(); }
  @Output() selectedChange = new EventEmitter<number[]>();

  private state_ = signal<CostumeState | undefined>(undefined);
  private items_ = signal<CostumeItem[]>([]);
  private preferred = signal<string | undefined>(undefined);
  private selected_ = signal<number[]>([]);
  readonly search = signal('');
  readonly showAll = signal(false);

  private readonly searched = computed(() =>
    this.items_().filter((i) => matchesSearch(`${itemLabel(this.state, i)} ${i.number ?? ''}`, this.search())),
  );

  readonly preferredLabel = computed(() => {
    const genderId = this.preferred();
    return genderId ? genderLabel(this.state, genderId).toLowerCase() : '';
  });

  // Odpovídající kusy první; ostatní jen po „Zobrazit všechny“ (vybrané zůstávají vidět vždy)
  readonly filtered = computed(() => {
    const genderId = this.preferred();
    const list = this.searched();
    if (!genderId) return list;
    const matching = list.filter((i) => matchesDefaultCostume(this.state, i, genderId));
    const others = list.filter((i) => !matchesDefaultCostume(this.state, i, genderId));
    return this.showAll() ? [...matching, ...others] : [...matching, ...others.filter((i) => this.selected_().includes(i.id))];
  });

  readonly hiddenCount = computed(() => {
    const genderId = this.preferred();
    if (!genderId || this.showAll()) return 0;
    return this.searched().filter((i) => !matchesDefaultCostume(this.state, i, genderId) && !this.selected_().includes(i.id)).length;
  });

  label(item: CostumeItem): string {
    return itemLabel(this.state, item);
  }

  offDefault(item: CostumeItem): boolean {
    return !matchesDefaultCostume(this.state, item, this.preferred());
  }

  toggle(id: number): void {
    const next = this.multiple ? (this.selected.includes(id) ? this.selected.filter((x) => x !== id) : [...this.selected, id]) : [id];
    this.selected_.set(next);
    this.selectedChange.emit(next);
  }
}

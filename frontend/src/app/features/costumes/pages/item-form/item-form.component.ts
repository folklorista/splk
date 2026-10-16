import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CostumesNavComponent } from '../../costumes-nav/costumes-nav.component';
import { CostumesService, ItemInput } from '../../costumes.service';
import { itemCode, nextFreeNumber, partTypeName } from '../../utils/costume-logic';
import { ActionFeedback } from '../items/costume-ui';

const toId = (value: string): number | undefined => (value === '' ? undefined : Number(value));

// Prázdné pole = součást zatím bez čísla; jinak číslo (validaci kladného celého čísla dělá služba)
export function parseItemNumber(value: string): number | undefined {
  const text = value.trim();
  return text === '' ? undefined : Number(text);
}

@Component({
  selector: 'app-costume-item-form',
  standalone: true,
  imports: [CostumesNavComponent, RouterLink],
  template: `
    <div class="page">
      <app-costumes-nav />
      <a class="back-link" [routerLink]="backLink()">← Zpět</a>
      <h1 class="page__title">{{ editId ? 'Upravit: ' + label() : 'Nová součást' }}</h1>

      @if (editId && !editedItem()) {
        <p class="state-note">Součást nebyla nalezena.</p>
      } @else if (editedItem()?.retired) {
        <p class="state-note">Vyřazenou součást nelze upravovat.</p>
      } @else {
        <form class="cs-form item-form" (submit)="$event.preventDefault(); save()">
          <label class="cs-field">
            <span>Číselná řada *</span>
            <select required (change)="seriesId.set($any($event.target).value)">
              <option value="" [selected]="seriesId() === ''" disabled>Vyberte řadu</option>
              @for (series of state().series; track series.id) {
                <option [value]="series.id" [selected]="seriesId() === '' + series.id">{{ series.name }}</option>
              }
            </select>
          </label>

          <div class="cs-field">
            <span class="cs-field__label">Evidenční číslo</span>
            <div class="item-form__number">
              <input type="number" min="1" step="1" inputmode="numeric" placeholder="zatím bez čísla"
                [value]="number()" (input)="number.set($any($event.target).value)" />
              <button type="button" class="cs-btn" [disabled]="seriesId() === ''" (click)="suggestNumber()">Navrhnout volné číslo</button>
            </div>
            @if (number().trim() === '') {
              <span class="cs-hint">Bez čísla: součást se eviduje jako jedinečný kus, kterému fyzické číslo zatím chybí – je potřeba ji očíslovat a číslo doplnit.</span>
            } @else {
              <span class="cs-hint">Číslo platí jen v rámci zvolené řady.</span>
            }
          </div>

          <label class="cs-field">
            <span>Druh součásti *</span>
            <select required (change)="partTypeId.set($any($event.target).value)">
              <option value="" [selected]="partTypeId() === ''" disabled>Vyberte druh</option>
              @for (type of numberedPartTypes(); track type.id) {
                <option [value]="type.id" [selected]="partTypeId() === '' + type.id">{{ type.name }}</option>
              }
            </select>
            @if (unnumberedNames()) {
              <span class="cs-hint">Neočíslované doplňky ({{ unnumberedNames() }}) se evidují počtem kusů přímo v kompletu.</span>
            }
          </label>

          <label class="cs-field">
            <span>Popis</span>
            <input type="text" placeholder="např. černý s výšivkou" [value]="description()" (input)="description.set($any($event.target).value)" />
          </label>

          <label class="cs-field">
            <span>Velikost / míry</span>
            <input type="text" [value]="size()" (input)="size.set($any($event.target).value)" />
          </label>

          <label class="cs-field">
            <span>Poznámka k součásti</span>
            <textarea rows="2" placeholder="např. povolený šev, chybí knoflík" [value]="note()" (input)="note.set($any($event.target).value)"></textarea>
          </label>

          @if (!editId) {
            <label class="cs-field">
              <span>Komplet</span>
              <select (change)="kitId.set($any($event.target).value)">
                <option value="" [selected]="kitId() === ''">Bez kompletu</option>
                @for (kit of state().kits; track kit.id) {
                  <option [value]="kit.id" [selected]="kitId() === '' + kit.id">{{ kit.label }}</option>
                }
              </select>
            </label>
          } @else if (editedItem()?.kitId !== undefined) {
            <p class="cs-hint">Komplet se mění v detailu součásti nebo kompletu (změna složení má vlastní historii).</p>
          }

          @if (feedback.error()) {
            <p class="cs-error" role="alert">{{ feedback.error() }}</p>
          }

          <div class="cs-form__actions">
            <button type="submit" class="cs-btn cs-btn--primary" [disabled]="feedback.busy() || seriesId() === '' || partTypeId() === ''">
              {{ feedback.busy() ? 'Ukládám…' : editId ? 'Uložit' : 'Založit součást' }}
            </button>
            <a class="cs-btn" [routerLink]="backLink()">Zrušit</a>
          </div>
        </form>
      }
    </div>
  `,
  styles: [
    `
      .item-form { max-width: 560px; }
      .item-form__number { display: flex; gap: var(--spacing-sm); }
      .item-form__number input { flex: 1; min-width: 0; }
    `,
  ],
})
export class CostumeItemFormComponent {
  private costumes = inject(CostumesService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  readonly state = toSignal(this.costumes.state$, { initialValue: this.costumes.snapshot });
  readonly feedback = new ActionFeedback();

  readonly editId = Number(this.route.snapshot.paramMap.get('id')) || undefined;
  readonly editedItem = computed(() => this.state().items.find((i) => i.id === this.editId));

  readonly seriesId = signal('');
  readonly number = signal('');
  readonly partTypeId = signal('');
  readonly description = signal('');
  readonly size = signal('');
  readonly note = signal('');
  readonly kitId = signal('');

  readonly numberedPartTypes = computed(() => this.state().partTypes.filter((t) => t.numbered));
  readonly unnumberedNames = computed(() =>
    this.state()
      .partTypes.filter((t) => !t.numbered)
      .map((t) => t.name.toLocaleLowerCase('cs'))
      .join(', '),
  );
  readonly backLink = computed(() => {
    if (this.editId) return ['/app/costumes/items', this.editId];
    return this.kitId() ? ['/app/costumes/kits', this.kitId()] : ['/app/costumes/items'];
  });

  constructor() {
    const item = this.editedItem();
    if (item) {
      this.seriesId.set(String(item.seriesId));
      this.number.set(item.number !== undefined ? String(item.number) : '');
      this.partTypeId.set(String(item.partTypeId));
      this.description.set(item.description ?? '');
      this.size.set(item.size ?? '');
      this.note.set(item.note ?? '');
    } else if (!this.editId) {
      // Nová součást přímo do kompletu – předvyplnit komplet i jeho řadu
      const kit = this.state().kits.find((k) => k.id === Number(this.route.snapshot.queryParamMap.get('kitId')));
      if (kit) {
        this.kitId.set(String(kit.id));
        if (kit.seriesId !== undefined) this.seriesId.set(String(kit.seriesId));
      }
    }
  }

  suggestNumber(): void {
    const seriesId = toId(this.seriesId());
    if (seriesId === undefined) return;
    // U upravované součásti je její vlastní číslo také „volné“
    const own = this.editedItem();
    const state = this.state();
    const free = nextFreeNumber(
      own ? { ...state, items: state.items.filter((i) => i.id !== own.id) } : state,
      seriesId,
    );
    this.number.set(String(free));
  }

  save(): void {
    const seriesId = toId(this.seriesId());
    const partTypeId = toId(this.partTypeId());
    if (seriesId === undefined || partTypeId === undefined) {
      this.feedback.error.set('Vyberte řadu a druh součásti.');
      return;
    }
    const input: ItemInput = {
      seriesId,
      number: parseItemNumber(this.number()),
      partTypeId,
      description: this.description(),
      size: this.size(),
      note: this.note(),
    };
    const action = this.editId
      ? this.costumes.updateItem(this.editId, input)
      : this.costumes.createItem({ ...input, kitId: toId(this.kitId()) });
    this.feedback.run(action, (item) => this.router.navigate(['/app/costumes/items', item.id]));
  }

  label(): string {
    const item = this.editedItem();
    return item ? `${partTypeName(this.state(), item.partTypeId)} – ${itemCode(this.state(), item)}` : '';
  }
}

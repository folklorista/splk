import { Component, ElementRef, ViewChild, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { InventoryService } from '../../inventory.service';
import { AccessService } from '../../../../core/access/access.service';
import { CONDITION_LABELS, CostumeItem, ItemCondition, LOCATION_LABELS } from '../../models/costume.model';
import { findSeries, itemNumberLabel, openLoanFor, seriesLabel, variantLabel } from '../../utils/costume-logic';
import { QuickEntryResult, isInTarget, stockGroups } from '../../utils/inventory-logic';
import { WardrobeNavComponent } from '../shared/wardrobe-nav.component';
import { WorkOrderFormComponent } from '../shared/work-order-form.component';
import { errorMessage } from '../shared/wardrobe-ui';
import { WARDROBE_STYLES } from '../shared/wardrobe.styles';

interface Batch {
  id: number;
  input: string;
  results: QuickEntryResult[];
  errors: string[];
}

// Režim „Ve skladu“: jedna evidenční řada, číselná mřížka a rychlé zadání čísel s potvrzením Enter.
// Neexistující, opakovaná, zapůjčená či mimo sklad vedená čísla se zřetelně vrátí, nepotvrdí se potichu.
@Component({
  selector: 'app-wardrobe-inventory-series',
  standalone: true,
  imports: [WardrobeNavComponent, RouterLink, WorkOrderFormComponent],
  template: `
    <div class="page">
      <app-wardrobe-nav />
      <a [routerLink]="['/app/wardrobe/inventories', inventoryId]" [queryParams]="{ tab: 'stock' }" class="back-link no-print">← Ve skladu</a>
      @if (view(); as v) {
        <h1 class="page__title">{{ v.label }}</h1>
        <p class="muted">{{ v.inv.name }} · ověřeno <strong>{{ v.verified }} / {{ v.items.length }}</strong> nezapůjčených kusů řady
          @if (v.onLoan) { · dalších {{ v.onLoan }} je zapůjčeno (kontrolují se podle lidí) }</p>
        <div class="progress"><div class="progress__bar" [style.width.%]="v.items.length ? (v.verified / v.items.length) * 100 : 0"></div></div>
        @if (error()) { <div class="error-box" role="alert">{{ error() }}</div> }

        @if (canEdit()) {
          <form class="quick no-print" (submit)="$event.preventDefault(); submit()">
            <label class="field">Evidenční čísla (Enter potvrdí)
              <input #entry class="input quick__input" [attr.inputmode]="batchMode() ? 'text' : 'numeric'" autocomplete="off" enterkeyhint="done"
                [placeholder]="batchMode() ? 'např. 1, 3, 7, 12-15' : 'číslo'" [value]="entryText()" (input)="entryText.set($any($event.target).value)" />
            </label>
            <div class="row">
              <button type="submit" class="btn-primary btn-primary--sm" [disabled]="!entryText().trim()">Potvrdit</button>
              <label class="check"><input type="checkbox" [checked]="batchMode()" (change)="batchMode.set($any($event.target).checked); focus()" /> Dávka a rozsahy (textová klávesnice)</label>
            </div>
          </form>
        }

        @for (b of batches(); track b.id; let first = $first) {
          <div class="batch" [class.batch--latest]="first">
            <span class="muted">„{{ b.input }}“:</span>
            @for (r of b.results; track $index) {
              <span class="badge result" [attr.data-outcome]="r.outcome">{{ r.number }} – {{ r.message }}</span>
            }
            @for (e of b.errors; track e) { <span class="badge result" data-outcome="unknown">{{ e }}</span> }
          </div>
        }

        <div class="grid" role="list" aria-label="Kusy řady">
          @for (row of v.items; track row.item.id) {
            <button type="button" role="listitem" class="cell" [attr.data-state]="row.check.state" [class.cell--away]="row.item.location !== 'store'"
              [class.cell--selected]="selectedId() === row.item.id" (click)="select(row.item.id)" [attr.aria-label]="number(row.item)">
              <span class="cell__num">{{ row.item.number ?? '?' }}</span>
              @if (row.item.location !== 'store') { <span class="cell__flag">{{ locationLabels[row.item.location] }}</span> }
              @else if (row.item.condition !== 'ok' || row.check.latest?.condition && row.check.latest?.condition !== 'ok') { <span class="cell__flag">!</span> }
            </button>
          }
        </div>
        <p class="muted legend"><span class="dot dot--verified"></span> ověřeno <span class="dot dot--not-presented"></span> nenalezeno <span class="dot"></span> čeká · čísla vyřazených kusů se v mřížce nezobrazují a nejsou „chybějící“.</p>

        @if (selected(); as s) {
          <div class="panel stack">
            <strong>{{ number(s.item) }}@if (s.item.variantId) { · {{ variant(s.item.variantId) }} }@if (s.item.size) { · vel. {{ s.item.size }} }</strong>
            <span class="muted">Umístění: {{ locationLabels[s.item.location] }} · stav: {{ conditionLabels[s.item.condition] }} · v inventuře: {{ s.check.state === 'verified' ? 'ověřeno' : s.check.state === 'not-presented' ? 'nenalezeno' : 'čeká' }}</span>
            @if (canEdit()) {
              @if (s.item.location !== 'store' && !s.check.verified) {
                <div class="warn-box">Podle evidence je kus {{ locationLabels[s.item.location].toLowerCase() }}. Pokud je fyzicky tady, potvrďte to výslovně – vrátí se do skladu.
                  <button type="button" class="btn-secondary" (click)="confirmFound(s.item)">Je tady – potvrdit</button></div>
              } @else {
                <div class="row">
                  @for (c of conditions; track c) { <button type="button" class="btn-secondary" (click)="check(s.item, true, c)">{{ conditionLabels[c] }}</button> }
                  <button type="button" class="btn-secondary" (click)="check(s.item, false)">Nenalezeno</button>
                </div>
              }
              <input class="input" placeholder="Poznámka" [value]="note()" (input)="note.set($any($event.target).value)" />
              <div class="row">
                @if (s.check.latest) { <button type="button" class="btn-link" (click)="revoke(s.check.latest!.id)">zrušit poslední zápis</button> }
                <button type="button" class="btn-secondary" (click)="workOrder.set(!workOrder())">+ Úkol</button>
                <a class="btn-link" [routerLink]="['/app/wardrobe/stock', s.item.id]">detail kusu</a>
              </div>
              @if (workOrder()) { <app-work-order-form [itemId]="s.item.id" [inventoryId]="inventoryId" (saved)="workOrder.set(false)" (cancelled)="workOrder.set(false)" /> }
            }
          </div>
        }
      } @else {
        <p class="state-note">Řada v této inventuře nemá žádné nezapůjčené kusy.</p>
      }
    </div>
  `,
  styles: [WARDROBE_STYLES, `
    .quick { display: flex; flex-direction: column; gap: var(--spacing-sm); margin: var(--spacing-md) 0; }
    .quick__input { font-size: 1.5rem; padding: 12px; }
    .batch { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; margin-bottom: 6px; opacity: 0.6; }
    .batch--latest { opacity: 1; }
    .result[data-outcome='verified'] { background: var(--status-ok-fg); color: #fff; border-color: var(--status-ok-fg); }
    .result[data-outcome='duplicate'], .result[data-outcome='repeated'] { background: var(--status-warn-bg); color: var(--status-warn-fg); border: 1px solid var(--status-warn-border); }
    .result[data-outcome='unknown'], .result[data-outcome='retired'], .result[data-outcome='out-of-scope'], .result[data-outcome='on-loan'], .result[data-outcome='away'] { background: var(--color-primary-fill); color: #fff; border-color: var(--color-primary); }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(56px, 1fr)); gap: 6px; margin: var(--spacing-md) 0; }
    .cell { min-height: 56px; border-radius: var(--radius-md); border: 2px solid var(--color-border); background: var(--color-surface); color: var(--color-text); cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; font: inherit; padding: 2px; }
    .cell__num { font-size: 1.2rem; font-weight: 700; font-variant-numeric: tabular-nums; }
    .cell__flag { font-size: 0.6rem; line-height: 1; }
    .cell[data-state='verified'] { background: var(--status-ok-fg); border-color: var(--status-ok-fg); color: #fff; }
    .cell[data-state='not-presented'] { border-color: var(--color-primary); color: var(--color-primary); }
    .cell--away { border-style: dashed; }
    .cell--selected { outline: 3px solid var(--color-primary); outline-offset: 1px; }
    .legend { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
    .dot { display: inline-block; width: 12px; height: 12px; border-radius: 3px; border: 2px solid var(--color-border); }
    .dot--verified { background: var(--status-ok-fg); border-color: var(--status-ok-fg); }
    .dot--not-presented { border-color: var(--color-primary); }
  `],
})
export class WardrobeInventorySeriesComponent {
  @ViewChild('entry') entry?: ElementRef<HTMLInputElement>;

  private inventories = inject(InventoryService);
  private canManage = inject(AccessService).canManageCostumes;
  readonly state = toSignal(this.inventories.state$);
  private route = inject(ActivatedRoute);
  readonly inventoryId = Number(this.route.snapshot.paramMap.get('id'));
  private seriesId = Number(this.route.snapshot.paramMap.get('seriesId'));

  readonly conditions: ItemCondition[] = ['ok', 'damaged', 'needs-alteration'];
  readonly conditionLabels = CONDITION_LABELS;
  readonly locationLabels = LOCATION_LABELS;
  readonly entryText = signal('');
  readonly batchMode = signal(false);
  readonly batches = signal<Batch[]>([]);
  readonly selectedId = signal<number | null>(null);
  readonly note = signal('');
  readonly workOrder = signal(false);
  readonly error = signal('');

  readonly view = computed(() => {
    const state = this.state();
    const inv = state?.inventories.find((i) => i.id === this.inventoryId);
    if (!state || !inv) return null;
    const group = stockGroups(state, inv).find((g) => g.series.id === this.seriesId);
    const series = findSeries(state, this.seriesId);
    return {
      inv,
      label: group?.label ?? seriesLabel(state, series),
      items: group?.items ?? [],
      verified: group?.verified ?? 0,
      onLoan: state.items.filter((i) => i.seriesId === this.seriesId && isInTarget(inv, i.id) && !!openLoanFor(state, i.id)).length,
    };
  });
  readonly canEdit = computed(() => this.canManage() && !!this.view() && !this.view()!.inv.closure);
  readonly selected = computed(() => this.view()?.items.find((r) => r.item.id === this.selectedId()));

  number = itemNumberLabel;
  variant = (id: string) => variantLabel(this.state()!, id);

  focus(): void {
    setTimeout(() => this.entry?.nativeElement.focus());
  }

  submit(): void {
    const input = this.entryText().trim();
    if (!input) return;
    this.inventories.quickEntry(this.inventoryId, this.seriesId, input).subscribe({
      next: (res) => {
        this.batches.update((b) => [{ id: Date.now(), input, results: res.results, errors: res.errors }, ...b].slice(0, 8));
        this.entryText.set('');
        if (this.entry) this.entry.nativeElement.value = '';
        this.focus();
      },
      error: (e) => this.error.set(errorMessage(e)),
    });
  }

  select(itemId: number): void {
    this.selectedId.set(this.selectedId() === itemId ? null : itemId);
    this.note.set('');
    this.workOrder.set(false);
  }

  check(item: CostumeItem, presented: boolean, condition?: ItemCondition): void {
    this.run(this.inventories.recordCheck({ inventoryId: this.inventoryId, itemId: item.id, presented, condition, note: this.note(), mode: 'stock' }));
  }

  confirmFound(item: CostumeItem): void {
    this.run(this.inventories.confirmFoundInStore(this.inventoryId, item.id, this.note()));
  }

  revoke(checkId: number): void {
    this.run(this.inventories.revokeCheck(checkId));
  }

  private run(obs: Observable<unknown>): void {
    this.error.set('');
    obs.subscribe({ next: () => this.note.set(''), error: (e) => this.error.set(errorMessage(e)) });
  }
}

import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CostumesService } from '../../costumes.service';
import { MembersService } from '../../../members/members.service';
import { AccessService } from '../../../../core/access/access.service';
import { CONDITION_LABELS, CostumeItem, LOCATION_LABELS } from '../../models/costume.model';
import {
  AVAILABILITY_LABELS,
  ItemAvailability,
  borrowerLabel,
  itemAvailability,
  itemNumberLabel,
  openLoanFor,
  openWorkOrdersFor,
  seriesLabel,
  stockSummary,
  variantLabel,
} from '../../utils/costume-logic';
import { downloadCsv, printPage } from '../../../../shared/export/export.utils';
import { WardrobeNavComponent } from '../shared/wardrobe-nav.component';
import { WARDROBE_STYLES } from '../shared/wardrobe.styles';
import { EMPTY_STOCK_FILTER, StockFilter, filterStock, groupBySeries } from './stock.utils';

// Součástky – všechny fyzické součástky po evidenčních řadách (řada + číslo), s filtry podle klasifikace
@Component({
  selector: 'app-wardrobe-stock',
  standalone: true,
  imports: [WardrobeNavComponent, RouterLink],
  template: `
    <div class="page">
      <app-wardrobe-nav />
      <div class="page__header">
        <h1 class="page__title">Správa krojů – součástky</h1>
      </div>
      @if (!canManage()) {
        <p class="info-box">Fond můžete prohlížet; změny zapisují pověřené krojařky.</p>
      }

      @if (summary(); as s) {
        <div class="stats no-print">
          <button type="button" class="stat" (click)="patch({ availability: '' })"><span class="stat__value">{{ s.items }}</span><span class="stat__label">evidovaných kusů</span></button>
          <button type="button" class="stat" (click)="patch({ availability: 'available' })"><span class="stat__value">{{ s.available }}</span><span class="stat__label">k vydání</span></button>
          <button type="button" class="stat" (click)="patch({ availability: 'on-loan' })"><span class="stat__value">{{ s.onLoan }}</span><span class="stat__label">zapůjčeno</span></button>
          <button type="button" class="stat" (click)="patch({ availability: 'away' })"><span class="stat__value">{{ s.away }}</span><span class="stat__label">mimo sklad (oprava, švadlena…)</span></button>
          <button type="button" class="stat" (click)="patch({ workOrders: true })"><span class="stat__value">{{ s.openWorkOrders }}</span><span class="stat__label">otevřených úkolů</span></button>
          <a class="stat" routerLink="/app/wardrobe/loans" [queryParams]="{ filter: 'overdue' }"><span class="stat__value">{{ s.overdueLoans }}</span><span class="stat__label">po termínu vrácení</span></a>
          <a class="stat" routerLink="/app/wardrobe/inventories"><span class="stat__value">{{ s.openInventories }}</span><span class="stat__label">probíhajících inventur</span></a>
        </div>
      }

      <div class="toolbar no-print">
        @if (canManage()) {
          <a class="btn-primary btn-primary--sm" routerLink="/app/wardrobe/stock/new">+ Nová součástka</a>
          <a class="btn-secondary" routerLink="/app/wardrobe/loans/new">Vydat kusy</a>
        }
        <span class="toolbar__spacer"></span>
        <button type="button" class="btn-secondary" (click)="print()">Tisk</button>
        <button type="button" class="btn-secondary" (click)="exportCsv()">Export CSV</button>
      </div>

      @if (state(); as st) {
        <div class="fields no-print">
          <label class="field">Hledat<input class="input" type="search" placeholder="řada, číslo, držitel…" [value]="filter().search" (input)="patch({ search: $any($event.target).value })" /></label>
          <label class="field">Pohlaví
            <select class="input" (change)="patch({ genderId: $any($event.target).value })">
              <option value="">Vše</option>
              @for (o of st.classification.genders; track o.id) { <option [value]="o.id" [selected]="filter().genderId === o.id">{{ o.label }}</option> }
            </select>
          </label>
          <label class="field">Region
            <select class="input" (change)="patch({ regionId: $any($event.target).value })">
              <option value="">Vše</option>
              @for (o of st.classification.regions; track o.id) { <option [value]="o.id" [selected]="filter().regionId === o.id">{{ o.label }}</option> }
            </select>
          </label>
          <label class="field">Druh
            <select class="input" (change)="patch({ partTypeId: $any($event.target).value })">
              <option value="">Vše</option>
              @for (t of st.partTypes; track t.id) { <option [value]="t.id" [selected]="filter().partTypeId === '' + t.id">{{ t.name }}</option> }
            </select>
          </label>
          <label class="field">Dostupnost
            <select class="input" (change)="patch({ availability: $any($event.target).value })">
              <option value="">Evidované (bez vyřazených)</option>
              @for (a of availabilities; track a) { <option [value]="a" [selected]="filter().availability === a">{{ availabilityLabels[a] }}</option> }
            </select>
          </label>
          <label class="field">Stav
            <select class="input" (change)="patch({ condition: $any($event.target).value })">
              <option value="">Vše</option>
              @for (c of conditions; track c) { <option [value]="c" [selected]="filter().condition === c">{{ conditionLabels[c] }}</option> }
            </select>
          </label>
          <label class="field">Umístění
            <select class="input" (change)="patch({ location: $any($event.target).value })">
              <option value="">Vše</option>
              @for (l of locations; track l) { <option [value]="l" [selected]="filter().location === l">{{ locationLabels[l] }}</option> }
            </select>
          </label>
          <label class="check"><input type="checkbox" [checked]="filter().workOrders" (change)="patch({ workOrders: $any($event.target).checked })" /> Jen s otevřeným úkolem</label>
        </div>

        <p class="muted">{{ items().length }} kusů · <button type="button" class="btn-link no-print" (click)="filter.set(empty)">zrušit filtry</button></p>

        @for (group of groups(); track group.seriesId) {
          <h2 class="group-title">{{ group.label }} <span class="muted">({{ group.items.length }})</span></h2>
          <ul class="item-list">
            @for (item of group.items; track item.id) {
              <li class="item-list__item item-list__item--link" [routerLink]="['/app/wardrobe/stock', item.id]">
                <div class="item-list__row">
                  <span class="item-list__title"><span class="code">{{ number(item) }}</span>
                    @if (item.variantId) { · {{ variant(item.variantId) }} }
                    @if (item.size) { <span class="muted"> · vel. {{ item.size }}</span> }
                  </span>
                  <span class="item-list__badges">
                    <span class="badge" [class.badge--muted]="availability(item) === 'retired'" [class.badge--warn]="availability(item) === 'away' || availability(item) === 'not-issuable'">{{ availabilityLabels[availability(item)] }}</span>
                    @if (item.condition !== 'ok') { <span class="badge badge--warn">{{ conditionLabels[item.condition] }}</span> }
                    @if (workOrders(item)) { <span class="badge badge--muted">úkol</span> }
                  </span>
                </div>
                <div class="item-list__meta">
                  {{ locationLabels[item.location] }}@if (item.locationNote) { ({{ item.locationNote }}) }
                  @if (holder(item); as h) { · {{ h }} }
                  @if (item.description) { · {{ item.description }} }
                </div>
              </li>
            }
          </ul>
        } @empty {
          <p class="state-note">Filtrům neodpovídá žádný kus.</p>
        }
      }
    </div>
  `,
  styles: [WARDROBE_STYLES, `.stat { text-align: left; cursor: pointer; color: var(--color-text); font: inherit; } .stat:hover { border-color: var(--color-primary); }`],
})
export class WardrobeStockComponent {
  private costumes = inject(CostumesService);
  private members = inject(MembersService).members;
  readonly canManage = inject(AccessService).canManageCostumes;
  readonly state = toSignal(this.costumes.state$);

  readonly empty = EMPTY_STOCK_FILTER;
  readonly filter = signal<StockFilter>({ ...EMPTY_STOCK_FILTER });
  readonly availabilities: ItemAvailability[] = ['available', 'on-loan', 'away', 'not-issuable', 'retired'];
  readonly conditions = Object.keys(CONDITION_LABELS) as (keyof typeof CONDITION_LABELS)[];
  readonly locations = Object.keys(LOCATION_LABELS) as (keyof typeof LOCATION_LABELS)[];
  readonly availabilityLabels = AVAILABILITY_LABELS;
  readonly conditionLabels = CONDITION_LABELS;
  readonly locationLabels = LOCATION_LABELS;

  readonly summary = computed(() => (this.state() ? stockSummary(this.state()!) : null));
  readonly items = computed(() => (this.state() ? filterStock(this.state()!, this.filter(), (i) => this.holder(i)) : []));
  readonly groups = computed(() => (this.state() ? groupBySeries(this.state()!, this.items()) : []));

  constructor(route: ActivatedRoute) {
    const q = route.snapshot.queryParamMap;
    this.filter.set({ ...EMPTY_STOCK_FILTER, availability: (q.get('availability') as ItemAvailability) ?? '', workOrders: q.get('workOrders') === '1' });
  }

  patch(change: Partial<StockFilter>): void {
    this.filter.update((f) => ({ ...f, ...change }));
  }

  number = itemNumberLabel;
  availability = (item: CostumeItem) => itemAvailability(this.state()!, item);
  variant = (id: string) => variantLabel(this.state()!, id);
  workOrders = (item: CostumeItem) => openWorkOrdersFor(this.state()!, item.id).length;

  holder(item: CostumeItem): string {
    const state = this.state()!;
    const loan = openLoanFor(state, item.id);
    return loan ? borrowerLabel(loan.borrower, this.members(), state.externals) : '';
  }

  print(): void {
    printPage();
  }

  exportCsv(): void {
    const state = this.state()!;
    downloadCsv('krojarna-sklad', [
      ['Řada', 'Číslo', 'Varianta', 'Velikost', 'Dostupnost', 'Stav', 'Umístění', 'Držitel', 'Poznámka'],
      ...this.items().map((item) => [
        seriesLabel(state, state.series.find((s) => s.id === item.seriesId)),
        item.number ?? '',
        item.variantId ? variantLabel(state, item.variantId) : '',
        item.size ?? '',
        AVAILABILITY_LABELS[itemAvailability(state, item)],
        CONDITION_LABELS[item.condition],
        LOCATION_LABELS[item.location],
        this.holder(item),
        item.note ?? '',
      ]),
    ]);
  }
}

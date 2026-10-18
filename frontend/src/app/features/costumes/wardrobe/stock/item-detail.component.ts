import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CostumesService } from '../../costumes.service';
import { MembersService } from '../../../members/members.service';
import { AccessService } from '../../../../core/access/access.service';
import {
  CONDITION_LABELS,
  CostumeWorkOrder,
  ItemCondition,
  ItemLocation,
  LOCATION_LABELS,
  WORK_ORDER_KIND_LABELS,
  WORK_ORDER_STATUS_LABELS,
  WorkOrderStatus,
} from '../../models/costume.model';
import {
  AVAILABILITY_LABELS,
  borrowerKey,
  borrowerLabel,
  findSeries,
  genderLabel,
  itemAvailability,
  itemLabel,
  lastSeen,
  memberName,
  openLoanFor,
  partTypeName,
  regionLabel,
  seriesLabel,
  variantLabel,
} from '../../utils/costume-logic';
import { WardrobeNavComponent } from '../shared/wardrobe-nav.component';
import { WorkOrderFormComponent } from '../shared/work-order-form.component';
import { LoanActionsComponent } from '../shared/loan-actions.component';
import { errorMessage } from '../shared/wardrobe-ui';
import { WARDROBE_STYLES } from '../shared/wardrobe.styles';

type Panel = 'none' | 'condition' | 'location' | 'work-order' | 'retire';

@Component({
  selector: 'app-wardrobe-item-detail',
  standalone: true,
  imports: [WardrobeNavComponent, RouterLink, DatePipe, WorkOrderFormComponent, LoanActionsComponent],
  template: `
    <div class="page">
      <app-wardrobe-nav />
      <a routerLink="/app/wardrobe/stock" class="back-link no-print">← Součástky</a>
      @if (!view()) {
        <p class="state-note">Součástka nebyla nalezena.</p>
      }
      @if (view(); as v) {
        <h1 class="page__title">{{ v.label }}</h1>
        <div class="row">
          <span class="badge">{{ availabilityLabels[v.availability] }}</span>
          <span class="badge" [class.badge--warn]="v.item.condition !== 'ok'">{{ conditionLabels[v.item.condition] }}</span>
          @if (!v.item.issuable) { <span class="badge badge--warn">Nevydatelné</span> }
        </div>
        @if (error()) { <div class="error-box" role="alert">{{ error() }}</div> }

        <section class="detail section">
          <table class="table">
            <tr><th>Evidenční řada</th><td>{{ v.seriesLabel }}</td></tr>
            <tr><th>Číslo v řadě</th><td class="code">{{ v.item.number ?? 'zatím bez čísla' }}</td></tr>
            <tr><th>Klasifikace</th><td>{{ v.classification }}</td></tr>
            @if (v.item.size) { <tr><th>Velikost</th><td>{{ v.item.size }}</td></tr> }
            @if (v.item.description) { <tr><th>Popis</th><td>{{ v.item.description }}</td></tr> }
            @if (v.item.note) { <tr><th>Poznámka</th><td>{{ v.item.note }}</td></tr> }
            <tr><th>Fyzické umístění</th><td>{{ locationLabels[v.item.location] }}@if (v.item.locationNote) { – {{ v.item.locationNote }} }</td></tr>
            <tr><th>Držitel v evidenci</th><td>
              @if (v.loan) {
                <a class="link" [routerLink]="['/app/wardrobe/cards', key(v.loan.borrower)]">{{ borrower(v.loan.borrower) }}</a>
                · od {{ v.loan.issuedAt | date: 'd. M. yyyy' }} @if (v.loan.dueAt) { · vrátit do {{ v.loan.dueAt | date: 'd. M. yyyy' }} }
              } @else { — }
            </td></tr>
            <tr><th>Naposledy fyzicky viděn</th><td>
              @if (v.lastSeen; as ls) {
                {{ ls.at | date: 'd. M. yyyy' }} –
                @switch (ls.source) {
                  @case ('inventory') { <a class="link" [routerLink]="['/app/wardrobe/inventories', ls.inventoryId]">inventura {{ inventoryName(ls.inventoryId) }}</a> }
                  @case ('returned') { vrácení do skladu }
                  @case ('issued') { vydání }
                }
              } @else { nezaznamenáno }
            </td></tr>
            @if (v.item.retired) {
              <tr><th>Vyřazeno</th><td>{{ v.item.retired.at | date: 'd. M. yyyy' }} – {{ v.item.retired.reason }}</td></tr>
            }
          </table>
        </section>

        @if (canManage() && !v.item.retired) {
          <div class="row no-print">
            <a class="btn-secondary" [routerLink]="['/app/wardrobe/stock', v.item.id, 'edit']">Upravit údaje</a>
            @if (v.availability === 'available') {
              <a class="btn-secondary" routerLink="/app/wardrobe/loans/new" [queryParams]="{ item: v.item.id }">Vydat</a>
            }
            <button type="button" class="btn-secondary" (click)="open('condition')">Stav</button>
            <button type="button" class="btn-secondary" (click)="open('location')">Umístění</button>
            <button type="button" class="btn-secondary" (click)="open('work-order')">+ Úkol</button>
            <button type="button" class="btn-secondary" (click)="open('retire')">Vyřadit</button>
          </div>
          @if (v.loan) {
            <h2 class="group-title">Zápůjčka</h2>
            <app-loan-actions [state]="state()!" [loan]="v.loan" [item]="v.item" />
          }

          @switch (panel()) {
            @case ('condition') {
              <div class="panel stack">
                <div class="row">
                  @for (c of conditions; track c) {
                    <button type="button" class="btn-secondary" [class.btn-secondary--active]="condition() === c" (click)="condition.set(c)">{{ conditionLabels[c] }}</button>
                  }
                </div>
                <label class="check"><input type="checkbox" [checked]="issuable()" (change)="issuable.set($any($event.target).checked)" /> Lze vydat</label>
                <input class="input" placeholder="Poznámka" [value]="note()" (input)="note.set($any($event.target).value)" />
                <div class="row"><button type="button" class="btn-primary btn-primary--sm" (click)="saveCondition()">Uložit</button><button type="button" class="btn-secondary" (click)="panel.set('none')">Zrušit</button></div>
              </div>
            }
            @case ('location') {
              <div class="panel stack">
                <select class="input" [value]="location()" (change)="location.set($any($event.target).value)">
                  @for (l of locations; track l) { <option [value]="l" [selected]="location() === l">{{ locationLabels[l] }}</option> }
                </select>
                <input class="input" placeholder="Upřesnění (kde, u koho)" [value]="note()" (input)="note.set($any($event.target).value)" />
                <div class="row"><button type="button" class="btn-primary btn-primary--sm" (click)="saveLocation()">Uložit</button><button type="button" class="btn-secondary" (click)="panel.set('none')">Zrušit</button></div>
              </div>
            }
            @case ('work-order') {
              <app-work-order-form [itemId]="v.item.id" (saved)="panel.set('none')" (cancelled)="panel.set('none')" />
            }
            @case ('retire') {
              <div class="panel stack">
                <p>Vyřazený kus zůstane v evidenci i s historií. Číslo {{ v.item.number }} se {{ v.reuse ? 'podle pravidla řady smí znovu použít' : 'už nepřidělí jinému kusu' }}.</p>
                @if (v.loan) { <label class="check"><input type="checkbox" [checked]="settle()" (change)="settle.set($any($event.target).checked)" /> Kus je zapůjčený – vypořádat zápůjčku vyřazením (ztráta, odkup…)</label> }
                <input class="input" placeholder="Důvod vyřazení *" [value]="note()" (input)="note.set($any($event.target).value)" />
                <div class="row"><button type="button" class="btn-primary btn-primary--sm" (click)="retire()">Vyřadit</button><button type="button" class="btn-secondary" (click)="panel.set('none')">Zrušit</button></div>
              </div>
            }
          }
        }

        <h2 class="group-title">Pracovní úkoly</h2>
        @for (o of v.workOrders; track o.id) {
          <div class="panel">
            <div class="row"><strong>{{ kindLabels[o.kind] }}</strong> {{ o.description }} <span class="badge" [class.badge--warn]="o.status === 'open' || o.status === 'in-progress'">{{ statusLabels[o.status] }}</span></div>
            <div class="muted">založeno {{ o.createdAt | date: 'd. M. yyyy' }}@if (o.assignee) { · řeší {{ o.assignee }} }@if (o.dueAt) { · do {{ o.dueAt | date: 'd. M. yyyy' }} }@if (o.inventoryId) { · z inventury }@if (o.resolution) { · {{ o.resolution }} }</div>
            @if (canManage() && (o.status === 'open' || o.status === 'in-progress')) {
              <div class="row no-print">
                @if (o.status === 'open') { <button type="button" class="btn-secondary" (click)="setStatus(o, 'in-progress')">Rozpracováno</button> }
                <button type="button" class="btn-secondary" (click)="setStatus(o, 'done')">Hotovo</button>
                <button type="button" class="btn-secondary" (click)="setStatus(o, 'cancelled')">Zrušit úkol</button>
              </div>
            }
          </div>
        } @empty { <p class="muted">Žádné úkoly.</p> }

        <h2 class="group-title">Historie držení</h2>
        <div class="table-wrap">
          <table class="table">
            <tr><th>Držitel</th><th>Vydáno</th><th>Ukončeno</th><th>Poznámka</th></tr>
            @for (l of v.loans; track l.id) {
              <tr>
                <td>{{ borrower(l.borrower) }}</td>
                <td>{{ l.issuedAt | date: 'd. M. yyyy' }}@if (l.replacesLoanId) { <span class="muted"> (výměna)</span> }</td>
                <td>@if (l.endedAt) { {{ l.endedAt | date: 'd. M. yyyy' }} – {{ endLabels[l.endReason ?? 'returned'] }} } @else { <strong>drží</strong> }</td>
                <td>{{ l.note }} {{ l.endNote }}</td>
              </tr>
            } @empty { <tr><td colspan="4" class="muted">Kus zatím nebyl zapůjčen.</td></tr> }
          </table>
        </div>

        <h2 class="group-title">Inventurní kontroly</h2>
        <div class="table-wrap">
          <table class="table">
            <tr><th>Kdy</th><th>Inventura</th><th>Výsledek</th><th>Kdo</th></tr>
            @for (c of v.checks; track c.id) {
              <tr [class.muted]="c.revokedAt">
                <td>{{ c.at | date: 'd. M. yyyy H:mm' }}</td>
                <td><a class="link" [routerLink]="['/app/wardrobe/inventories', c.inventoryId]">{{ inventoryName(c.inventoryId) }}</a></td>
                <td>{{ c.presented ? 'fyzicky ověřeno' : 'nepředloženo' }}@if (c.condition) { · {{ conditionLabels[c.condition] }} }@if (c.note) { · {{ c.note }} }@if (c.revokedAt) { (zrušeno) }</td>
                <td>{{ name(c.byMemberId) }}</td>
              </tr>
            } @empty { <tr><td colspan="4" class="muted">Žádné kontroly.</td></tr> }
          </table>
        </div>

        <h2 class="group-title">Změny a pohyby</h2>
        <ul class="item-list">
          @for (e of v.events; track e.id) {
            <li class="item-list__item"><div class="item-list__meta">{{ e.at | date: 'd. M. yyyy H:mm' }} · {{ name(e.byMemberId) }}</div>{{ e.text }}@if (e.note) { <span class="muted"> – {{ e.note }}</span> }</li>
          } @empty { <li class="muted">Žádné záznamy.</li> }
        </ul>
      }
    </div>
  `,
  styles: [WARDROBE_STYLES],
})
export class WardrobeItemDetailComponent {
  private costumes = inject(CostumesService);
  private members = inject(MembersService).members;
  readonly canManage = inject(AccessService).canManageCostumes;
  readonly state = toSignal(this.costumes.state$);
  private id = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));

  readonly conditions: ItemCondition[] = ['ok', 'needs-alteration', 'damaged'];
  readonly locations: ItemLocation[] = ['store', 'seamstress', 'repair', 'unknown'];
  readonly conditionLabels = CONDITION_LABELS;
  readonly locationLabels = LOCATION_LABELS;
  readonly availabilityLabels = AVAILABILITY_LABELS;
  readonly kindLabels = WORK_ORDER_KIND_LABELS;
  readonly statusLabels = WORK_ORDER_STATUS_LABELS;
  readonly endLabels = { returned: 'vráceno', exchanged: 'vyměněno', settled: 'vypořádáno' };

  readonly panel = signal<Panel>('none');
  readonly condition = signal<ItemCondition>('ok');
  readonly issuable = signal(true);
  readonly location = signal<ItemLocation>('store');
  readonly note = signal('');
  readonly settle = signal(false);
  readonly error = signal('');

  readonly view = computed(() => {
    const state = this.state();
    const item = state?.items.find((i) => i.id === this.id);
    if (!state || !item) return null;
    const series = findSeries(state, item.seriesId);
    const variantId = series?.variantId ?? item.variantId;
    return {
      item,
      label: itemLabel(state, item),
      seriesLabel: seriesLabel(state, series),
      classification: [genderLabel(state, series?.genderId), regionLabel(state, series?.regionId), partTypeName(state, series?.partTypeId), variantId ? `varianta ${variantLabel(state, variantId)}${series?.variantId ? ' (součást řady)' : ''}` : ''].filter(Boolean).join(' · '),
      reuse: !!series?.allowNumberReuse,
      availability: itemAvailability(state, item),
      loan: openLoanFor(state, item.id),
      lastSeen: lastSeen(state, item.id),
      workOrders: state.workOrders.filter((o) => o.itemId === item.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      loans: state.loans.filter((l) => l.itemId === item.id).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)),
      checks: state.inventoryChecks.filter((c) => c.itemId === item.id).sort((a, b) => b.at.localeCompare(a.at)),
      events: state.events.filter((e) => e.itemId === item.id).sort((a, b) => b.at.localeCompare(a.at)),
    };
  });

  borrower = (b: Parameters<typeof borrowerLabel>[0]) => borrowerLabel(b, this.members(), this.state()!.externals);
  key = borrowerKey;
  name = (id: number) => memberName(this.members(), id) || 'krojařka';
  inventoryName = (id: number | undefined) => this.state()?.inventories.find((i) => i.id === id)?.name ?? '';

  open(panel: Panel): void {
    const item = this.view()!.item;
    this.condition.set(item.condition);
    this.issuable.set(item.issuable);
    this.location.set(item.location === 'holder' ? 'unknown' : item.location);
    this.note.set('');
    this.error.set('');
    this.panel.set(this.panel() === panel ? 'none' : panel);
  }

  saveCondition(): void {
    this.run(this.costumes.setCondition(this.id, this.condition(), this.issuable(), this.note()));
  }

  saveLocation(): void {
    this.run(this.costumes.setLocation(this.id, this.location(), this.note()));
  }

  retire(): void {
    this.run(this.costumes.retireItem(this.id, this.note(), this.settle()));
  }

  setStatus(order: CostumeWorkOrder, status: WorkOrderStatus): void {
    const resolution = status === 'done' ? window.prompt('Jak byl úkol vyřešen? (nepovinné)') ?? undefined : undefined;
    this.run(this.costumes.updateWorkOrder(order.id, status, resolution));
  }

  private run(obs: import('rxjs').Observable<unknown>): void {
    this.error.set('');
    obs.subscribe({ next: () => this.panel.set('none'), error: (e) => this.error.set(errorMessage(e)) });
  }
}

import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { CostumesService } from '../../costumes.service';
import { InventoryService } from '../../inventory.service';
import { MembersService } from '../../../members/members.service';
import { AccessService } from '../../../../core/access/access.service';
import { CONDITION_LABELS, CostumeItem, ItemCondition } from '../../models/costume.model';
import { VISIT_STATUS_LABELS } from '../../models/inventory.model';
import {
  borrowerLabel,
  findSeries,
  holdingsOf,
  itemAvailability,
  itemLabel,
  itemNumberLabel,
  itemPartLabel,
  memberName,
  openLoanFor,
  parseBorrowerKey,
  seriesLabel,
  sortItems,
  defaultCostumeOf,
} from '../../utils/costume-logic';
import {
  activeChecks,
  currentVisit,
  isInTarget,
  itemInventoryState,
  targetHoldings,
  targetLoansEndedDuringInventory,
  visitRecap,
} from '../../utils/inventory-logic';
import { WardrobeNavComponent } from '../shared/wardrobe-nav.component';
import { LoanActionsComponent } from '../shared/loan-actions.component';
import { ItemPickerComponent } from '../shared/item-picker.component';
import { errorMessage } from '../shared/wardrobe-ui';
import { WARDROBE_STYLES } from '../shared/wardrobe.styles';

// Inventurní návštěva (režim „Podle lidí“): krojová karta filtrovaná na cílové kusy inventury,
// potvrzení předložení a stavu, běžné operace krojařky (vrátit, vyměnit, vydat, úkol) a rekapitulace.
// Dokončená návštěva neznamená, že jsou všechny kusy ověřené.
@Component({
  selector: 'app-wardrobe-inventory-visit',
  standalone: true,
  imports: [WardrobeNavComponent, RouterLink, DatePipe, LoanActionsComponent, ItemPickerComponent],
  template: `
    <div class="page">
      <app-wardrobe-nav />
      @if (view(); as v) {
        <a [routerLink]="['/app/wardrobe/inventories', v.inv.id]" class="back-link no-print">← {{ v.inv.name }}</a>
        <h1 class="page__title">{{ v.label }}</h1>
        <p class="muted">
          Inventura {{ v.inv.name }} ·
          @if (v.visit) {
            {{ statusLabels[v.visit.status] }}
            @if (v.slot) { · termín {{ v.slot.startsAt | date: 'd. M. yyyy H:mm' }} }
            @if (v.visit.completedAt) { · dokončeno {{ v.visit.completedAt | date: 'd. M. yyyy H:mm' }} ({{ name(v.visit.completedByMemberId) }}) }
          } @else { bez rezervace }
        </p>
        @if (error()) { <div class="error-box" role="alert">{{ error() }}</div> }

        @if (canEdit() && !v.active) {
          <div class="info-box">
            @if (v.visit?.status === 'completed') { Návštěva je dokončená. Nevyřešené kusy lze dořešit další návštěvou. }
            @else { Kontrola se zapisuje do otevřené návštěvy. }
            <button type="button" class="btn-primary btn-primary--sm" (click)="startVisit()">{{ v.visit?.status === 'completed' ? 'Zahájit další návštěvu' : 'Zahájit návštěvu' }}</button>
          </div>
        }

        <h2 class="group-title">Kusy z rozsahu inventury ({{ v.rows.length }})</h2>
        @if (!v.rows.length) { <p class="state-note">Osoba teď nedrží žádný kus z rozsahu.</p> }
        <ul class="item-list item-list--rows">
          @for (r of v.rows; track r.item.id) {
            <li class="item-list__item visit-item" [attr.data-state]="r.check.state">
              <div class="item-list__row">
                <span class="item-list__title">{{ part(r.item) }} <span class="code">{{ number(r.item) }}</span></span>
                <span class="item-list__badges">
                  @switch (r.check.state) {
                    @case ('verified') { <span class="badge badge--ok">Ověřeno{{ r.check.latest?.condition ? ' · ' + conditionLabels[r.check.latest!.condition!] : '' }}</span> }
                    @case ('not-presented') { <span class="badge badge--alert">Nepředloženo</span> }
                    @default { <span class="badge badge--muted">Nezkontrolováno</span> }
                  }
                </span>
              </div>
              <div class="item-list__meta">řada {{ series(r.item) }}@if (r.item.size) { · vel. {{ r.item.size }} }@if (r.check.latest?.note) { · {{ r.check.latest!.note }} }</div>
              @if (v.active) {
                <div class="row no-print check-buttons">
                  @for (c of conditions; track c) {
                    <button type="button" class="btn-secondary" (click)="check(r.item, true, c)">{{ conditionLabels[c] }}</button>
                  }
                  <button type="button" class="btn-secondary" (click)="check(r.item, false)">Nepředloženo</button>
                  @if (r.check.latest) { <button type="button" class="btn-link" (click)="revoke(r.check.latest!.id)">zrušit zápis</button> }
                </div>
                <input class="input no-print" placeholder="Poznámka ke kontrole (uloží se s dalším zápisem)" [value]="notes()[r.item.id] ?? ''" (input)="setNote(r.item.id, $any($event.target).value)" />
                <app-loan-actions [state]="state()!" [loan]="r.loan" [item]="r.item" [inventory]="v.inv" [visitId]="v.visit!.id" />
              }
            </li>
          }
        </ul>

        @if (v.ended.length) {
          <h2 class="group-title">Během inventury vráceno / vyměněno</h2>
          <ul class="item-list item-list--rows">
            @for (e of v.ended; track e.loan.id) {
              <li class="item-list__item">
                <span class="item-list__title">{{ label(e.item) }}</span>
                <div class="item-list__meta">{{ e.loan.endReason === 'exchanged' ? 'vyměněno' : 'vráceno' }} {{ e.loan.endedAt | date: 'd. M. H:mm' }} · {{ e.state === 'verified' ? 'fyzicky ověřeno' : e.state === 'not-presented' ? 'nepředloženo' : 'nezkontrolováno' }} · nyní: {{ e.now }}</div>
              </li>
            }
          </ul>
        }

        @if (v.others) { <p class="muted">Osoba má ještě {{ v.others }} dalších kusů mimo rozsah této inventury (celá karta: <a class="link" [routerLink]="['/app/wardrobe/cards', key]">krojová karta</a>).</p> }

        @if (v.active) {
          <div class="row no-print">
            <button type="button" class="btn-secondary" (click)="issuing.set(!issuing())">+ Nově vydat kus</button>
          </div>
          @if (issuing()) {
            <div class="panel stack">
              <strong>Nové vydání</strong>
              <app-item-picker [state]="state()!" [items]="available()" [preferredGenderId]="preferredGender()" [multiple]="true" [selected]="issueIds()" (selectedChange)="issueIds.set($event)" />
              <button type="button" class="btn-primary btn-primary--sm" [disabled]="!issueIds().length" (click)="issue()">Vydat {{ issueIds().length }} ks</button>
            </div>
          }

          <section class="detail stack section recap">
            <h2 class="detail__section-title">Rekapitulace návštěvy</h2>
            <p>Ověřeno <strong>{{ v.recap.verified.length }}</strong> · poškozeno {{ v.recap.damaged.length }} · k úpravě {{ v.recap.needsAlteration.length }} · nepředloženo <strong>{{ v.recap.notPresented.length }}</strong> · nezkontrolováno <strong>{{ v.recap.unchecked.length }}</strong></p>
            @if (v.recap.notPresented.length || v.recap.unchecked.length) {
              <div class="warn-box">Zůstanou v inventuře otevřené: {{ names(v.recap.notPresented.concat(v.recap.unchecked)) }}</div>
            }
            @if (v.recap.movements.length) {
              <p class="muted">Pohyby: @for (m of v.recap.movements; track m.id) { <span>{{ itemName(m.itemId) }} – {{ m.text }}; </span> }</p>
            }
            @if (v.recap.workOrders.length) {
              <p class="muted">Otevřené úkoly: @for (o of v.recap.workOrders; track o.id) { <span>{{ itemName(o.itemId) }} – {{ o.description }}; </span> }</p>
            }
            <input class="input" placeholder="Poznámka k návštěvě" [value]="visitNote()" (input)="visitNote.set($any($event.target).value)" />
            <button type="button" class="btn-primary" (click)="complete()">Potvrdit dokončení návštěvy</button>
          </section>
        }
      } @else {
        <p class="state-note">Návštěva nebyla nalezena.</p>
      }
    </div>
  `,
  styles: [WARDROBE_STYLES, `
    .visit-item[data-state='verified'] { border-left: 4px solid var(--status-ok-fg); }
    .visit-item[data-state='not-presented'] { border-left: 4px solid var(--color-primary); }
    .check-buttons { margin: var(--spacing-xs) 0; }
    .check-buttons .btn-secondary { min-height: 44px; }
    .recap { margin-top: var(--spacing-lg); }
  `],
})
export class WardrobeInventoryVisitComponent {
  private costumes = inject(CostumesService);
  private inventories = inject(InventoryService);
  private members = inject(MembersService).members;
  private canManage = inject(AccessService).canManageCostumes;
  readonly state = toSignal(this.costumes.state$);
  private route = inject(ActivatedRoute);
  private id = Number(this.route.snapshot.paramMap.get('id'));
  readonly key = this.route.snapshot.paramMap.get('key') ?? '';
  private borrower = parseBorrowerKey(this.key);

  readonly conditions: ItemCondition[] = ['ok', 'damaged', 'needs-alteration'];
  readonly conditionLabels = CONDITION_LABELS;
  readonly statusLabels = VISIT_STATUS_LABELS;
  readonly notes = signal<Partial<Record<number, string>>>({});
  readonly visitNote = signal('');
  readonly issuing = signal(false);
  readonly issueIds = signal<number[]>([]);
  readonly error = signal('');

  readonly canEdit = computed(() => this.canManage() && !!this.view() && !this.view()!.inv.closure);

  readonly view = computed(() => {
    const state = this.state();
    const inv = state?.inventories.find((i) => i.id === this.id);
    if (!state || !inv || !this.borrower) return null;
    const borrower = this.borrower;
    const checks = activeChecks(state, inv.id);
    const visit = currentVisit(state, inv.id, borrower);
    const rows = targetHoldings(state, inv, borrower)
      .map((h) => ({ ...h, check: itemInventoryState(checks, h.item.id) }))
      .sort((a, b) => itemLabel(state, a.item).localeCompare(itemLabel(state, b.item), 'cs'));
    const ended = targetLoansEndedDuringInventory(state, inv, borrower)
      .filter((l) => !rows.some((r) => r.item.id === l.itemId))
      .map((loan) => {
        const item = state.items.find((i) => i.id === loan.itemId)!;
        const current = openLoanFor(state, item.id);
        return { loan, item, state: itemInventoryState(checks, item.id).state, now: current ? borrowerLabel(current.borrower, this.members(), state.externals) : 've skladu' };
      });
    return {
      inv,
      visit,
      slot: state.inventorySlots.find((s) => s.id === visit?.slotId),
      active: !inv.closure && this.canManage() && visit?.status === 'in-progress',
      label: borrowerLabel(borrower, this.members(), state.externals),
      rows,
      ended,
      others: holdingsOf(state, borrower).filter((h) => !isInTarget(inv, h.item.id)).length,
      recap: visitRecap(state, inv, borrower, visit?.id),
    };
  });

  readonly preferredGender = computed(() => {
    const state = this.state();
    return state ? defaultCostumeOf(state, this.borrower) : undefined;
  });
  readonly available = computed(() => {
    const state = this.state();
    return state ? sortItems(state, state.items.filter((i) => itemAvailability(state, i) === 'available')) : [];
  });

  part = (item: CostumeItem) => itemPartLabel(this.state()!, item);
  number = itemNumberLabel;
  series = (item: CostumeItem) => seriesLabel(this.state()!, findSeries(this.state()!, item.seriesId));
  label = (item: CostumeItem) => itemLabel(this.state()!, item);
  itemName = (id: number) => this.label(this.state()!.items.find((i) => i.id === id)!);
  names = (items: CostumeItem[]) => items.map((i) => `${this.part(i)} ${this.number(i)}`).join(', ');
  name = (id: number | undefined) => memberName(this.members(), id) || 'krojařka';

  setNote(itemId: number, note: string): void {
    this.notes.update((n) => ({ ...n, [itemId]: note }));
  }

  startVisit(): void {
    this.run(this.inventories.startVisit(this.id, this.borrower!));
  }

  check(item: CostumeItem, presented: boolean, condition?: ItemCondition): void {
    const note = this.notes()[item.id];
    this.run(
      this.inventories.recordCheck({ inventoryId: this.id, itemId: item.id, presented, condition, note, mode: 'person', visitId: this.view()!.visit!.id }),
      () => this.setNote(item.id, ''),
    );
  }

  revoke(checkId: number): void {
    this.run(this.inventories.revokeCheck(checkId));
  }

  issue(): void {
    this.run(
      this.costumes.issueItems({ borrower: this.borrower!, itemIds: this.issueIds(), inventoryId: this.id, visitId: this.view()!.visit!.id }),
      () => { this.issueIds.set([]); this.issuing.set(false); },
    );
  }

  complete(): void {
    this.run(this.inventories.completeVisit(this.view()!.visit!.id, this.visitNote()));
  }

  private run(obs: Observable<unknown>, done?: () => void): void {
    this.error.set('');
    obs.subscribe({ next: () => done?.(), error: (e) => this.error.set(errorMessage(e)) });
  }
}


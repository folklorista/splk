import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { InventoryService } from '../../inventory.service';
import { MembersService } from '../../../members/members.service';
import { AccessService } from '../../../../core/access/access.service';
import { CONDITION_LABELS, CostumeItem } from '../../models/costume.model';
import { VISIT_STATUS_LABELS } from '../../models/inventory.model';
import {
  borrowerLabel,
  dateTimeInputToIso,
  isWorkOrderOpen,
  itemLabel,
  matchesSearch,
  memberName,
  openLoanFor,
  sortItems,
} from '../../utils/costume-logic';
import {
  PersonInventoryStatus,
  activeChecks,
  canCloseCleanly,
  inventoryProgress,
  inventorySlots,
  isInTarget,
  itemInventoryState,
  personRows,
  slotBookings,
  stockGroups,
  targetItemIds,
} from '../../utils/inventory-logic';
import { downloadCsv } from '../../../../shared/export/export.utils';
import { WardrobeNavComponent } from '../shared/wardrobe-nav.component';
import { errorMessage } from '../shared/wardrobe-ui';
import { WARDROBE_STYLES } from '../shared/wardrobe.styles';

type Tab = 'people' | 'stock' | 'slots' | 'issues';

// Inventura: jeden rozsah, dva pracovní režimy (Podle lidí / Ve skladu) nad společnými kontrolami.
// Průběh návštěv, pokrytí kusů a nesrovnalosti se počítají zvlášť.
@Component({
  selector: 'app-wardrobe-inventory-detail',
  standalone: true,
  imports: [WardrobeNavComponent, RouterLink, DatePipe],
  template: `
    <div class="page">
      <app-wardrobe-nav />
      <a routerLink="/app/wardrobe/inventories" class="back-link no-print">← Inventury</a>
      @if (view(); as v) {
        <h1 class="page__title">{{ v.inv.name }}</h1>
        <p class="muted">{{ v.inv.scopeLabel }} · zahájeno {{ v.inv.startedAt | date: 'd. M. yyyy' }} ({{ name(v.inv.startedByMemberId) }}) · rozsah zmrazen na {{ v.inv.targetItemIds.length }} kusů@if (v.inv.additions.length) {, výslovně přidáno {{ v.inv.additions.length }}}</p>
        @if (v.inv.closure; as c) {
          <div [class]="c.withDiscrepancies ? 'warn-box' : 'info-box'">
            Uzavřeno {{ c.at | date: 'd. M. yyyy H:mm' }} ({{ name(c.byMemberId) }}).
            @if (c.withDiscrepancies) {
              <strong>Administrativně s nevyřešenými nesrovnalostmi</strong> – fyzicky ověřeno {{ c.verified }} z {{ c.total }}, nepředloženo {{ c.notPresented }}, nezkontrolováno {{ c.unchecked }}. Důvod: {{ c.reason }}
            } @else { Všechny cílové kusy byly fyzicky ověřeny. }
          </div>
        }
        @if (error()) { <div class="error-box" role="alert">{{ error() }}</div> }

        <div class="stats">
          <div class="stat"><span class="stat__value">{{ v.p.completed }} / {{ v.p.people }}</span><span class="stat__label">lidí odbaveno · objednáno {{ v.p.booked }}, neobjednáno {{ v.p.notBooked }}</span></div>
          <div class="stat"><span class="stat__value">{{ v.p.verified }} / {{ v.p.total }}</span><span class="stat__label">unikátních kusů fyzicky ověřeno</span>
            <div class="progress"><div class="progress__bar" [style.width.%]="v.p.total ? (v.p.verified / v.p.total) * 100 : 0"></div></div></div>
          <div class="stat"><span class="stat__value">{{ v.p.notPresented + v.p.unchecked }}</span><span class="stat__label">otevřeno: nepředloženo {{ v.p.notPresented }}, nezkontrolováno {{ v.p.unchecked }}</span></div>
          <div class="stat"><span class="stat__value">{{ v.p.damaged + v.p.needsAlteration }}</span><span class="stat__label">poškozeno {{ v.p.damaged }} · k úpravě {{ v.p.needsAlteration }} · úkoly {{ v.p.openWorkOrders }}</span></div>
        </div>

        <div class="segmented no-print" role="tablist">
          @for (t of tabs; track t.id) {
            <button type="button" class="segmented__btn" [class.segmented__btn--active]="tab() === t.id" (click)="setTab(t.id)">{{ t.label }}</button>
          }
        </div>

        @switch (tab()) {
          @case ('people') {
            <p class="muted">Lidé, kteří drží (nebo při zahájení drželi) aspoň jeden kus z rozsahu. Kontrola probíhá při návštěvě.</p>
            <div class="toolbar no-print">
              <div class="segmented">
                @for (f of personFilters; track f.id) {
                  <button type="button" class="segmented__btn" [class.segmented__btn--active]="personFilter() === f.id" (click)="personFilter.set(f.id)">{{ f.label }} ({{ count(f.id) }})</button>
                }
              </div>
              <input class="input input--search" type="search" placeholder="Hledat…" [value]="search()" (input)="search.set($any($event.target).value)" />
            </div>
            <ul class="item-list">
              @for (r of people(); track r.key) {
                <li class="item-list__item item-list__item--link" [routerLink]="['/app/wardrobe/inventories', v.inv.id, 'visit', r.key]">
                  <div class="item-list__row">
                    <span class="item-list__title">{{ r.label }}</span>
                    <span class="item-list__badges">
                      <span class="badge" [class.badge--ok]="r.status === 'completed'" [class.badge--muted]="r.status === 'not-booked'">{{ statusLabel(r.status) }}</span>
                      @if (r.notPresented) { <span class="badge badge--alert">nepředloženo {{ r.notPresented }}</span> }
                    </span>
                  </div>
                  <div class="item-list__meta">
                    ověřeno {{ r.verified }} / {{ r.held }} kusů
                    @if (r.slot) { · termín {{ r.slot.startsAt | date: 'd. M. H:mm' }} }
                  </div>
                </li>
              } @empty { <li class="state-note">Nikdo v tomto výběru.</li> }
            </ul>
          }
          @case ('stock') {
            <p class="muted">Nezapůjčené kusy z rozsahu po evidenčních řadách. Otevřete řadu a zadávejte čísla (i diktovaná, např. „1, 3, 7, 12-15“).</p>
            <ul class="item-list">
              @for (g of v.stock; track g.series.id) {
                <li class="item-list__item item-list__item--link" [routerLink]="['/app/wardrobe/inventories', v.inv.id, 'stock', g.series.id]">
                  <div class="item-list__row">
                    <span class="item-list__title">{{ g.label }}</span>
                    <span class="badge" [class.badge--ok]="g.verified === g.items.length">{{ g.verified }} / {{ g.items.length }}</span>
                  </div>
                  <div class="progress"><div class="progress__bar" [style.width.%]="(g.verified / g.items.length) * 100"></div></div>
                </li>
              } @empty { <li class="state-note">V rozsahu nejsou žádné nezapůjčené kusy (inventura skupiny kontroluje jen zapůjčené).</li> }
            </ul>
          }
          @case ('slots') {
            <p class="muted">Termíny návštěv – přihlásit se mohou jen dotčení lidé, kapacita se dodržuje.</p>
            <ul class="item-list">
              @for (s of v.slots; track s.slot.id) {
                <li class="item-list__item">
                  <div class="item-list__row">
                    <span class="item-list__title">{{ s.slot.startsAt | date: 'd. M. yyyy H:mm' }}@if (s.slot.endsAt) {–{{ s.slot.endsAt | date: 'H:mm' }}}</span>
                    <span class="badge" [class.badge--muted]="s.bookings.length >= s.slot.capacity">{{ s.bookings.length }} / {{ s.slot.capacity }}</span>
                  </div>
                  <div class="item-list__meta">{{ s.slot.place }}@if (s.names.length) { · {{ s.names.join(', ') }} }</div>
                  @if (canEdit() && !s.bookings.length) { <button type="button" class="btn-link no-print" (click)="removeSlot(s.slot.id)">Odebrat termín</button> }
                </li>
              } @empty { <li class="state-note">Zatím žádné termíny.</li> }
            </ul>
            @if (canEdit()) {
              <div class="panel stack no-print">
                <strong>Nový termín</strong>
                <div class="fields">
                  <label class="field">Začátek<input class="input" type="datetime-local" [value]="slotStart()" (input)="slotStart.set($any($event.target).value)" /></label>
                  <label class="field">Konec<input class="input" type="datetime-local" [value]="slotEnd()" (input)="slotEnd.set($any($event.target).value)" /></label>
                  <label class="field">Kapacita (osob)<input class="input" type="number" min="1" inputmode="numeric" [value]="slotCapacity()" (input)="slotCapacity.set(+$any($event.target).value)" /></label>
                  <label class="field">Místo<input class="input" [value]="slotPlace()" (input)="slotPlace.set($any($event.target).value)" /></label>
                </div>
                <button type="button" class="btn-primary btn-primary--sm" (click)="addSlot()">Přidat termín</button>
              </div>
            }
          }
          @case ('issues') {
            <h2 class="group-title">Nepředložené kusy ({{ v.issues.notPresented.length }})</h2>
            <ul class="item-list">
              @for (r of v.issues.notPresented; track r.item.id) {
                <li class="item-list__item"><a class="link" [routerLink]="['/app/wardrobe/stock', r.item.id]">{{ r.label }}</a><div class="item-list__meta">{{ r.holder }} @if (r.note) { · {{ r.note }} }</div></li>
              } @empty { <li class="muted">Žádné.</li> }
            </ul>
            <h2 class="group-title">Dosud nezkontrolované ({{ v.issues.unchecked.length }})</h2>
            <ul class="item-list">
              @for (r of v.issues.unchecked; track r.item.id) {
                <li class="item-list__item"><a class="link" [routerLink]="['/app/wardrobe/stock', r.item.id]">{{ r.label }}</a><div class="item-list__meta">{{ r.holder }}</div></li>
              } @empty { <li class="muted">Žádné.</li> }
            </ul>
            <h2 class="group-title">Poškozené / k úpravě a otevřené úkoly</h2>
            <ul class="item-list">
              @for (r of v.issues.attention; track r.item.id) {
                <li class="item-list__item"><a class="link" [routerLink]="['/app/wardrobe/stock', r.item.id]">{{ r.label }}</a><div class="item-list__meta">{{ r.holder }}</div></li>
              } @empty { <li class="muted">Žádné.</li> }
            </ul>

            @if (canEdit()) {
              <div class="panel stack no-print">
                <strong>Výslovně přidat kus do rozsahu</strong>
                <p class="muted">Kus mimo zmrazený rozsah se nikdy nepřidá potichu – uveďte důvod (zůstane v auditu).</p>
                <input class="input" type="search" placeholder="Hledat kus…" [value]="addSearch()" (input)="addSearch.set($any($event.target).value)" />
                @if (addSearch()) {
                  <select class="input" size="5" (change)="addItemId.set(+$any($event.target).value)">
                    @for (i of addCandidates(); track i.id) { <option [value]="i.id">{{ label(i) }}</option> }
                  </select>
                }
                <input class="input" placeholder="Důvod přidání *" [value]="addNote()" (input)="addNote.set($any($event.target).value)" />
                <button type="button" class="btn-secondary" [disabled]="!addItemId()" (click)="addItem()">Přidat do inventury</button>
              </div>
              @if (v.inv.additions.length) {
                <ul class="muted">@for (a of v.inv.additions; track a.itemId) { <li>{{ itemName(a.itemId) }} – přidáno {{ a.at | date: 'd. M. yyyy' }} ({{ name(a.byMemberId) }}): {{ a.note }}</li> }</ul>
              }

              <div class="panel stack no-print">
                <strong>Uzavření inventury</strong>
                <p>Fyzicky ověřeno <strong>{{ v.p.verified }} z {{ v.p.total }}</strong> kusů · nepředloženo {{ v.p.notPresented }} · nezkontrolováno {{ v.p.unchecked }} · otevřené úkoly {{ v.p.openWorkOrders }} (mohou zůstat otevřené i po uzavření).</p>
                @if (v.clean) {
                  <button type="button" class="btn-primary btn-primary--sm" (click)="close(false)">Uzavřít – vše ověřeno</button>
                } @else {
                  <div class="warn-box">Ne všechny kusy byly fyzicky ověřeny. Inventuru lze uzavřít jen administrativně s nesrovnalostmi – nebude uvedeno, že bylo vše zkontrolováno.</div>
                  <input class="input" placeholder="Důvod uzavření s nesrovnalostmi *" [value]="closeReason()" (input)="closeReason.set($any($event.target).value)" />
                  <label class="check"><input type="checkbox" [checked]="closeConfirm()" (change)="closeConfirm.set($any($event.target).checked)" /> Beru na vědomí, že {{ v.p.total - v.p.verified }} kusů zůstává neověřených.</label>
                  <button type="button" class="btn-primary btn-primary--sm" [disabled]="!closeConfirm() || !closeReason().trim()" (click)="close(true)">Uzavřít s nesrovnalostmi</button>
                }
              </div>
            }
            <button type="button" class="btn-secondary no-print" (click)="exportCsv()">Export výsledků CSV</button>
          }
        }
      } @else {
        <p class="state-note">Inventura nebyla nalezena.</p>
      }
    </div>
  `,
  styles: [WARDROBE_STYLES, `.segmented { margin-bottom: var(--spacing-md); flex-wrap: wrap; }`],
})
export class WardrobeInventoryDetailComponent {
  private inventories = inject(InventoryService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private members = inject(MembersService).members;
  private canManage = inject(AccessService).canManageCostumes;
  readonly state = toSignal(this.inventories.state$);
  private id = Number(this.route.snapshot.paramMap.get('id'));

  readonly tabs: { id: Tab; label: string }[] = [
    { id: 'people', label: 'Podle lidí' },
    { id: 'stock', label: 'Ve skladu' },
    { id: 'slots', label: 'Termíny' },
    { id: 'issues', label: 'Nesrovnalosti a uzavření' },
  ];
  readonly personFilters: { id: PersonInventoryStatus | 'all'; label: string }[] = [
    { id: 'all', label: 'Všichni' },
    { id: 'not-booked', label: 'Neobjednaní' },
    { id: 'booked', label: 'Objednaní' },
    { id: 'completed', label: 'Odbavení' },
  ];
  readonly tab = signal<Tab>((this.route.snapshot.queryParamMap.get('tab') as Tab) || 'people');
  readonly personFilter = signal<PersonInventoryStatus | 'all'>('all');
  readonly search = signal('');
  readonly slotStart = signal('');
  readonly slotEnd = signal('');
  readonly slotCapacity = signal(this.state()?.inventories.find((i) => i.id === this.id)?.slotCapacity ?? 3);
  readonly slotPlace = signal('Sklad');
  readonly addSearch = signal('');
  readonly addItemId = signal<number | null>(null);
  readonly addNote = signal('');
  readonly closeReason = signal('');
  readonly closeConfirm = signal(false);
  readonly error = signal('');

  readonly view = computed(() => {
    const state = this.state();
    const inv = state?.inventories.find((i) => i.id === this.id);
    if (!state || !inv) return null;
    const checks = activeChecks(state, inv.id);
    const holder = (item: CostumeItem) => {
      const loan = openLoanFor(state, item.id);
      return loan ? `u: ${borrowerLabel(loan.borrower, this.members(), state.externals)}` : `sklad (${item.location === 'store' ? 've skladu' : 'mimo sklad'})`;
    };
    const targets = sortItems(state, targetItemIds(inv).map((id) => state.items.find((i) => i.id === id)!).filter(Boolean));
    const row = (item: CostumeItem) => ({ item, label: itemLabel(state, item), holder: holder(item), note: itemInventoryState(checks, item.id).latest?.note });
    const p = inventoryProgress(state, inv);
    return {
      inv,
      p,
      clean: canCloseCleanly(p),
      stock: stockGroups(state, inv),
      slots: inventorySlots(state, inv.id).map((slot) => {
        const bookings = slotBookings(state, slot.id);
        return { slot, bookings, names: bookings.map((b) => borrowerLabel(b.borrower, this.members(), state.externals)) };
      }),
      issues: {
        notPresented: targets.filter((i) => itemInventoryState(checks, i.id).state === 'not-presented').map(row),
        unchecked: targets.filter((i) => itemInventoryState(checks, i.id).state === 'unchecked').map(row),
        attention: targets
          .filter((i) => i.condition !== 'ok' || state.workOrders.some((o) => o.itemId === i.id && isWorkOrderOpen(o)))
          .map((i) => ({ ...row(i), holder: `${CONDITION_LABELS[i.condition]}${state.workOrders.some((o) => o.itemId === i.id && isWorkOrderOpen(o)) ? ' · otevřený úkol' : ''}` })),
      },
      rows: personRows(state, inv).map((r) => ({ ...r, label: borrowerLabel(r.borrower, this.members(), state.externals) })),
    };
  });

  readonly canEdit = computed(() => this.canManage() && !this.view()?.inv.closure);
  readonly people = computed(() =>
    (this.view()?.rows ?? [])
      .filter((r) => this.personFilter() === 'all' || r.status === this.personFilter() || (this.personFilter() === 'booked' && r.status === 'in-progress'))
      .filter((r) => matchesSearch(r.label, this.search()))
      .sort((a, b) => a.label.localeCompare(b.label, 'cs')),
  );
  readonly addCandidates = computed(() => {
    const state = this.state();
    const inv = this.view()?.inv;
    if (!state || !inv) return [];
    return sortItems(state, state.items.filter((i) => !i.retired && !isInTarget(inv, i.id) && matchesSearch(itemLabel(state, i), this.addSearch()))).slice(0, 50);
  });

  count(id: PersonInventoryStatus | 'all'): number {
    const rows = this.view()?.rows ?? [];
    return id === 'all' ? rows.length : rows.filter((r) => r.status === id || (id === 'booked' && r.status === 'in-progress')).length;
  }

  statusLabel(status: PersonInventoryStatus): string {
    return status === 'not-booked' ? 'Neobjednán' : VISIT_STATUS_LABELS[status];
  }

  name = (id: number) => memberName(this.members(), id) || 'krojařka';
  label = (item: CostumeItem) => itemLabel(this.state()!, item);
  itemName = (id: number) => this.label(this.state()!.items.find((i) => i.id === id)!);

  setTab(tab: Tab): void {
    this.tab.set(tab);
    this.router.navigate([], { queryParams: { tab }, replaceUrl: true });
  }

  addSlot(): void {
    const startsAt = dateTimeInputToIso(this.slotStart());
    this.run(this.inventories.addSlot(this.id, { startsAt: startsAt ?? '', endsAt: dateTimeInputToIso(this.slotEnd()), capacity: this.slotCapacity(), place: this.slotPlace() }), () => {
      this.slotStart.set('');
      this.slotEnd.set('');
    });
  }

  removeSlot(slotId: number): void {
    this.run(this.inventories.removeSlot(slotId));
  }

  addItem(): void {
    this.run(this.inventories.addItem(this.id, this.addItemId()!, this.addNote()), () => {
      this.addItemId.set(null);
      this.addNote.set('');
      this.addSearch.set('');
    });
  }

  close(withDiscrepancies: boolean): void {
    this.run(this.inventories.closeInventory(this.id, { acceptDiscrepancies: withDiscrepancies, reason: this.closeReason() }));
  }

  exportCsv(): void {
    const state = this.state()!;
    const inv = this.view()!.inv;
    const checks = activeChecks(state, inv.id);
    downloadCsv(`inventura-${inv.id}`, [
      ['Kus', 'Držitel / umístění', 'Výsledek', 'Stav', 'Poznámka'],
      ...sortItems(state, targetItemIds(inv).map((id) => state.items.find((i) => i.id === id)!)).map((item) => {
        const s = itemInventoryState(checks, item.id);
        const loan = openLoanFor(state, item.id);
        return [
          itemLabel(state, item),
          loan ? borrowerLabel(loan.borrower, this.members(), state.externals) : 'sklad',
          s.state === 'verified' ? 'fyzicky ověřeno' : s.state === 'not-presented' ? 'nepředloženo' : 'nezkontrolováno',
          s.latest?.condition ? CONDITION_LABELS[s.latest.condition] : '',
          s.latest?.note ?? '',
        ];
      }),
    ]);
  }

  private run(obs: Observable<unknown>, done?: () => void): void {
    this.error.set('');
    obs.subscribe({ next: () => done?.(), error: (e) => this.error.set(errorMessage(e)) });
  }
}

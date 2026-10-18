import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { CostumesService } from '../costumes.service';
import { InventoryService } from '../inventory.service';
import { AccessService } from '../../../core/access/access.service';
import { Borrower } from '../models/costume.model';
import { Inventory, InventorySlot } from '../models/inventory.model';
import { cardGroups, holdingsOf, isLoanOverdue, itemNumberLabel, itemPartLabel, seriesLabel, findSeries } from '../utils/costume-logic';
import { activeChecks, currentVisit, inventorySlots, invitationsFor, itemInventoryState, slotFree, targetHoldings } from '../utils/inventory-logic';
import { errorMessage } from '../wardrobe/shared/wardrobe-ui';
import { WARDROBE_STYLES } from '../wardrobe/shared/wardrobe.styles';

// „Moje kroje“ – osobní krojová karta přihlášeného člena (jen ke čtení) a inventurní výzvy.
// Samostatná stránka; správa fondu je v Krojárně (/app/wardrobe).
@Component({
  selector: 'app-my-costumes-page',
  standalone: true,
  imports: [DatePipe, RouterLink],
  template: `
    <div class="page">
      <div class="page__header">
        <h1 class="page__title">Moje kroje</h1>
        @if (canViewWardrobe()) {
          <a class="btn-secondary no-print" routerLink="/app/wardrobe">Krojárna →</a>
        }
      </div>

      @if (error()) { <div class="error-box" role="alert">{{ error() }}</div> }

      @for (inv of invitations(); track inv.inventory.id) {
        <section class="detail invitation">
          <h2 class="detail__section-title">Inventura: {{ inv.inventory.name }}</h2>
          @if (inv.visit?.status === 'completed') {
            <p>Vaše kontrola proběhla {{ inv.visit!.completedAt | date: 'd. M. yyyy' }}.
              @if (inv.toBring.length) { Ještě je potřeba donést: }
            </p>
          } @else {
            <p>Krojárna kontroluje kroje. Přineste prosím na zvolený termín tyto kusy:</p>
          }
          @if (inv.toBring.length) {
            <ul class="bring-list">
              @for (row of inv.toBring; track row.id) {
                <li><strong>{{ row.part }}</strong> <span class="code">{{ row.number }}</span> <span class="muted">· {{ row.series }}</span></li>
              }
            </ul>
          } @else {
            <p class="muted">Všechny vaše kusy z této inventury jsou už zkontrolované.</p>
          }

          @if (inv.visit?.status === 'booked' && inv.slot) {
            <div class="info-box">
              Jste přihlášeni na <strong>{{ inv.slot.startsAt | date: 'd. M. yyyy H:mm' }}</strong>
              @if (inv.slot.place) { · {{ inv.slot.place }} }
              <button type="button" class="btn-link" [disabled]="busy()" (click)="cancel(inv.visit!.id)">Zrušit rezervaci</button>
            </div>
          }
          @if (inv.toBring.length && inv.visit?.status !== 'in-progress') {
            <h3 class="group-title">{{ inv.visit?.status === 'booked' ? 'Změnit termín' : 'Vyberte termín' }}</h3>
            @if (!inv.slots.length) {
              <p class="state-note">Krojárna zatím nevypsala žádné termíny.</p>
            }
            <ul class="item-list">
              @for (s of inv.slots; track s.slot.id) {
                <li class="item-list__item">
                  <div class="item-list__row">
                    <span class="item-list__title">{{ s.slot.startsAt | date: 'd. M. yyyy H:mm' }}@if (s.slot.endsAt) {–{{ s.slot.endsAt | date: 'H:mm' }}}</span>
                    @if (s.mine) {
                      <span class="badge badge--ok">Váš termín</span>
                    } @else if (s.free < 1) {
                      <span class="badge badge--muted">Obsazeno</span>
                    } @else {
                      <button type="button" class="btn-primary btn-primary--sm" [disabled]="busy()" (click)="book(inv.inventory, s.slot)">Přihlásit se</button>
                    }
                  </div>
                  <div class="item-list__meta">{{ s.slot.place }} · volno {{ s.free }} z {{ s.slot.capacity }}</div>
                </li>
              }
            </ul>
          }
        </section>
      }

      @if (groups(); as list) {
        @if (list.length) {
          @for (group of list; track group.key) {
            <h2 class="group-title">{{ group.title }}</h2>
            <ul class="item-list">
              @for (h of group.holdings; track h.loan.id) {
                <li class="item-list__item">
                  <div class="item-list__row">
                    <span class="item-list__title">{{ part(h.item) }} <span class="code">{{ number(h.item) }}</span></span>
                    @if (overdue(h.loan)) { <span class="badge badge--alert">Po termínu</span> }
                  </div>
                  <div class="item-list__meta">
                    řada {{ series(h.item) }}
                    @if (h.item.size) { · vel. {{ h.item.size }} }
                    · od {{ h.loan.issuedAt | date: 'd. M. yyyy' }}
                    · {{ h.loan.dueAt ? 'vrátit do ' + (h.loan.dueAt | date: 'd. M. yyyy') : 'dlouhodobě' }}
                  </div>
                </li>
              }
            </ul>
          }
        } @else {
          <p class="state-note">Nemáte zapůjčenou žádnou součástku kroje. Když vám krojárna něco vydá, uvidíte to tady.</p>
        }
        <p class="muted">Každý kus je zapůjčen samostatně a označen řadou a číslem. Změnu nebo vrácení zapisuje krojárna – pokud něco předáte jinému členovi bez jejího vědomí, odpovídáte za to dál vy.</p>
      }
    </div>
  `,
  styles: [WARDROBE_STYLES, `.invitation { margin-bottom: var(--spacing-lg); border-left: 4px solid var(--color-primary); } .bring-list { padding-left: var(--spacing-lg); margin-bottom: var(--spacing-sm); list-style: disc; }`],
})
export class MyCostumesPageComponent {
  private access = inject(AccessService);
  private inventoryService = inject(InventoryService);
  private state = toSignal(inject(CostumesService).state$);

  readonly canViewWardrobe = this.access.canViewCostumeStock;
  readonly busy = signal(false);
  readonly error = signal('');

  private borrower = computed<Borrower | null>(() => {
    const id = this.access.memberId();
    return id === null ? null : { kind: 'member', memberId: id };
  });

  readonly groups = computed(() => {
    const state = this.state();
    const borrower = this.borrower();
    return state && borrower ? cardGroups(state, holdingsOf(state, borrower)) : null;
  });

  readonly invitations = computed(() => {
    const state = this.state();
    const borrower = this.borrower();
    if (!state || !borrower || borrower.kind !== 'member') return [];
    return invitationsFor(state, borrower.memberId).map((inventory) => {
      const checks = activeChecks(state, inventory.id);
      const visit = currentVisit(state, inventory.id, borrower);
      const toBring = targetHoldings(state, inventory, borrower)
        .filter((h) => !itemInventoryState(checks, h.item.id).verified)
        .map((h) => ({ id: h.item.id, part: itemPartLabel(state, h.item), number: itemNumberLabel(h.item), series: seriesLabel(state, findSeries(state, h.item.seriesId)) }));
      const slots = inventorySlots(state, inventory.id)
        .filter((s) => new Date(s.startsAt) > new Date())
        .map((slot) => ({ slot, free: slotFree(state, slot), mine: visit?.slotId === slot.id && visit.status === 'booked' }));
      return { inventory, visit, slot: state.inventorySlots.find((s) => s.id === visit?.slotId), toBring, slots };
    });
  });

  part = (item: Parameters<typeof itemPartLabel>[1]) => itemPartLabel(this.state()!, item);
  number = itemNumberLabel;
  series = (item: Parameters<typeof itemPartLabel>[1]) => seriesLabel(this.state()!, findSeries(this.state()!, item.seriesId));
  overdue = (loan: Parameters<typeof isLoanOverdue>[0]) => isLoanOverdue(loan);

  book(inventory: Inventory, slot: InventorySlot): void {
    this.run(this.inventoryService.bookSlot(inventory.id, slot.id));
  }

  cancel(visitId: number): void {
    this.run(this.inventoryService.cancelBooking(visitId));
  }

  private run(obs: ReturnType<InventoryService['cancelBooking']>): void {
    this.busy.set(true);
    this.error.set('');
    obs.subscribe({
      next: () => this.busy.set(false),
      error: (e) => { this.busy.set(false); this.error.set(errorMessage(e)); },
    });
  }
}

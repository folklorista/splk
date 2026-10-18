import { Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CostumesService } from '../../costumes.service';
import { MembersService } from '../../../members/members.service';
import { AccessService } from '../../../../core/access/access.service';
import { CONDITION_LABELS, CostumeItem } from '../../models/costume.model';
import {
  borrowerLabel,
  cardGroups,
  holdingsOf,
  isLoanOverdue,
  itemLabel,
  itemNumberLabel,
  itemPartLabel,
  parseBorrowerKey,
  sameBorrower,
  seriesLabel,
  findSeries,
} from '../../utils/costume-logic';
import { WardrobeNavComponent } from '../shared/wardrobe-nav.component';
import { LoanActionsComponent } from '../shared/loan-actions.component';
import { WARDROBE_STYLES } from '../shared/wardrobe.styles';

// Krojová karta držitele: jednotlivě zapůjčené kusy seskupené podle kroje (jen pro čitelnost),
// upozornění na chybějící druhy podle šablon kompletů, operace vrátit/vyměnit/úkol a historie.
@Component({
  selector: 'app-wardrobe-card-detail',
  standalone: true,
  imports: [WardrobeNavComponent, RouterLink, DatePipe, LoanActionsComponent],
  template: `
    <div class="page">
      <app-wardrobe-nav />
      <a routerLink="/app/wardrobe/cards" class="back-link no-print">← Krojové karty</a>
      @if (view(); as v) {
        <div class="page__header">
          <h1 class="page__title">{{ v.label }}</h1>
          @if (canManage()) { <a class="btn-primary btn-primary--sm no-print" routerLink="/app/wardrobe/loans/new" [queryParams]="{ borrower: key }">+ Vydat kusy</a> }
        </div>
        @if (!v.groups.length) { <p class="state-note">Nemá zapůjčený žádný kus.</p> }
        @for (group of v.groups; track group.key) {
          <h2 class="group-title">{{ group.title }}</h2>
          @for (m of group.missing; track m.templateName) {
            <p class="warn-box">Podle šablony „{{ m.templateName }}“ v kartě chybí: {{ m.partTypes.join(', ') }}. (Jen upozornění – komplet není podmínkou výpůjčky.)</p>
          }
          <ul class="item-list">
            @for (h of group.holdings; track h.loan.id) {
              <li class="item-list__item">
                <div class="item-list__row">
                  <a class="item-list__title link" [routerLink]="['/app/wardrobe/stock', h.item.id]">{{ part(h.item) }} <span class="code">{{ number(h.item) }}</span></a>
                  <span class="item-list__badges">
                    @if (h.item.condition !== 'ok') { <span class="badge badge--warn">{{ conditionLabels[h.item.condition] }}</span> }
                    @if (overdue(h.loan)) { <span class="badge badge--alert">Po termínu</span> }
                  </span>
                </div>
                <div class="item-list__meta">řada {{ series(h.item) }}@if (h.item.size) { · vel. {{ h.item.size }} } · od {{ h.loan.issuedAt | date: 'd. M. yyyy' }} · {{ h.loan.dueAt ? 'vrátit do ' + (h.loan.dueAt | date: 'd. M. yyyy') : 'dlouhodobě' }}</div>
                @if (canManage()) { <app-loan-actions [state]="state()!" [loan]="h.loan" [item]="h.item" /> }
              </li>
            }
          </ul>
        }

        <h2 class="group-title">Historie výpůjček</h2>
        <div class="table-wrap">
          <table class="table">
            <tr><th>Kus</th><th>Vydáno</th><th>Vráceno</th><th>Poznámka</th></tr>
            @for (l of v.history; track l.loan.id) {
              <tr><td>{{ l.label }}</td><td>{{ l.loan.issuedAt | date: 'd. M. yyyy' }}</td><td>{{ l.loan.endedAt | date: 'd. M. yyyy' }} {{ l.loan.endReason === 'exchanged' ? '(výměna)' : l.loan.endReason === 'settled' ? '(vypořádáno)' : '' }}</td><td>{{ l.loan.endNote }}</td></tr>
            } @empty { <tr><td colspan="4" class="muted">Žádné ukončené výpůjčky.</td></tr> }
          </table>
        </div>
      } @else {
        <p class="state-note">Držitel nebyl nalezen.</p>
      }
    </div>
  `,
  styles: [WARDROBE_STYLES],
})
export class WardrobeCardDetailComponent {
  private members = inject(MembersService).members;
  readonly canManage = inject(AccessService).canManageCostumes;
  readonly state = toSignal(inject(CostumesService).state$);
  readonly key = inject(ActivatedRoute).snapshot.paramMap.get('key') ?? '';
  readonly conditionLabels = CONDITION_LABELS;

  readonly view = computed(() => {
    const state = this.state();
    const borrower = parseBorrowerKey(this.key);
    if (!state || !borrower) return null;
    return {
      label: borrowerLabel(borrower, this.members(), state.externals),
      groups: cardGroups(state, holdingsOf(state, borrower)),
      history: state.loans
        .filter((l) => l.endedAt && sameBorrower(l.borrower, borrower))
        .sort((a, b) => b.endedAt!.localeCompare(a.endedAt!))
        .map((loan) => ({ loan, label: itemLabel(state, state.items.find((i) => i.id === loan.itemId)!) })),
    };
  });

  part = (item: CostumeItem) => itemPartLabel(this.state()!, item);
  number = itemNumberLabel;
  series = (item: CostumeItem) => seriesLabel(this.state()!, findSeries(this.state()!, item.seriesId));
  overdue = (loan: Parameters<typeof isLoanOverdue>[0]) => isLoanOverdue(loan);
}

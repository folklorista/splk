import { Component, computed, inject, signal } from '@angular/core';
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
  defaultCostumeOf,
  matchesDefaultCostume,
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
import { errorMessage } from '../shared/wardrobe-ui';

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
        <div class="default-costume no-print">
          @if (canEditProfile()) {
            <label class="field">Výchozí kroj
              <select class="input" (change)="setDefault($any($event.target).value)" [disabled]="busy()">
                <option value="" [selected]="!v.defaultCostume">neurčeno – nabízet vše</option>
                @for (g of state()!.classification.genders; track g.id) { <option [value]="g.id" [selected]="g.id === v.defaultCostume">{{ g.label }}</option> }
              </select>
            </label>
            <p class="muted">Při vydávání se nejdřív nabízejí kusy výchozího kroje; ostatní jsou o klepnutí dál.</p>
          } @else {
            <p class="muted">Výchozí kroj: {{ v.defaultCostumeLabel || 'neurčeno' }}</p>
          }
          @if (error()) { <div class="error-box" role="alert">{{ error() }}</div> }
        </div>
        @if (!v.groups.length) { <p class="state-note">Nemá zapůjčený žádný kus.</p> }
        @for (group of v.groups; track group.key) {
          <h2 class="group-title">{{ group.title }}</h2>
          @for (m of group.missing; track m.templateName) {
            <p class="warn-box">Podle šablony „{{ m.templateName }}“ v kartě chybí: {{ m.partTypes.join(', ') }}. (Jen upozornění – komplet není podmínkou výpůjčky.)</p>
          }
          <ul class="item-list item-list--rows">
            @for (h of group.holdings; track h.loan.id) {
              <li class="item-list__item">
                <div class="item-list__row">
                  <a class="item-list__title link" [routerLink]="['/app/wardrobe/stock', h.item.id]">{{ part(h.item) }} <span class="code">{{ number(h.item) }}</span></a>
                  <span class="item-list__badges">
                    @if (h.item.condition !== 'ok') { <span class="badge badge--warn">{{ conditionLabels[h.item.condition] }}</span> }
                    @if (overdue(h.loan)) { <span class="badge badge--alert">Po termínu</span> }
                    @if (offDefault(h.item)) { <span class="badge">Mimo výchozí kroj</span> }
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
  styles: [WARDROBE_STYLES, `.default-costume { margin-bottom: var(--spacing-md); max-width: 360px; }`],
})
export class WardrobeCardDetailComponent {
  private members = inject(MembersService).members;
  private costumes = inject(CostumesService);
  private access = inject(AccessService);
  readonly canManage = this.access.canManageCostumes;
  // Výchozí kroj smí nastavit krojařka i Správa souboru (docs/06 kap. 5.1a)
  readonly canEditProfile = computed(() => this.access.canManageCostumes() || this.access.isEnsembleAdmin());
  readonly state = toSignal(this.costumes.state$);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly key = inject(ActivatedRoute).snapshot.paramMap.get('key') ?? '';
  readonly conditionLabels = CONDITION_LABELS;

  readonly view = computed(() => {
    const state = this.state();
    const borrower = parseBorrowerKey(this.key);
    if (!state || !borrower) return null;
    const defaultCostume = defaultCostumeOf(state, borrower);
    return {
      label: borrowerLabel(borrower, this.members(), state.externals),
      defaultCostume,
      defaultCostumeLabel: state.classification.genders.find((g) => g.id === defaultCostume)?.label,
      groups: cardGroups(state, holdingsOf(state, borrower)),
      history: state.loans
        .filter((l) => l.endedAt && sameBorrower(l.borrower, borrower))
        .sort((a, b) => b.endedAt!.localeCompare(a.endedAt!))
        .map((loan) => ({ loan, label: itemLabel(state, state.items.find((i) => i.id === loan.itemId)!) })),
    };
  });

  offDefault = (item: CostumeItem) => !matchesDefaultCostume(this.state()!, item, this.view()?.defaultCostume);

  setDefault(genderId: string): void {
    const borrower = parseBorrowerKey(this.key);
    if (!borrower) return;
    this.busy.set(true);
    this.error.set('');
    this.costumes.setDefaultCostume(borrower, genderId || undefined).subscribe({
      next: () => this.busy.set(false),
      error: (e) => { this.busy.set(false); this.error.set(errorMessage(e)); },
    });
  }

  part = (item: CostumeItem) => itemPartLabel(this.state()!, item);
  number = itemNumberLabel;
  series = (item: CostumeItem) => seriesLabel(this.state()!, findSeries(this.state()!, item.seriesId));
  overdue = (loan: Parameters<typeof isLoanOverdue>[0]) => isLoanOverdue(loan);
}

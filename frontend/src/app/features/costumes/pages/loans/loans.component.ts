import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { downloadCsv, formatDate, printPage } from '../../../../shared/export/export.utils';
import { MembersService } from '../../../members/members.service';
import { canManageCostumes } from '../../costume-permissions';
import { CostumesNavComponent } from '../../costumes-nav/costumes-nav.component';
import { CostumesService } from '../../costumes.service';
import { Borrower, Loan } from '../../models/costume.model';
import { borrowerLabel, isLoanOpen, isLoanOverdue, kitLabel, openLines } from '../../utils/costume-logic';
import { LOAN_PAGE_STYLES } from './loan-page.styles';
import { LoanFilter, filterLoans, loanPieces, openLinesCsvRows, todayInputValue } from './loan-utils';

@Component({
  selector: 'app-costume-loans',
  standalone: true,
  imports: [CostumesNavComponent, RouterLink],
  template: `
    <div class="page">
      <app-costumes-nav />
      <div class="page__header">
        <h1 class="page__title">Zápůjčky</h1>
        @if (canManage()) {
          <a routerLink="/app/costumes/loans/new" class="btn-primary btn-primary--sm no-print">+ Nová zápůjčka</a>
        }
      </div>

      <div class="toolbar no-print">
        <div class="segmented" role="tablist">
          @for (tab of tabs; track tab.value) {
            <button type="button" class="segmented__btn" [class.segmented__btn--active]="filter() === tab.value" (click)="filter.set(tab.value)">
              {{ tab.label }} ({{ counts()[tab.value] }})
            </button>
          }
        </div>
        <input class="input input--search" type="search" placeholder="Hledat vypůjčitele…" [value]="search()" (input)="search.set($any($event.target).value)" />
        <button type="button" class="btn-secondary" (click)="print()">Tisk</button>
        <button type="button" class="btn-secondary" (click)="exportCsv()">Export CSV</button>
      </div>

      <p class="print-only muted">{{ currentTabLabel() }} – stav k {{ today() }}</p>

      @if (loans().length === 0) {
        <p class="state-note">Žádné zápůjčky.</p>
      } @else {
        <ul class="item-list">
          @for (loan of loans(); track loan.id) {
            <li class="item-list__item item-list__item--link" [routerLink]="['/app/costumes/loans', loan.id]">
              <div class="item-list__row">
                <span class="item-list__title">{{ label(loan.borrower) }}</span>
                <span class="item-list__badges">
                  @if (overdue(loan)) { <span class="badge badge--overdue">Po termínu</span> }
                  @if (!open(loan)) { <span class="badge badge--muted">Uzavřeno</span> }
                  @if (loan.kitId !== undefined) { <span class="badge badge--ok">Komplet {{ kit(loan.kitId) }}</span> }
                </span>
              </div>
              <div class="item-list__meta">
                Vydáno {{ date(loan.issuedAt) }} ·
                @if (loan.longTerm) { dlouhodobě } @else if (loan.dueAt) { vrátit do {{ date(loan.dueAt) }} } @else { bez termínu }
                · u vypůjčitele {{ pieces(loan).held }} z {{ pieces(loan).total }} ks
              </div>
              @if (loan.note) { <div class="item-list__body">{{ loan.note }}</div> }
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: [LOAN_PAGE_STYLES],
})
export class CostumeLoansComponent {
  private costumes = inject(CostumesService);
  private auth = inject(AuthService);

  readonly state = toSignal(this.costumes.state$, { requireSync: true });
  readonly members = toSignal(inject(MembersService).getMembers(), { initialValue: [] });
  readonly canManage = computed(() => canManageCostumes(this.auth.currentUser()));

  readonly tabs: { value: LoanFilter; label: string }[] = [
    { value: 'open', label: 'Otevřené' },
    { value: 'overdue', label: 'Po termínu' },
    { value: 'all', label: 'Všechny' },
  ];
  readonly filter = signal<LoanFilter>('open');
  readonly search = signal('');

  private readonly labelOf = (b: Borrower) => borrowerLabel(b, this.members(), this.state().externals);

  readonly loans = computed(() => filterLoans(this.state().loans, this.filter(), this.search(), this.labelOf));
  readonly counts = computed(() => {
    const loans = this.state().loans;
    return {
      open: loans.filter((l) => isLoanOpen(l)).length,
      overdue: loans.filter((l) => isLoanOverdue(l)).length,
      all: loans.length,
    } as Record<LoanFilter, number>;
  });
  readonly currentTabLabel = computed(() => this.tabs.find((t) => t.value === this.filter())?.label ?? '');
  readonly today = () => formatDate(new Date().toISOString());

  label(borrower: Borrower): string {
    return this.labelOf(borrower);
  }

  kit(kitId: number): string {
    return kitLabel(this.state(), kitId);
  }

  date(iso: string | undefined): string {
    return formatDate(iso);
  }

  pieces(loan: Loan) {
    return loanPieces(loan);
  }

  open(loan: Loan): boolean {
    return isLoanOpen(loan);
  }

  overdue(loan: Loan): boolean {
    return isLoanOverdue(loan);
  }

  print(): void {
    printPage();
  }

  // Report nevrácených (případně po termínu) – řádek za každou věc u vypůjčitele
  exportCsv(): void {
    const loanIds = new Set(this.loans().map((l) => l.id));
    const lines = openLines(this.state()).filter(({ loan }) => loanIds.has(loan.id));
    const suffix = this.filter() === 'overdue' ? 'po-terminu' : 'nevracene';
    downloadCsv(`zapujcky-${suffix}-${todayInputValue()}`, openLinesCsvRows(this.state(), this.members(), lines));
  }
}

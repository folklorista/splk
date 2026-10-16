import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs/operators';
import { AuthService } from '../../../../core/auth/auth.service';
import { downloadCsv, formatDate, printPage } from '../../../../shared/export/export.utils';
import { MembersService } from '../../../members/members.service';
import { AccessService } from '../../../../core/access/access.service';
import { CostumesNavComponent } from '../../costumes-nav/costumes-nav.component';
import { CostumesService } from '../../costumes.service';
import { Loan, LoanLine } from '../../models/costume.model';
import {
  borrowerLabel,
  holdingsOf,
  isLoanOpen,
  isLoanOverdue,
  kitLabel,
  parseBorrowerKey,
  sameBorrower,
} from '../../utils/costume-logic';
import { LOAN_PAGE_STYLES } from '../loans/loan-page.styles';
import { lineLabel, loanPieces, openLinesCsvRows, todayInputValue } from '../loans/loan-utils';

@Component({
  selector: 'app-costume-person',
  standalone: true,
  imports: [CostumesNavComponent, RouterLink],
  template: `
    <div class="page">
      <app-costumes-nav />
      <a routerLink="/app/costumes/people" class="back-link no-print">← Vypůjčitelé</a>

      @if (borrower(); as borrower) {
        <div class="page__header">
          <h1 class="page__title">{{ label() }}</h1>
          <div class="row no-print">
            @if (canManage()) {
              <a class="btn-primary btn-primary--sm" routerLink="/app/costumes/loans/new" [queryParams]="{ borrower: key() }">Půjčit této osobě</a>
            }
            <button type="button" class="btn-secondary" (click)="print()">Tisk</button>
            <button type="button" class="btn-secondary" (click)="exportCsv()">Export CSV</button>
          </div>
        </div>

        @if (external(); as person) {
          <dl class="detail__meta contact">
            <dt>Kontakt</dt><dd>{{ person.contact || '—' }}</dd>
            @if (person.note) { <dt>Poznámka</dt><dd>{{ person.note }}</dd> }
          </dl>
        }

        <section class="section">
          <h2 class="detail__section-title">Má u sebe ({{ heldPieces() }} ks) – stav k {{ today() }}</h2>
          @if (holdings().length === 0) {
            <p class="state-note">Podle evidence nemá nic zapůjčeno.</p>
          } @else {
            <div class="table-wrap">
              <table class="table">
                <thead><tr><th>Součást</th><th>Počet</th><th>Zápůjčka</th><th>Vydáno</th><th>Vrátit do</th></tr></thead>
                <tbody>
                  @for (h of holdings(); track h.loan.id + '-' + h.line.id) {
                    <tr>
                      <td>
                        @if (h.line.itemId !== undefined) {
                          <a class="link" [routerLink]="['/app/costumes/items', h.line.itemId]">{{ lineText(h.line) }}</a>
                        } @else {
                          {{ partOnly(h.line) }}
                        }
                        @if (kitOf(h.loan, h.line)) { <span class="muted"> · {{ kitOf(h.loan, h.line) }}</span> }
                      </td>
                      <td>{{ h.remaining }} ks</td>
                      <td><a class="link" [routerLink]="['/app/costumes/loans', h.loan.id]">č. {{ h.loan.id }}</a></td>
                      <td>{{ date(h.loan.issuedAt) }}</td>
                      <td>
                        {{ h.loan.longTerm ? 'dlouhodobě' : (h.loan.dueAt ? date(h.loan.dueAt) : '—') }}
                        @if (overdue(h.loan)) { <span class="badge badge--overdue">Po termínu</span> }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>

        <section class="section no-print">
          <h2 class="detail__section-title">Historie uzavřených zápůjček</h2>
          @if (closedLoans().length === 0) {
            <p class="state-note">Žádné uzavřené zápůjčky.</p>
          } @else {
            <ul class="item-list">
              @for (loan of closedLoans(); track loan.id) {
                <li class="item-list__item item-list__item--link" [routerLink]="['/app/costumes/loans', loan.id]">
                  <div class="item-list__row">
                    <span class="item-list__title">Zápůjčka č. {{ loan.id }}@if (loan.kitId !== undefined) { – komplet {{ kit(loan.kitId) }} }</span>
                  </div>
                  <div class="item-list__meta">Vydáno {{ date(loan.issuedAt) }} · {{ pieces(loan) }} ks</div>
                  @if (loan.note) { <div class="item-list__body">{{ loan.note }}</div> }
                </li>
              }
            </ul>
          }
        </section>
      } @else {
        <p class="state-note">Vypůjčitel nebyl nalezen.</p>
      }
    </div>
  `,
  styles: [
    LOAN_PAGE_STYLES,
    `
      .page__header { flex-wrap: wrap; }
      .page__header .page__title { margin-bottom: 0; }
      .contact { margin-bottom: var(--spacing-lg); }
      .section { margin-bottom: var(--spacing-xl); }
    `,
  ],
})
export class CostumePersonComponent {
  private readonly accessService = inject(AccessService);
  private costumes = inject(CostumesService);
  private auth = inject(AuthService);

  readonly state = toSignal(this.costumes.state$, { requireSync: true });
  readonly members = toSignal(inject(MembersService).getMembers(), { initialValue: [] });
  readonly canManage = this.accessService.canManageCostumes;
  readonly key = toSignal(inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('key') ?? '')), { initialValue: '' });

  readonly borrower = computed(() => parseBorrowerKey(this.key()));
  readonly label = computed(() => {
    const borrower = this.borrower();
    return borrower ? borrowerLabel(borrower, this.members(), this.state().externals) : '';
  });
  readonly external = computed(() => {
    const borrower = this.borrower();
    return borrower?.kind === 'external' ? this.state().externals.find((e) => e.id === borrower.externalId) : undefined;
  });
  readonly holdings = computed(() => {
    const borrower = this.borrower();
    return borrower ? holdingsOf(this.state(), borrower) : [];
  });
  readonly heldPieces = computed(() => this.holdings().reduce((sum, h) => sum + h.remaining, 0));
  readonly closedLoans = computed(() => {
    const borrower = this.borrower();
    if (!borrower) return [];
    return this.state()
      .loans.filter((loan) => sameBorrower(loan.borrower, borrower) && !isLoanOpen(loan))
      .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  });
  readonly today = () => formatDate(new Date().toISOString());

  lineText(line: LoanLine): string {
    return lineLabel(this.state(), line);
  }

  partOnly(line: LoanLine): string {
    return this.state().partTypes.find((t) => t.id === line.partTypeId)?.name ?? '';
  }

  kitOf(loan: Loan, line: LoanLine): string {
    return kitLabel(this.state(), loan.kitId ?? line.fromKitId);
  }

  kit(kitId: number): string {
    return kitLabel(this.state(), kitId);
  }

  date(iso: string | undefined): string {
    return formatDate(iso);
  }

  overdue(loan: Loan): boolean {
    return isLoanOverdue(loan);
  }

  pieces(loan: Loan): number {
    return loanPieces(loan).total;
  }

  print(): void {
    printPage();
  }

  // Přehled krojů zapůjčených konkrétnímu člověku
  exportCsv(): void {
    const rows = openLinesCsvRows(this.state(), this.members(), this.holdings());
    downloadCsv(`kroje-${this.key()}-${todayInputValue()}`, rows);
  }
}

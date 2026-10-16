import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs/operators';
import { AuthService } from '../../../../core/auth/auth.service';
import { formatDate, printPage } from '../../../../shared/export/export.utils';
import { MembersService } from '../../../members/members.service';
import { AccessService } from '../../../../core/access/access.service';
import { CostumesNavComponent } from '../../costumes-nav/costumes-nav.component';
import { CostumesService } from '../../costumes.service';
import { LoanLine } from '../../models/costume.model';
import { borrowerKey, borrowerLabel, isLoanOpen, isLoanOverdue, kitLabel, lineRemaining } from '../../utils/costume-logic';
import { LOAN_PAGE_STYLES } from '../loans/loan-page.styles';
import {
  ReturnFormRow,
  dateInputToIso,
  initialReturnRows,
  lineLabel,
  loanPieces,
  remainingAfterReturn,
  toReturnInputs,
  todayInputValue,
} from '../loans/loan-utils';

@Component({
  selector: 'app-costume-loan-detail',
  standalone: true,
  imports: [CostumesNavComponent, RouterLink],
  template: `
    <div class="page">
      <app-costumes-nav />
      <a routerLink="/app/costumes/loans" class="back-link no-print">← Zápůjčky</a>

      @if (loan(); as loan) {
        <div class="detail">
          <div class="detail__header">
            <h1 class="detail__title">Zápůjčka č. {{ loan.id }}</h1>
            @if (overdue()) { <span class="badge badge--overdue">Po termínu</span> }
            @if (open()) {
              <span class="badge badge--ok">Otevřená – u vypůjčitele {{ pieces().held }} z {{ pieces().total }} ks</span>
            } @else {
              <span class="badge badge--muted">Uzavřená</span>
            }
          </div>

          <dl class="detail__meta">
            <dt>Vypůjčitel</dt>
            <dd><a class="link" [routerLink]="['/app/costumes/people', personKey()]">{{ borrower() }}</a></dd>
            @if (loan.kitId !== undefined) {
              <dt>Komplet</dt>
              <dd><a class="link" [routerLink]="['/app/costumes/kits', loan.kitId]">{{ kit(loan.kitId) }}</a></dd>
            }
            <dt>Vydáno</dt>
            <dd>{{ date(loan.issuedAt) }}</dd>
            <dt>Vrátit do</dt>
            <dd>{{ loan.longTerm ? 'dlouhodobé přidělení' : (loan.dueAt ? date(loan.dueAt) : 'bez termínu') }}</dd>
            <dt>Vydal(a)</dt>
            <dd>{{ issuer() }}</dd>
            @if (loan.note) {
              <dt>Poznámka</dt>
              <dd>{{ loan.note }}</dd>
            }
          </dl>

          <div class="detail__section">
            <h2 class="detail__section-title">Předané součásti</h2>
            <div class="table-wrap">
              <table class="table">
                <thead>
                  <tr><th>Součást</th><th>Předáno</th><th>U vypůjčitele</th><th>Vrácení / vypořádání</th>@if (canManage() && open()) { <th class="no-print"></th> }</tr>
                </thead>
                <tbody>
                  @for (line of loan.lines; track line.id) {
                    <tr>
                      <td>
                        @if (line.itemId !== undefined) {
                          <a class="link" [routerLink]="['/app/costumes/items', line.itemId]">{{ label(line) }}</a>
                        } @else {
                          {{ label(line) }}
                        }
                      </td>
                      <td>{{ line.count }} ks</td>
                      <td>{{ remaining(line) }} ks</td>
                      <td>
                        @for (r of line.returns; track $index) {
                          <div>
                            {{ date(r.at) }} – vráceno {{ r.count }} ks
                            @if (!r.ready) { <span class="badge badge--muted">nepřipraveno</span> }
                            @if (r.note) { <span class="muted">· {{ r.note }}</span> }
                          </div>
                        }
                        @if (line.settled) {
                          <div>{{ date(line.settled.at) }} – vypořádáno: {{ line.settled.note }}</div>
                        }
                        @if (!line.returns.length && !line.settled) { <span class="muted">—</span> }
                      </td>
                      @if (canManage() && open()) {
                        <td class="no-print">
                          @if (remaining(line) > 0) {
                            <button type="button" class="btn-secondary" (click)="startSettle(line.id)">Vypořádat jinak…</button>
                          }
                        </td>
                      }
                    </tr>
                    @if (settleLineId() === line.id) {
                      <tr class="no-print">
                        <td colspan="5">
                          <div class="row">
                            <input class="input input--search" placeholder="Jak bylo vypořádáno (ztráta, náhrada…) *" [value]="settleNote()" (input)="settleNote.set($any($event.target).value)" />
                            <button type="button" class="btn-primary btn-primary--sm" [disabled]="busy()" (click)="settle(line.id)">Vypořádat</button>
                            <button type="button" class="btn-secondary" (click)="settleLineId.set(null)">Zrušit</button>
                          </div>
                        </td>
                      </tr>
                    }
                  }
                </tbody>
              </table>
            </div>
          </div>

          @if (error()) { <div class="error-box">{{ error() }}</div> }

          @if (canManage() && rows().length) {
            <div class="detail__section no-print">
              <h2 class="detail__section-title">Vrácení</h2>
              <p class="muted">Zaškrtnuté řádky se zapíšou jako vrácené. Co zaškrtnuté není, zůstává v zápůjčce.</p>
              <div class="stack">
                @for (row of rows(); track row.lineId) {
                  <div class="return-row">
                    <div class="row">
                      @if (isBulk(row.lineId)) {
                        <label class="check">
                          <input type="checkbox" [checked]="row.returned" (change)="patchRow(row.lineId, { returned: !row.returned })" /> vráceno
                        </label>
                        <input class="input input--count" type="number" min="0" [max]="row.remaining" [value]="row.count" [disabled]="!row.returned" (input)="patchRow(row.lineId, { count: +$any($event.target).value })" aria-label="Počet vrácených kusů" />
                        <span>z {{ row.remaining }} ks – <strong>{{ lineLabelById(row.lineId) }}</strong></span>
                      } @else {
                        <label class="check">
                          <input type="checkbox" [checked]="row.returned" (change)="patchRow(row.lineId, { returned: !row.returned })" /> vráceno
                        </label>
                        <strong>{{ lineLabelById(row.lineId) }}</strong>
                      }
                    </div>
                    @if (row.returned && row.count > 0) {
                      <div class="row">
                        <input class="input input--search" placeholder="Poznámka k vrácení (např. vrácena nevypraná)" [value]="row.note" (input)="patchRow(row.lineId, { note: $any($event.target).value })" />
                        <label class="check">
                          <input type="checkbox" [checked]="row.ready" (change)="patchRow(row.lineId, { ready: !row.ready })" /> připraveno k dalšímu zapůjčení
                        </label>
                      </div>
                    }
                  </div>
                }
              </div>
              <div class="row return-footer">
                <div class="form-field">
                  <label for="returnDate">Datum vrácení</label>
                  <input id="returnDate" type="date" [value]="returnDate()" (input)="returnDate.set($any($event.target).value)" />
                </div>
              </div>
              <p class="info-box">
                @if (stillOpenAfter() > 0) {
                  Zápůjčka zůstává otevřená: {{ stillOpenAfter() }} ks zůstane u vypůjčitele.
                } @else {
                  Po potvrzení bude zápůjčka uzavřena.
                }
              </p>
              <button type="button" class="btn-primary" [disabled]="busy() || returnCount() === 0 || !returnDate()" (click)="submitReturn()">
                {{ busy() ? 'Ukládám…' : 'Potvrdit vrácení (' + returnCount() + ' ks)' }}
              </button>
            </div>
          }

          @if (done()) { <p class="info-box">{{ done() }}</p> }

          <div class="row no-print">
            <button type="button" class="btn-secondary" (click)="print()">Tisk</button>
          </div>

          <div class="print-only signatures">
            <p>Převzal(a): ............................................ Předal(a): ............................................</p>
          </div>
        </div>
      } @else {
        <p class="state-note">Zápůjčka nebyla nalezena.</p>
      }
    </div>
  `,
  styles: [
    LOAN_PAGE_STYLES,
    `
      .return-row { padding: var(--spacing-sm); border: 1px solid var(--color-border); border-radius: 6px; display: flex; flex-direction: column; gap: var(--spacing-xs); }
      .return-footer { margin: var(--spacing-md) 0 var(--spacing-sm); }
      .signatures { margin-top: var(--spacing-xl); }
      .btn-primary { margin-top: var(--spacing-sm); }
    `,
  ],
})
export class CostumeLoanDetailComponent {
  private readonly accessService = inject(AccessService);
  private costumes = inject(CostumesService);
  private auth = inject(AuthService);

  readonly state = toSignal(this.costumes.state$, { requireSync: true });
  readonly members = toSignal(inject(MembersService).getMembers(), { initialValue: [] });
  readonly canManage = this.accessService.canManageCostumes;
  private readonly loanId = toSignal(inject(ActivatedRoute).paramMap.pipe(map((p) => Number(p.get('id')))), { initialValue: 0 });

  readonly loan = computed(() => this.state().loans.find((l) => l.id === this.loanId()));
  readonly open = computed(() => !!this.loan() && isLoanOpen(this.loan()!));
  readonly overdue = computed(() => !!this.loan() && isLoanOverdue(this.loan()!));
  readonly pieces = computed(() => (this.loan() ? loanPieces(this.loan()!) : { held: 0, total: 0 }));
  readonly borrower = computed(() => {
    const loan = this.loan();
    return loan ? borrowerLabel(loan.borrower, this.members(), this.state().externals) : '';
  });
  readonly personKey = computed(() => (this.loan() ? borrowerKey(this.loan()!.borrower) : ''));
  readonly issuer = computed(() => {
    const userId = this.loan()?.issuedByUserId;
    const member = this.members().find((m) => m.userId === userId);
    return member ? `${member.firstName} ${member.lastName}`.trim() || member.nickname : '—';
  });

  // Formulář vrácení se obnoví při každé změně zápůjčky (např. po potvrzení vrácení)
  readonly rows = linkedSignal<ReturnFormRow[]>(() => (this.loan() ? initialReturnRows(this.loan()!) : []));
  readonly returnDate = signal(todayInputValue());
  readonly returnCount = computed(() => toReturnInputs(this.rows()).reduce((sum, r) => sum + r.count, 0));
  readonly stillOpenAfter = computed(() => remainingAfterReturn(this.rows()));

  readonly settleLineId = signal<number | null>(null);
  readonly settleNote = signal('');
  readonly busy = signal(false);
  readonly error = signal('');
  readonly done = signal('');

  label(line: LoanLine): string {
    return lineLabel(this.state(), line);
  }

  lineLabelById(lineId: number): string {
    const line = this.loan()?.lines.find((l) => l.id === lineId);
    return line ? lineLabel(this.state(), line) : '';
  }

  isBulk(lineId: number): boolean {
    return this.loan()?.lines.find((l) => l.id === lineId)?.itemId === undefined;
  }

  remaining(line: LoanLine): number {
    return lineRemaining(line);
  }

  kit(kitId: number): string {
    return kitLabel(this.state(), kitId);
  }

  date(iso: string | undefined): string {
    return formatDate(iso);
  }

  patchRow(lineId: number, patch: Partial<ReturnFormRow>): void {
    this.rows.update((rows) => rows.map((row) => (row.lineId === lineId ? { ...row, ...patch } : row)));
  }

  submitReturn(): void {
    const loan = this.loan();
    if (!loan) return;
    const inputs = toReturnInputs(this.rows());
    // Spočítat předem – po zápisu se formulář obnoví podle nového stavu
    const left = remainingAfterReturn(this.rows());
    this.run(this.costumes.returnLoan(loan.id, inputs, dateInputToIso(this.returnDate())), () => {
      this.done.set(left > 0 ? `Vrácení zapsáno. Zápůjčka zůstává otevřená: ${left} ks.` : 'Vrácení zapsáno. Zápůjčka je uzavřená.');
    });
  }

  startSettle(lineId: number): void {
    this.settleLineId.set(lineId);
    this.settleNote.set('');
  }

  settle(lineId: number): void {
    const loan = this.loan();
    if (!loan) return;
    this.run(this.costumes.settleLine(loan.id, lineId, this.settleNote()), () => {
      this.settleLineId.set(null);
      this.done.set('Řádek byl vypořádán.');
    });
  }

  print(): void {
    printPage();
  }

  private run(action: ReturnType<CostumesService['settleLine']>, onSuccess: () => void): void {
    this.error.set('');
    this.done.set('');
    this.busy.set(true);
    action.subscribe({
      next: () => {
        this.busy.set(false);
        onSuccess();
      },
      error: (err: Error) => {
        this.busy.set(false);
        this.error.set(err.message);
      },
    });
  }
}

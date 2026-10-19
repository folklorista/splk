import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CostumesService } from '../../costumes.service';
import { MembersService } from '../../../members/members.service';
import { AccessService } from '../../../../core/access/access.service';
import { borrowerKey, borrowerLabel, isLoanOpen, isLoanOverdue, itemLabel, matchesSearch } from '../../utils/costume-logic';
import { downloadCsv, formatDate } from '../../../../shared/export/export.utils';
import { WardrobeNavComponent } from '../shared/wardrobe-nav.component';
import { WARDROBE_STYLES } from '../shared/wardrobe.styles';

type LoanFilter = 'open' | 'overdue' | 'all';

// Výpůjčky – jeden řádek = jeden konkrétní kus u jednoho držitele; ukončené zůstávají v historii
import { IconComponent } from '../../../../shared/icon/icon.component';
@Component({
  selector: 'app-wardrobe-loans',
  standalone: true,
  imports: [WardrobeNavComponent, RouterLink, DatePipe, IconComponent],
  template: `
    <div class="page">
      <app-wardrobe-nav />
      <div class="page__header">
        <h1 class="page__title">Výpůjčky</h1>
        @if (canManage()) { <a class="btn-primary btn-primary--sm no-print" routerLink="/app/wardrobe/loans/new">+ Vydat kusy</a> }
      </div>
      <div class="toolbar no-print">
        <div class="segmented">
          @for (f of filters; track f.id) {
            <button type="button" class="segmented__btn" [class.segmented__btn--active]="filter() === f.id" (click)="filter.set(f.id)">{{ f.label }}</button>
          }
        </div>
        <input class="input input--search" type="search" placeholder="Hledat držitele nebo kus…" [value]="search()" (input)="search.set($any($event.target).value)" />
        <button type="button" class="btn-secondary" (click)="exportCsv()"><app-icon class="dl-icon" name="download" [size]="16" />Export CSV</button>
      </div>
      <ul class="item-list">
        @for (row of rows(); track row.loan.id) {
          <li class="item-list__item">
            <div class="item-list__row">
              <a class="item-list__title link" [routerLink]="['/app/wardrobe/stock', row.loan.itemId]">{{ row.item }}</a>
              <span class="item-list__badges">
                @if (row.overdue) { <span class="badge badge--alert">Po termínu</span> }
                @if (!row.open) { <span class="badge badge--muted">{{ row.loan.endReason === 'exchanged' ? 'Vyměněno' : row.loan.endReason === 'settled' ? 'Vypořádáno' : 'Vráceno' }}</span> }
              </span>
            </div>
            <div class="item-list__meta">
              <a class="link" [routerLink]="['/app/wardrobe/cards', row.key]">{{ row.borrower }}</a>
              · vydáno {{ row.loan.issuedAt | date: 'd. M. yyyy' }}
              @if (row.loan.dueAt) { · vrátit do {{ row.loan.dueAt | date: 'd. M. yyyy' }} }
              @if (row.loan.endedAt) { · ukončeno {{ row.loan.endedAt | date: 'd. M. yyyy' }} }
              @if (row.loan.note) { · {{ row.loan.note }} }
            </div>
          </li>
        } @empty { <li class="state-note">Žádné výpůjčky.</li> }
      </ul>
    </div>
  `,
  styles: [WARDROBE_STYLES],
})
export class WardrobeLoansComponent {
  private members = inject(MembersService).members;
  readonly canManage = inject(AccessService).canManageCostumes;
  readonly state = toSignal(inject(CostumesService).state$);
  readonly filters: { id: LoanFilter; label: string }[] = [
    { id: 'open', label: 'Zapůjčeno' },
    { id: 'overdue', label: 'Po termínu' },
    { id: 'all', label: 'Vše včetně historie' },
  ];
  readonly filter = signal<LoanFilter>((inject(ActivatedRoute).snapshot.queryParamMap.get('filter') as LoanFilter) || 'open');
  readonly search = signal('');

  readonly rows = computed(() => {
    const state = this.state();
    if (!state) return [];
    return state.loans
      .filter((l) => (this.filter() === 'open' ? isLoanOpen(l) : this.filter() === 'overdue' ? isLoanOverdue(l) : true))
      .map((loan) => ({
        loan,
        key: borrowerKey(loan.borrower),
        open: isLoanOpen(loan),
        overdue: isLoanOverdue(loan),
        borrower: borrowerLabel(loan.borrower, this.members(), state.externals),
        item: itemLabel(state, state.items.find((i) => i.id === loan.itemId)!),
      }))
      .filter((r) => matchesSearch(`${r.borrower} ${r.item}`, this.search()))
      .sort((a, b) => a.borrower.localeCompare(b.borrower, 'cs') || a.item.localeCompare(b.item, 'cs') || b.loan.issuedAt.localeCompare(a.loan.issuedAt));
  });

  exportCsv(): void {
    downloadCsv('krojarna-vypujcky', [
      ['Držitel', 'Kus', 'Vydáno', 'Vrátit do', 'Ukončeno', 'Poznámka'],
      ...this.rows().map((r) => [r.borrower, r.item, formatDate(r.loan.issuedAt), formatDate(r.loan.dueAt), formatDate(r.loan.endedAt), r.loan.note ?? '']),
    ]);
  }
}

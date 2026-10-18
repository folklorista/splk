import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { CostumesService } from '../../costumes.service';
import { MembersService } from '../../../members/members.service';
import { AccessService } from '../../../../core/access/access.service';
import { Borrower } from '../../models/costume.model';
import { borrowerKey, borrowerLabel, borrowersWithHoldings, cardGroups, holdingsOf, isLoanOverdue, matchesSearch } from '../../utils/costume-logic';
import { WardrobeNavComponent } from '../shared/wardrobe-nav.component';
import { errorMessage } from '../shared/wardrobe-ui';
import { WARDROBE_STYLES } from '../shared/wardrobe.styles';

// Krojové karty – kdo má co zapůjčeno (jednotlivé kusy), plus evidence externistů
@Component({
  selector: 'app-wardrobe-cards',
  standalone: true,
  imports: [WardrobeNavComponent, RouterLink],
  template: `
    <div class="page">
      <app-wardrobe-nav />
      <h1 class="page__title">Krojové karty</h1>
      <div class="toolbar no-print">
        <input class="input input--search" type="search" placeholder="Hledat člena nebo externistu…" [value]="search()" (input)="search.set($any($event.target).value)" />
        <label class="check"><input type="checkbox" [checked]="all()" (change)="all.set($any($event.target).checked)" /> I lidé bez zapůjčených kusů</label>
      </div>
      <ul class="item-list">
        @for (row of rows(); track row.key) {
          <li class="item-list__item item-list__item--link" [routerLink]="['/app/wardrobe/cards', row.key]">
            <div class="item-list__row">
              <span class="item-list__title">{{ row.label }}</span>
              <span class="item-list__badges">
                @if (row.overdue) { <span class="badge badge--alert">Po termínu</span> }
                @for (m of row.missing; track m) { <span class="badge badge--warn">chybí: {{ m }}</span> }
              </span>
            </div>
            <div class="item-list__meta">{{ row.pieces }} ks · {{ row.groups.join(' · ') || 'nic zapůjčeno' }}</div>
          </li>
        } @empty { <li class="state-note">Nikdo neodpovídá.</li> }
      </ul>

      <section class="section">
        <div class="page__header">
          <h2 class="detail__section-title">Externisté</h2>
          @if (canManage()) { <button type="button" class="btn-secondary no-print" (click)="adding.set(!adding())">+ Přidat externistu</button> }
        </div>
        <p class="info-box">Externista je člověk mimo soubor, kterému krojárna zapůjčila kroj. Nedostává účet ani členství ve skupinách.</p>
        @if (error()) { <div class="error-box">{{ error() }}</div> }
        @if (adding()) {
          <div class="panel stack">
            <input class="input" placeholder="Jméno a příjmení *" [value]="extName()" (input)="extName.set($any($event.target).value)" />
            <input class="input" placeholder="Kontakt" [value]="extContact()" (input)="extContact.set($any($event.target).value)" />
            <div class="row"><button type="button" class="btn-primary btn-primary--sm" (click)="addExternal()">Uložit</button><button type="button" class="btn-secondary" (click)="adding.set(false)">Zrušit</button></div>
          </div>
        }
        <ul class="item-list">
          @for (e of state()?.externals ?? []; track e.id) {
            <li class="item-list__item item-list__item--link" [routerLink]="['/app/wardrobe/cards', 'external-' + e.id]">
              <span class="item-list__title">{{ e.name }}</span>
              <div class="item-list__meta">{{ e.contact }} {{ e.note }}</div>
            </li>
          }
        </ul>
      </section>
    </div>
  `,
  styles: [WARDROBE_STYLES],
})
export class WardrobeCardsComponent {
  private costumes = inject(CostumesService);
  private members = inject(MembersService).members;
  readonly canManage = inject(AccessService).canManageCostumes;
  readonly state = toSignal(this.costumes.state$);
  readonly search = signal('');
  readonly all = signal(false);
  readonly adding = signal(false);
  readonly extName = signal('');
  readonly extContact = signal('');
  readonly error = signal('');

  readonly rows = computed(() => {
    const state = this.state();
    if (!state) return [];
    const holders = borrowersWithHoldings(state);
    const borrowers: Borrower[] = this.all()
      ? [...this.members().filter((m) => m.isActive).map((m): Borrower => ({ kind: 'member', memberId: m.id })), ...holders.filter((b) => b.kind === 'external' || !this.members().find((m) => m.id === b.memberId)?.isActive)]
      : holders;
    return borrowers
      .map((borrower) => {
        const holdings = holdingsOf(state, borrower);
        const groups = cardGroups(state, holdings);
        return {
          key: borrowerKey(borrower),
          label: borrowerLabel(borrower, this.members(), state.externals),
          pieces: holdings.length,
          overdue: holdings.some((h) => isLoanOverdue(h.loan)),
          groups: groups.map((g) => g.title),
          missing: groups.flatMap((g) => g.missing.flatMap((m) => m.partTypes)),
        };
      })
      .filter((r) => matchesSearch(r.label, this.search()))
      .sort((a, b) => a.label.localeCompare(b.label, 'cs'));
  });

  addExternal(): void {
    this.costumes.createExternal({ name: this.extName(), contact: this.extContact() }).subscribe({
      next: () => { this.adding.set(false); this.extName.set(''); this.extContact.set(''); },
      error: (e) => this.error.set(errorMessage(e)),
    });
  }
}

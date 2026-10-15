import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { MembersService } from '../../../members/members.service';
import { canManageCostumes } from '../../costume-permissions';
import { CostumesNavComponent } from '../../costumes-nav/costumes-nav.component';
import { CostumesService } from '../../costumes.service';
import { ExternalPerson } from '../../models/costume.model';
import { borrowerKey, borrowerLabel, borrowersWithHoldings, holdingsOf, isLoanOverdue } from '../../utils/costume-logic';
import { LOAN_PAGE_STYLES } from '../loans/loan-page.styles';
import { BorrowerFilter, filterBorrowers, matchesSearch } from '../loans/loan-utils';

interface ExternalDraft {
  name: string;
  contact: string;
  note: string;
}

const EMPTY_DRAFT: ExternalDraft = { name: '', contact: '', note: '' };

@Component({
  selector: 'app-costume-people',
  standalone: true,
  imports: [CostumesNavComponent, RouterLink, NgTemplateOutlet],
  template: `
    <div class="page">
      <app-costumes-nav />
      <h1 class="page__title">Vypůjčitelé</h1>

      <section class="section">
        <h2 class="detail__section-title">Kdo má něco zapůjčeno</h2>
        <div class="toolbar no-print">
          <div class="segmented">
            @for (f of filters; track f.value) {
              <button type="button" class="segmented__btn" [class.segmented__btn--active]="filter() === f.value" (click)="filter.set(f.value)">{{ f.label }}</button>
            }
          </div>
          <input class="input input--search" type="search" placeholder="Hledat…" [value]="search()" (input)="search.set($any($event.target).value)" />
        </div>
        @if (holders().length === 0) {
          <p class="state-note">Nikdo z vybraných nemá nic zapůjčeno.</p>
        } @else {
          <ul class="item-list">
            @for (h of holders(); track h.key) {
              <li class="item-list__item item-list__item--link" [routerLink]="['/app/costumes/people', h.key]">
                <div class="item-list__row">
                  <span class="item-list__title">{{ h.label }}</span>
                  <span class="item-list__badges">
                    @if (h.overdue) { <span class="badge badge--overdue">Po termínu</span> }
                  </span>
                </div>
                <div class="item-list__meta">{{ h.pieces }} ks · {{ h.loans }} {{ h.loans === 1 ? 'zápůjčka' : (h.loans < 5 ? 'zápůjčky' : 'zápůjček') }}</div>
              </li>
            }
          </ul>
        }
      </section>

      <section class="section">
        <div class="page__header">
          <h2 class="detail__section-title">Externisté</h2>
          @if (canManage()) {
            <button type="button" class="btn-secondary no-print" (click)="startEdit(0)">+ Přidat externistu</button>
          }
        </div>
        <p class="info-box">
          Externista je člověk mimo soubor, kterému krojárka zapůjčila kroj. Eviduje se jen jako vypůjčitel –
          nedostává účet v aplikaci ani členství ve skupinách.
        </p>

        @if (error()) { <div class="error-box">{{ error() }}</div> }

        @if (editingId() === 0) {
          <ng-container *ngTemplateOutlet="form" />
        }

        <ul class="item-list externals">
          @for (person of externals(); track person.id) {
            <li class="item-list__item">
              @if (editingId() === person.id) {
                <ng-container *ngTemplateOutlet="form" />
              } @else {
                <div class="item-list__row">
                  <a class="item-list__title link" [routerLink]="['/app/costumes/people', 'external-' + person.id]">{{ person.name }}</a>
                  @if (canManage()) {
                    <button type="button" class="btn-secondary no-print" (click)="startEdit(person.id, person)">Upravit</button>
                  }
                </div>
                @if (person.contact) { <div class="item-list__meta">{{ person.contact }}</div> }
                @if (person.note) { <div class="item-list__body">{{ person.note }}</div> }
              }
            </li>
          } @empty {
            <li class="state-note">Zatím žádní externisté.</li>
          }
        </ul>

        <ng-template #form>
          <div class="stack edit-form">
            <input class="input" placeholder="Jméno a příjmení *" [value]="draft().name" (input)="patchDraft({ name: $any($event.target).value })" />
            <input class="input" placeholder="Kontakt (telefon, e-mail)" [value]="draft().contact" (input)="patchDraft({ contact: $any($event.target).value })" />
            <input class="input" placeholder="Poznámka" [value]="draft().note" (input)="patchDraft({ note: $any($event.target).value })" />
            <div class="row">
              <button type="button" class="btn-primary btn-primary--sm" [disabled]="busy()" (click)="save()">Uložit</button>
              <button type="button" class="btn-secondary" (click)="editingId.set(null)">Zrušit</button>
            </div>
          </div>
        </ng-template>
      </section>
    </div>
  `,
  styles: [
    LOAN_PAGE_STYLES,
    `
      .section { margin-bottom: var(--spacing-xl); }
      .page__header .detail__section-title { margin: 0; }
      .info-box { margin-bottom: var(--spacing-md); }
      .edit-form { padding: var(--spacing-md); border: 1px dashed var(--color-border); border-radius: 8px; margin-bottom: var(--spacing-sm); }
      .externals .edit-form { border: none; padding: 0; margin: 0; }
    `,
  ],
})
export class CostumePeopleComponent {
  private costumes = inject(CostumesService);
  private auth = inject(AuthService);

  readonly state = toSignal(this.costumes.state$, { requireSync: true });
  readonly members = toSignal(inject(MembersService).getMembers(), { initialValue: [] });
  readonly canManage = computed(() => canManageCostumes(this.auth.currentUser()));

  readonly filters: { value: BorrowerFilter; label: string }[] = [
    { value: 'all', label: 'Všichni vypůjčitelé' },
    { value: 'member', label: 'Členové' },
    { value: 'former', label: 'Bývalí členové' },
    { value: 'external', label: 'Externisté' },
  ];
  readonly filter = signal<BorrowerFilter>('all');
  readonly search = signal('');

  readonly holders = computed(() => {
    const state = this.state();
    const members = this.members();
    return filterBorrowers(borrowersWithHoldings(state), this.filter(), members)
      .map((borrower) => {
        const holdings = holdingsOf(state, borrower);
        const loans = new Map(holdings.map((h) => [h.loan.id, h.loan]));
        return {
          key: borrowerKey(borrower),
          label: borrowerLabel(borrower, members, state.externals),
          pieces: holdings.reduce((sum, h) => sum + h.remaining, 0),
          loans: loans.size,
          overdue: [...loans.values()].some((loan) => isLoanOverdue(loan)),
        };
      })
      .filter((h) => matchesSearch(h.label, this.search()))
      .sort((a, b) => a.label.localeCompare(b.label, 'cs'));
  });

  readonly externals = computed(() => [...this.state().externals].sort((a, b) => a.name.localeCompare(b.name, 'cs')));

  // null = nic se neupravuje, 0 = nový externista
  readonly editingId = signal<number | null>(null);
  readonly draft = signal<ExternalDraft>(EMPTY_DRAFT);
  readonly busy = signal(false);
  readonly error = signal('');

  startEdit(id: number, person?: ExternalPerson): void {
    this.error.set('');
    this.editingId.set(id);
    this.draft.set(person ? { name: person.name, contact: person.contact ?? '', note: person.note ?? '' } : EMPTY_DRAFT);
  }

  patchDraft(patch: Partial<ExternalDraft>): void {
    this.draft.update((d) => ({ ...d, ...patch }));
  }

  save(): void {
    const id = this.editingId();
    if (id === null) return;
    const request: Observable<ExternalPerson> = id === 0 ? this.costumes.createExternal(this.draft()) : this.costumes.updateExternal(id, this.draft());
    this.error.set('');
    this.busy.set(true);
    request.subscribe({
      next: () => {
        this.busy.set(false);
        this.editingId.set(null);
      },
      error: (err: Error) => {
        this.busy.set(false);
        this.error.set(err.message);
      },
    });
  }
}

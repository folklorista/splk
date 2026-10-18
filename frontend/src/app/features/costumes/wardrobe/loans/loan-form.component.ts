import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CostumesService } from '../../costumes.service';
import { MembersService } from '../../../members/members.service';
import { Borrower } from '../../models/costume.model';
import { borrowerKey, borrowerLabel, dateInputToIso, defaultCostumeOf, itemAvailability, matchesSearch, parseBorrowerKey, sortItems } from '../../utils/costume-logic';
import { WardrobeNavComponent } from '../shared/wardrobe-nav.component';
import { ItemPickerComponent } from '../shared/item-picker.component';
import { errorMessage } from '../shared/wardrobe-ui';
import { WARDROBE_STYLES } from '../shared/wardrobe.styles';

// Vydání konkrétních dostupných kusů jednomu držiteli. Každý kus = samostatná výpůjčka; komplet není podmínkou.
@Component({
  selector: 'app-wardrobe-loan-form',
  standalone: true,
  imports: [WardrobeNavComponent, RouterLink, ItemPickerComponent],
  template: `
    <div class="page">
      <app-wardrobe-nav />
      <a routerLink="/app/wardrobe/loans" class="back-link">← Výpůjčky</a>
      <h1 class="page__title">Vydat kusy</h1>
      @if (error()) { <div class="error-box" role="alert">{{ error() }}</div> }
      @if (state(); as st) {
        <section class="detail stack section">
          <h2 class="detail__section-title">Komu</h2>
          <input class="input" type="search" placeholder="Hledat člena nebo externistu…" [value]="borrowerSearch()" (input)="borrowerSearch.set($any($event.target).value)" />
          <select class="input" size="6" (change)="borrowerKey.set($any($event.target).value)" aria-label="Držitel">
            @for (o of borrowerOptions(); track o.key) { <option [value]="o.key" [selected]="o.key === borrowerKey()">{{ o.label }}</option> }
          </select>
          <p class="muted">Vybráno: <strong>{{ selectedLabel() || '—' }}</strong></p>
        </section>
        <section class="detail stack section">
          <h2 class="detail__section-title">Které kusy ({{ itemIds().length }})</h2>
          <app-item-picker [state]="st" [items]="available()" [preferredGenderId]="preferredGender()" [multiple]="true" [selected]="itemIds()" (selectedChange)="itemIds.set($event)" />
        </section>
        <section class="detail stack section">
          <div class="fields">
            <label class="field">Vrátit do (prázdné = dlouhodobě)<input class="input" type="date" [value]="dueAt()" (input)="dueAt.set($any($event.target).value)" /></label>
          </div>
          <input class="input" placeholder="Poznámka (např. na vystoupení)" [value]="note()" (input)="note.set($any($event.target).value)" />
          <button type="button" class="btn-primary" [disabled]="busy() || !borrowerKey() || !itemIds().length" (click)="save()">Vydat {{ itemIds().length }} ks</button>
        </section>
      }
    </div>
  `,
  styles: [WARDROBE_STYLES],
})
export class WardrobeLoanFormComponent {
  private costumes = inject(CostumesService);
  private router = inject(Router);
  private members = inject(MembersService).members;
  readonly state = toSignal(this.costumes.state$);

  readonly borrowerSearch = signal('');
  readonly borrowerKey = signal('');
  readonly itemIds = signal<number[]>([]);
  readonly dueAt = signal('');
  readonly note = signal('');
  readonly busy = signal(false);
  readonly error = signal('');

  readonly borrowerOptions = computed(() => {
    const state = this.state();
    if (!state) return [];
    const borrowers: Borrower[] = [
      ...this.members().filter((m) => m.isActive).map((m): Borrower => ({ kind: 'member', memberId: m.id })),
      ...state.externals.map((e): Borrower => ({ kind: 'external', externalId: e.id })),
    ];
    return borrowers
      .map((b) => ({ key: borrowerKey(b), label: borrowerLabel(b, this.members(), state.externals) }))
      .filter((o) => o.key === this.borrowerKey() || matchesSearch(o.label, this.borrowerSearch()))
      .sort((a, b) => a.label.localeCompare(b.label, 'cs'));
  });
  readonly selectedLabel = computed(() => this.borrowerOptions().find((o) => o.key === this.borrowerKey())?.label);
  readonly preferredGender = computed(() => {
    const state = this.state();
    return state ? defaultCostumeOf(state, parseBorrowerKey(this.borrowerKey())) : undefined;
  });
  readonly available = computed(() => {
    const state = this.state();
    return state ? sortItems(state, state.items.filter((i) => itemAvailability(state, i) === 'available')) : [];
  });

  constructor() {
    const q = inject(ActivatedRoute).snapshot.queryParamMap;
    if (q.get('borrower')) this.borrowerKey.set(q.get('borrower')!);
    if (q.get('item')) this.itemIds.set([Number(q.get('item'))]);
  }

  save(): void {
    const borrower = parseBorrowerKey(this.borrowerKey());
    if (!borrower) return;
    this.busy.set(true);
    this.costumes.issueItems({ borrower, itemIds: this.itemIds(), dueAt: dateInputToIso(this.dueAt()), note: this.note() }).subscribe({
      next: () => this.router.navigate(['/app/wardrobe/cards', this.borrowerKey()]),
      error: (e) => { this.busy.set(false); this.error.set(errorMessage(e)); },
    });
  }
}

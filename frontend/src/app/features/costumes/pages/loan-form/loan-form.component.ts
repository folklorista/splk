import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MembersService } from '../../../members/members.service';
import { CostumesNavComponent } from '../../costumes-nav/costumes-nav.component';
import { CostumesService, IssueLoanInput } from '../../costumes.service';
import { CostumeItem } from '../../models/costume.model';
import {
  itemLabel,
  itemStatus,
  kitIssueCandidates,
  kitLabel,
  openKitLoan,
  parseBorrowerKey,
  partTypeName,
} from '../../utils/costume-logic';
import { LOAN_PAGE_STYLES } from '../loans/loan-page.styles';
import { BorrowerOption, borrowerOptions, dateInputToIso, matchesSearch, todayInputValue } from '../loans/loan-utils';

type LoanMode = 'kit' | 'items';

interface BulkPick {
  kitId: number;
  partTypeId: number;
  count: number;
}

@Component({
  selector: 'app-costume-loan-form',
  standalone: true,
  imports: [CostumesNavComponent, RouterLink],
  template: `
    <div class="page">
      <app-costumes-nav />
      <a routerLink="/app/costumes/loans" class="back-link">← Zápůjčky</a>
      <h1 class="page__title">Nová zápůjčka</h1>

      <div class="stack form">
        <!-- Vypůjčitel -->
        <section class="detail">
          <h2 class="detail__section-title">Komu</h2>
          <div class="row">
            <input class="input input--search" type="search" placeholder="Hledat člena nebo externistu…" [value]="borrowerSearch()" (input)="borrowerSearch.set($any($event.target).value)" />
            <button type="button" class="btn-secondary" (click)="showNewExternal.set(!showNewExternal())">+ Nový externista</button>
          </div>
          <select class="input" size="6" [value]="borrowerKey()" (change)="borrowerKey.set($any($event.target).value)" aria-label="Vypůjčitel">
            @for (group of borrowerGroups(); track group.label) {
              @if (group.options.length) {
                <optgroup [label]="group.label">
                  @for (option of group.options; track option.key) {
                    <option [value]="option.key" [selected]="option.key === borrowerKey()">{{ option.label }}</option>
                  }
                </optgroup>
              }
            }
          </select>
          <p class="muted">Vybráno: <strong>{{ selectedBorrower()?.label ?? '—' }}</strong></p>

          @if (showNewExternal()) {
            <div class="stack sub-form">
              <p class="muted">Externista nedostává účet ani členství ve skupinách – eviduje se jen kvůli zápůjčce.</p>
              <input class="input" placeholder="Jméno a příjmení *" [value]="extName()" (input)="extName.set($any($event.target).value)" />
              <input class="input" placeholder="Kontakt (telefon, e-mail)" [value]="extContact()" (input)="extContact.set($any($event.target).value)" />
              <input class="input" placeholder="Poznámka" [value]="extNote()" (input)="extNote.set($any($event.target).value)" />
              <div class="row">
                <button type="button" class="btn-primary btn-primary--sm" [disabled]="busy()" (click)="createExternal()">Založit externistu</button>
                <button type="button" class="btn-secondary" (click)="showNewExternal.set(false)">Zrušit</button>
              </div>
            </div>
          }
        </section>

        <!-- Co se předává -->
        <section class="detail">
          <h2 class="detail__section-title">Co</h2>
          <div class="segmented">
            <button type="button" class="segmented__btn" [class.segmented__btn--active]="mode() === 'kit'" (click)="mode.set('kit')">Komplet</button>
            <button type="button" class="segmented__btn" [class.segmented__btn--active]="mode() === 'items'" (click)="mode.set('items')">Jednotlivé součásti</button>
          </div>

          @if (mode() === 'kit') {
            <select class="input" (change)="selectKit($any($event.target).value)" aria-label="Komplet">
              <option value="" [selected]="kitId() === null">— vyberte komplet —</option>
              @for (kit of state().kits; track kit.id) {
                <option [value]="kit.id" [selected]="kit.id === kitId()" [disabled]="kitOnLoan(kit.id)">
                  {{ kit.label }}{{ kitOnLoan(kit.id) ? ' (zapůjčen)' : '' }}
                </option>
              }
            </select>

            @if (candidates(); as c) {
              @if (c.items.length === 0 && c.bulk.length === 0) {
                <p class="state-note">V kompletu není nic k předání.</p>
              }
              <div class="stack">
                @for (item of c.items; track item.id) {
                  <label class="check">
                    <input type="checkbox" [checked]="!excluded().has(item.id)" (change)="toggleExcluded(item.id)" />
                    {{ label(item) }}
                    @if (item.size) { <span class="muted">vel. {{ item.size }}</span> }
                  </label>
                }
                @for (b of c.bulk; track b.partTypeId) {
                  <label class="check">
                    <input class="input input--count" type="number" min="0" [max]="b.count" [value]="kitBulkCount(b.partTypeId, b.count)" (input)="setKitBulkCount(b.partTypeId, $any($event.target).value, b.count)" />
                    {{ partType(b.partTypeId) }} <span class="muted">(v kompletu {{ b.count }} ks)</span>
                  </label>
                }
              </div>
              @if (c.exceptions.length) {
                <div class="info-box">
                  <strong>Nebude součástí předání:</strong>
                  <ul>
                    @for (e of c.exceptions; track e.label + e.reason) {
                      <li>{{ e.label }} – {{ e.reason }}</li>
                    }
                  </ul>
                </div>
              }
            }
          } @else {
            <input class="input input--search" type="search" placeholder="Hledat součást (druh, řada, číslo, komplet)…" [value]="itemSearch()" (input)="itemSearch.set($any($event.target).value)" />
            <div class="stack pick-list">
              @for (item of availableItems(); track item.id) {
                <label class="check">
                  <input type="checkbox" [checked]="selected().has(item.id)" (change)="toggleSelected(item.id)" />
                  {{ label(item) }}
                  @if (item.kitId !== undefined) { <span class="muted">· {{ kit(item.kitId) }}</span> }
                  @if (item.size) { <span class="muted">· vel. {{ item.size }}</span> }
                </label>
              } @empty {
                <p class="state-note">Žádná dostupná součást.</p>
              }
            </div>

            <h3 class="detail__section-title">Neočíslované kusy z kompletu</h3>
            @for (pick of bulkPicks(); track $index) {
              <div class="row">
                <span>{{ partType(pick.partTypeId) }} – {{ pick.count }} ks <span class="muted">({{ kit(pick.kitId) }})</span></span>
                <button type="button" class="btn-secondary" (click)="removeBulkPick($index)">Odebrat</button>
              </div>
            }
            <div class="row">
              <select class="input" (change)="bulkKitId.set(+$any($event.target).value || null); bulkPartTypeId.set(null)" aria-label="Komplet">
                <option value="">— komplet —</option>
                @for (kit of kitsWithBulk(); track kit.id) {
                  <option [value]="kit.id" [selected]="kit.id === bulkKitId()">{{ kit.label }}</option>
                }
              </select>
              <select class="input" (change)="bulkPartTypeId.set(+$any($event.target).value || null)" aria-label="Druh">
                <option value="">— druh —</option>
                @for (b of bulkOptions(); track b.partTypeId) {
                  <option [value]="b.partTypeId" [selected]="b.partTypeId === bulkPartTypeId()">{{ partType(b.partTypeId) }} ({{ b.present }} ks)</option>
                }
              </select>
              <input class="input input--count" type="number" min="1" [value]="bulkCount()" (input)="bulkCount.set(+$any($event.target).value)" aria-label="Počet" />
              <button type="button" class="btn-secondary" [disabled]="!bulkKitId() || !bulkPartTypeId()" (click)="addBulkPick()">Přidat</button>
            </div>
          }
        </section>

        <!-- Kdy -->
        <section class="detail">
          <h2 class="detail__section-title">Podmínky</h2>
          <div class="form-field">
            <label for="issuedAt">Datum předání</label>
            <input id="issuedAt" type="date" [value]="issuedAt()" (input)="issuedAt.set($any($event.target).value)" />
          </div>
          <label class="check">
            <input type="checkbox" [checked]="longTerm()" (change)="longTerm.set(!longTerm())" /> Dlouhodobé přidělení
          </label>
          @if (!longTerm()) {
            <div class="form-field">
              <label for="dueAt">Vrátit do</label>
              <input id="dueAt" type="date" [value]="dueAt()" (input)="dueAt.set($any($event.target).value)" />
            </div>
          }
          <div class="form-field">
            <label for="note">Poznámka k zápůjčce</label>
            <input id="note" type="text" placeholder="např. na vystoupení, vrátit po Katerinkách" [value]="note()" (input)="note.set($any($event.target).value)" />
          </div>
        </section>

        <!-- Souhrn -->
        <section class="detail">
          <h2 class="detail__section-title">Souhrn předání</h2>
          <p><strong>{{ selectedBorrower()?.label ?? 'Vypůjčitel nevybrán' }}</strong>
            @if (mode() === 'kit' && kitId() !== null) { · komplet {{ kit(kitId()!) }} }
          </p>
          @if (summary().length) {
            <ul class="summary">
              @for (line of summary(); track line) { <li>{{ line }}</li> }
            </ul>
          } @else {
            <p class="muted">Nic není vybráno.</p>
          }
          <p class="muted">
            Předání {{ issuedAt() }} ·
            @if (longTerm()) { dlouhodobě } @else if (dueAt()) { vrátit do {{ dueAt() }} } @else { bez termínu vrácení }
          </p>

          @if (error()) { <div class="error-box">{{ error() }}</div> }

          <div class="row">
            <button type="button" class="btn-primary" [disabled]="busy() || !canSubmit()" (click)="submit()">
              {{ busy() ? 'Ukládám…' : 'Potvrdit předání' }}
            </button>
            <a routerLink="/app/costumes/loans" class="btn-secondary">Zrušit</a>
          </div>
        </section>
      </div>
    </div>
  `,
  styles: [
    LOAN_PAGE_STYLES,
    `
      .form { max-width: 720px; }
      .detail { gap: var(--spacing-sm); }
      .sub-form { padding: var(--spacing-md); border: 1px dashed var(--color-border); border-radius: 8px; }
      .pick-list { max-height: 320px; overflow-y: auto; }
      .summary { padding-left: 20px; font-size: var(--font-size-sm); }
      .info-box ul { padding-left: 20px; margin-top: var(--spacing-xs); }
      select[size] { width: 100%; }
    `,
  ],
})
export class CostumeLoanFormComponent {
  private costumes = inject(CostumesService);
  private router = inject(Router);

  readonly state = toSignal(this.costumes.state$, { requireSync: true });
  readonly members = toSignal(inject(MembersService).getMembers(), { initialValue: [] });

  readonly borrowerKey = signal('');
  readonly borrowerSearch = signal('');
  readonly showNewExternal = signal(false);
  readonly extName = signal('');
  readonly extContact = signal('');
  readonly extNote = signal('');

  readonly mode = signal<LoanMode>('kit');
  readonly kitId = signal<number | null>(null);
  readonly excluded = signal(new Set<number>());
  readonly kitBulkCounts = signal<Record<number, number>>({});

  readonly itemSearch = signal('');
  readonly selected = signal(new Set<number>());
  readonly bulkPicks = signal<BulkPick[]>([]);
  readonly bulkKitId = signal<number | null>(null);
  readonly bulkPartTypeId = signal<number | null>(null);
  readonly bulkCount = signal(1);

  readonly issuedAt = signal(todayInputValue());
  readonly longTerm = signal(false);
  readonly dueAt = signal('');
  readonly note = signal('');

  readonly busy = signal(false);
  readonly error = signal('');

  readonly options = computed(() => borrowerOptions(this.state(), this.members()));
  readonly selectedBorrower = computed<BorrowerOption | undefined>(() => this.options().find((o) => o.key === this.borrowerKey()));
  readonly borrowerGroups = computed(() => {
    const visible = this.options().filter((o) => o.key === this.borrowerKey() || matchesSearch(o.label, this.borrowerSearch()));
    return [
      { label: 'Členové', options: visible.filter((o) => o.group === 'member') },
      { label: 'Bývalí členové', options: visible.filter((o) => o.group === 'former') },
      { label: 'Externisté', options: visible.filter((o) => o.group === 'external') },
    ];
  });

  readonly candidates = computed(() => {
    const kit = this.state().kits.find((k) => k.id === this.kitId());
    return kit ? kitIssueCandidates(this.state(), kit, this.members()) : null;
  });

  readonly availableItems = computed(() => {
    const state = this.state();
    return state.items
      .filter((item) => itemStatus(state, item) === 'available')
      .filter((item) => this.selected().has(item.id) || matchesSearch(`${itemLabel(state, item)} ${kitLabel(state, item.kitId)}`, this.itemSearch()))
      .sort((a, b) => itemLabel(state, a).localeCompare(itemLabel(state, b), 'cs'));
  });

  readonly kitsWithBulk = computed(() => this.state().kits.filter((k) => k.bulk.some((b) => b.present > 0)));
  readonly bulkOptions = computed(() => this.state().kits.find((k) => k.id === this.bulkKitId())?.bulk.filter((b) => b.present > 0) ?? []);

  // Přesně to, co se zapíše do zápůjčky
  readonly issueInput = computed<Omit<IssueLoanInput, 'borrower' | 'issuedAt' | 'dueAt' | 'longTerm' | 'note'>>(() => {
    if (this.mode() === 'kit') {
      const c = this.candidates();
      const kitId = this.kitId();
      if (!c || kitId === null) return { itemIds: [], bulk: [] };
      return {
        kitId,
        itemIds: c.items.filter((i) => !this.excluded().has(i.id)).map((i) => i.id),
        bulk: c.bulk.map((b) => ({ kitId, partTypeId: b.partTypeId, count: this.kitBulkCount(b.partTypeId, b.count) })).filter((b) => b.count > 0),
      };
    }
    return { itemIds: [...this.selected()], bulk: this.bulkPicks() };
  });

  readonly summary = computed(() => {
    const state = this.state();
    const input = this.issueInput();
    return [
      ...input.itemIds.map((id) => {
        const item = state.items.find((i) => i.id === id);
        return item ? itemLabel(state, item) : `#${id}`;
      }),
      ...input.bulk.map((b) => `${partTypeName(state, b.partTypeId)} – ${b.count} ks (${kitLabel(state, b.kitId)})`),
    ];
  });

  readonly canSubmit = computed(() => !!this.selectedBorrower() && this.summary().length > 0 && !!this.issuedAt());

  constructor() {
    const params = inject(ActivatedRoute).snapshot.queryParamMap;
    const borrower = params.get('borrower');
    if (borrower && parseBorrowerKey(borrower)) this.borrowerKey.set(borrower);
    const itemId = Number(params.get('itemId'));
    const kitId = Number(params.get('kitId'));
    if (itemId) {
      this.mode.set('items');
      this.selected.set(new Set([itemId]));
    } else if (kitId) {
      this.kitId.set(kitId);
    }
  }

  label(item: CostumeItem): string {
    return itemLabel(this.state(), item);
  }

  kit(kitId: number | undefined): string {
    return kitLabel(this.state(), kitId);
  }

  partType(partTypeId: number): string {
    return partTypeName(this.state(), partTypeId);
  }

  kitOnLoan(kitId: number): boolean {
    return !!openKitLoan(this.state(), kitId);
  }

  selectKit(value: string): void {
    this.kitId.set(Number(value) || null);
    this.excluded.set(new Set());
    this.kitBulkCounts.set({});
  }

  toggleExcluded(itemId: number): void {
    this.excluded.update((set) => toggle(set, itemId));
  }

  toggleSelected(itemId: number): void {
    this.selected.update((set) => toggle(set, itemId));
  }

  kitBulkCount(partTypeId: number, max: number): number {
    return this.kitBulkCounts()[partTypeId] ?? max;
  }

  setKitBulkCount(partTypeId: number, value: string, max: number): void {
    const count = Math.min(max, Math.max(0, Math.floor(Number(value) || 0)));
    this.kitBulkCounts.update((counts) => ({ ...counts, [partTypeId]: count }));
  }

  addBulkPick(): void {
    const kitId = this.bulkKitId();
    const partTypeId = this.bulkPartTypeId();
    const count = Math.floor(this.bulkCount());
    if (!kitId || !partTypeId || count < 1) return;
    this.bulkPicks.update((picks) => [...picks.filter((p) => !(p.kitId === kitId && p.partTypeId === partTypeId)), { kitId, partTypeId, count }]);
    this.bulkPartTypeId.set(null);
    this.bulkCount.set(1);
  }

  removeBulkPick(index: number): void {
    this.bulkPicks.update((picks) => picks.filter((_, i) => i !== index));
  }

  createExternal(): void {
    this.error.set('');
    this.busy.set(true);
    this.costumes.createExternal({ name: this.extName(), contact: this.extContact(), note: this.extNote() }).subscribe({
      next: (person) => {
        this.busy.set(false);
        this.borrowerKey.set(`external-${person.id}`);
        this.showNewExternal.set(false);
        this.extName.set('');
        this.extContact.set('');
        this.extNote.set('');
      },
      error: (err: Error) => {
        this.busy.set(false);
        this.error.set(err.message);
      },
    });
  }

  submit(): void {
    const borrower = parseBorrowerKey(this.borrowerKey());
    if (!borrower) {
      this.error.set('Vyberte vypůjčitele.');
      return;
    }
    this.error.set('');
    this.busy.set(true);
    this.costumes
      .issueLoan({
        ...this.issueInput(),
        borrower,
        issuedAt: dateInputToIso(this.issuedAt()),
        longTerm: this.longTerm(),
        dueAt: !this.longTerm() && this.dueAt() ? dateInputToIso(this.dueAt()) : undefined,
        note: this.note(),
      })
      .subscribe({
        next: (loan) => this.router.navigate(['/app/costumes/loans', loan.id]),
        error: (err: Error) => {
          this.busy.set(false);
          this.error.set(err.message);
        },
      });
  }
}

function toggle(set: Set<number>, id: number): Set<number> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

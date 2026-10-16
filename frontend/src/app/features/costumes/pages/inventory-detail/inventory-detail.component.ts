import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs/operators';
import { CostumesNavComponent } from '../../costumes-nav/costumes-nav.component';
import { CostumeRuleError, CostumesService } from '../../costumes.service';
import { MembersService } from '../../../members/members.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { AccessService } from '../../../../core/access/access.service';
import { InventoryResult } from '../../models/costume.model';
import { INVENTORY_RESULT_LABELS, inventoryProgress, seriesName } from '../../utils/costume-logic';
import { downloadCsv, printPage } from '../../../../shared/export/export.utils';
import {
  filterLineViews,
  groupByKit,
  INVENTORY_TABS,
  InventoryLineView,
  InventoryTab,
  inventoryCsvRows,
  inventoryLineView,
  matchesTab,
  resultLabel,
  suggestBulkResult,
  userNameFromMembers,
} from './inventory-detail.utils';

@Component({
  selector: 'app-costume-inventory-detail',
  standalone: true,
  imports: [CostumesNavComponent, RouterLink, FormsModule, DatePipe],
  template: `
    <div class="page">
      <app-costumes-nav />
      <a routerLink="/app/costumes/inventories" class="back-link no-print">← Inventury</a>

      @if (!state()) {
        <p class="state-note">Načítání…</p>
      } @else if (!inventory()) {
        <p class="state-note">Inventura nebyla nalezena.</p>
      } @else {
        @let inv = inventory()!;
        @let p = progress()!;
        <h1 class="page__title">{{ inv.name }}</h1>
        <p class="inv-meta">
          {{ scopeLabel() }} · zahájeno {{ inv.startedAt | date: 'd. M. yyyy H:mm' }} ({{ userName(inv.startedByUserId) }})
          @if (inv.closedAt) {
            · <strong>uzavřeno {{ inv.closedAt | date: 'd. M. yyyy H:mm' }}</strong>
          } @else {
            · <span class="badge">probíhá</span>
          }
        </p>

        @if (error()) {
          <div class="inv-error" role="alert">
            {{ error() }}
            <button type="button" class="inv-link no-print" (click)="error.set('')">Zavřít</button>
          </div>
        }

        <div class="inv-progress" role="progressbar" [attr.aria-valuenow]="p.checked" aria-valuemin="0" [attr.aria-valuemax]="p.total">
          <div class="inv-progress__bar" [style.width.%]="p.total ? (p.checked / p.total) * 100 : 0"></div>
        </div>
        <div class="inv-counters">
          <span>Zkontrolováno <strong>{{ p.checked }} / {{ p.total }}</strong></span>
          <span>Nesrovnalosti <strong>{{ p.problem }}</strong></span>
          <span>Chybí <strong>{{ p.missing }}</strong></span>
          <span>Mimo sklad neověřeno <strong>{{ p.outsideUnchecked }} / {{ p.outside }}</strong></span>
        </div>

        <!-- Procházení skladu (na tisku skryto) -->
        <section class="no-print">
          <div class="inv-tabs segmented" role="group" aria-label="Filtr">
            @for (t of tabs; track t.id) {
              <button type="button" class="segmented__btn" [class.segmented__btn--active]="tab() === t.id"
                [attr.aria-pressed]="tab() === t.id" (click)="tab.set(t.id)">
                {{ t.label }} ({{ tabCount(t.id) }})
              </button>
            }
          </div>
          @if (tab() === 'outside') {
            <p class="inv-hint">Věci u členů a externistů – ověřte osobní kontrolou.</p>
          }
          <input class="inv-input inv-search" type="search" placeholder="Hledat číslo, součást, komplet, osobu…"
            [ngModel]="query()" (ngModelChange)="query.set($event)" aria-label="Hledat" />

          @if (!groups().length) {
            <p class="state-note">V tomto výběru nejsou žádné položky.</p>
          }
          @for (group of groups(); track group.kitId ?? 'none') {
            <h2 class="inv-group">{{ group.title }} <span class="inv-group__count">{{ group.lines.length }}</span></h2>
            <ul class="item-list">
              @for (v of group.lines; track v.line.key) {
                <li class="item-list__item inv-line" [attr.data-result]="v.line.result ?? 'none'">
                  <div class="item-list__row">
                    <span class="item-list__title">{{ v.label }}</span>
                    <span class="badge inv-badge" [attr.data-result]="v.line.result ?? (v.line.holder ? 'outside' : 'none')">{{ resultLabel(v.line) }}</span>
                  </div>
                  <div class="item-list__meta">
                    @if (v.isBulk) { Očekáváno {{ v.line.expectedCount }} ks · }
                    {{ v.location }}
                    @if (v.line.foundCount !== undefined && v.isBulk) { · nalezeno {{ v.line.foundCount }} ks }
                    @if (v.line.checkedAt) { · {{ v.line.checkedAt | date: 'd. M. H:mm' }} ({{ userName(v.line.checkedByUserId!) }}) }
                  </div>
                  @if (v.line.holder && !v.line.result) {
                    <p class="inv-hint">Ověřte osobně – samotné tvrzení vypůjčitele nestačí.</p>
                  }
                  @if (v.line.note && editKey() !== v.line.key) {
                    <p class="item-list__body">Poznámka: {{ v.line.note }}</p>
                  }

                  @if (canEdit()) {
                    @if (editKey() === v.line.key) {
                      <div class="inv-editor">
                        <div class="segmented" role="group" aria-label="Výsledek">
                          @for (r of results; track r) {
                            <button type="button" class="segmented__btn" [class.segmented__btn--active]="editResult() === r"
                              (click)="editResult.set(r)">{{ resultLabels[r] }}</button>
                          }
                        </div>
                        @if (v.isBulk) {
                          <label class="inv-field">
                            Nalezeno kusů (z {{ v.line.expectedCount }})
                            <input class="inv-input" type="number" min="0" inputmode="numeric"
                              [ngModel]="editFound()" (ngModelChange)="onFoundChange(v, $event)" />
                          </label>
                          @if (editFound() !== null && suggest(v) !== editResult()) {
                            <p class="inv-hint">
                              Navrhovaný výsledek: <strong>{{ resultLabels[suggest(v)] }}</strong>
                              <button type="button" class="inv-link" (click)="editResult.set(suggest(v))">Použít</button>
                            </p>
                          }
                        }
                        <label class="inv-field">
                          Poznámka{{ editResult() === 'problem' ? ' (co nesouhlasí)' : '' }}
                          <input class="inv-input" type="text" [ngModel]="editNote()" (ngModelChange)="editNote.set($event)"
                            placeholder="Poškození, nesrovnalost…" />
                        </label>
                        <div class="inv-actions">
                          <button type="button" class="btn-primary btn-primary--sm" [disabled]="busy()" (click)="saveEdit(v)">Uložit</button>
                          <button type="button" class="attendance-btn" (click)="editKey.set(null)">Zrušit úpravu</button>
                        </div>
                      </div>
                    } @else {
                      <div class="inv-actions">
                        <button type="button" class="attendance-btn inv-btn-ok" [class.attendance-btn--active]="v.line.result === 'ok'"
                          [disabled]="busy()" (click)="quickOk(v)">✓ Zkontrolováno</button>
                        <button type="button" class="attendance-btn" [class.attendance-btn--active]="v.line.result === 'problem'"
                          [disabled]="busy()" (click)="openEdit(v, 'problem')">Nesrovnalost</button>
                        <button type="button" class="attendance-btn" [class.attendance-btn--active]="v.line.result === 'missing'"
                          [disabled]="busy()" (click)="quickMissing(v)">Chybí</button>
                        <button type="button" class="inv-link" (click)="openEdit(v, v.line.result ?? 'ok')">Poznámka</button>
                        @if (v.line.result) {
                          <button type="button" class="attendance-btn attendance-btn--clear" [disabled]="busy()" (click)="reset(v)">Zrušit</button>
                        }
                      </div>
                    }
                  }
                </li>
              }
            </ul>
          }
        </section>

        <!-- Souhrn inventury včetně nesrovnalostí -->
        <section class="detail inv-summary" [class.no-print]="checklistMode()">
          <h2 class="detail__section-title">Souhrn inventury včetně nesrovnalostí</h2>
          <p class="inv-print-only"><strong>{{ inv.name }}</strong> – {{ scopeLabel() }}, zahájeno {{ inv.startedAt | date: 'd. M. yyyy' }}
            @if (inv.closedAt) { , uzavřeno {{ inv.closedAt | date: 'd. M. yyyy' }} }</p>
          <dl class="detail__meta">
            <dt>Položek celkem</dt><dd>{{ p.total }}</dd>
            <dt>Zkontrolováno v pořádku</dt><dd>{{ p.ok }}</dd>
            <dt>Nesrovnalosti</dt><dd>{{ p.problem }}</dd>
            <dt>Chybí</dt><dd>{{ p.missing }}</dd>
            <dt>Nezkontrolováno</dt><dd>{{ p.unchecked }}</dd>
            <dt>Mimo sklad (neověřeno)</dt><dd>{{ p.outside }} ({{ p.outsideUnchecked }})</dd>
          </dl>
          @if (summaryLines().length) {
            <table class="inv-table">
              <thead><tr><th>Komplet</th><th>Položka</th><th>Umístění</th><th>Výsledek</th><th>Poznámka</th></tr></thead>
              <tbody>
                @for (v of summaryLines(); track v.line.key) {
                  <tr>
                    <td>{{ v.kitName || '–' }}</td>
                    <td>{{ v.label }}@if (v.isBulk && v.line.foundCount !== undefined) { (nalezeno {{ v.line.foundCount }}) }</td>
                    <td>{{ v.location }}</td>
                    <td>{{ resultLabel(v.line) }}</td>
                    <td>{{ v.line.note }}</td>
                  </tr>
                }
              </tbody>
            </table>
          } @else {
            <p class="state-note">Žádné nesrovnalosti ani nezkontrolované položky.</p>
          }
        </section>

        <!-- Inventurní seznam pro kontrolu (papírová podoba) -->
        @if (checklistMode()) {
          <section class="detail inv-checklist">
            <h2 class="detail__section-title">Inventurní seznam pro kontrolu – {{ inv.name }}</h2>
            <table class="inv-table">
              <thead><tr><th class="inv-table__check">✓</th><th>Komplet</th><th>Položka</th><th>Očekáváno</th><th>Umístění podle evidence</th><th>Poznámka</th></tr></thead>
              <tbody>
                @for (group of allGroups(); track group.kitId ?? 'none') {
                  @for (v of group.lines; track v.line.key) {
                    <tr>
                      <td class="inv-table__check"><span class="inv-box"></span></td>
                      <td>{{ group.title }}</td>
                      <td>{{ v.label }}</td>
                      <td>{{ v.line.expectedCount }}</td>
                      <td>{{ v.location }}</td>
                      <td class="inv-table__note"></td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          </section>
        }

        <div class="inv-actions inv-footer no-print">
          <label class="inv-check">
            <input type="checkbox" [ngModel]="checklistMode()" (ngModelChange)="checklistMode.set($event)" />
            Tisknout jako kontrolní seznam
          </label>
          <button type="button" class="attendance-btn" (click)="print()">Tisk</button>
          <button type="button" class="attendance-btn" (click)="exportCsv()">Export CSV</button>
          @if (canEdit()) {
            <button type="button" class="btn-primary btn-primary--sm" [disabled]="busy()" (click)="close()">Uzavřít inventuru</button>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .inv-meta { color: var(--color-text-muted); font-size: var(--font-size-sm); margin: calc(-1 * var(--spacing-sm)) 0 var(--spacing-md); }
    .inv-error {
      display: flex; justify-content: space-between; gap: var(--spacing-sm); align-items: center;
      background: #ffebee; color: #c62828; border: 1px solid #ef9a9a; border-radius: 6px;
      padding: var(--spacing-sm) var(--spacing-md); margin-bottom: var(--spacing-md); font-size: var(--font-size-sm);
    }
    .inv-progress { height: 10px; border-radius: 5px; background: var(--color-surface-alt); border: 1px solid var(--color-border); overflow: hidden; }
    .inv-progress__bar { height: 100%; background: var(--color-primary); transition: width 0.2s; }
    .inv-counters { display: flex; flex-wrap: wrap; gap: var(--spacing-xs) var(--spacing-md); font-size: var(--font-size-sm); color: var(--color-text-muted); margin: var(--spacing-sm) 0 var(--spacing-md); }
    .inv-counters strong { color: var(--color-text); }
    .inv-tabs { display: flex; flex-wrap: wrap; margin-bottom: var(--spacing-sm); }
    .inv-tabs .segmented__btn { flex: 1 1 auto; }
    .inv-input {
      padding: 10px var(--spacing-sm); border: 1px solid var(--color-border); border-radius: 6px;
      font-size: var(--font-size-base); background: var(--color-surface); color: var(--color-text); width: 100%;
    }
    .inv-search { margin-bottom: var(--spacing-md); }
    .inv-group { font-size: var(--font-size-base); font-weight: 700; margin: var(--spacing-md) 0 var(--spacing-sm); display: flex; gap: var(--spacing-sm); align-items: center; }
    .inv-group__count { font-size: var(--font-size-xs); color: var(--color-text-muted); font-weight: 400; }
    .inv-line[data-result='ok'] { border-left: 4px solid #2e7d32; }
    .inv-line[data-result='problem'] { border-left: 4px solid #f57f17; }
    .inv-line[data-result='missing'] { border-left: 4px solid #c62828; }
    .inv-badge[data-result='ok'] { background: #e8f5e9; color: #2e7d32; border-color: #a5d6a7; }
    .inv-badge[data-result='problem'] { background: #fff8e1; color: #f57f17; border-color: #ffe082; }
    .inv-badge[data-result='missing'] { background: #ffebee; color: #c62828; border-color: #ef9a9a; }
    .inv-badge[data-result='outside'] { background: #e3f2fd; color: #1565c0; border-color: #90caf9; }
    .inv-hint { font-size: var(--font-size-sm); color: var(--color-text-muted); font-style: italic; margin: var(--spacing-xs) 0; }
    .inv-actions { display: flex; flex-wrap: wrap; gap: var(--spacing-sm); align-items: center; margin-top: var(--spacing-sm); }
    .inv-actions .attendance-btn { min-height: 40px; }
    .inv-link { background: none; border: none; color: var(--color-primary); font-size: var(--font-size-sm); text-decoration: underline; cursor: pointer; padding: 4px; }
    .inv-editor { display: flex; flex-direction: column; gap: var(--spacing-sm); margin-top: var(--spacing-sm); padding-top: var(--spacing-sm); border-top: 1px dashed var(--color-border); }
    .inv-field { display: flex; flex-direction: column; gap: var(--spacing-xs); font-size: var(--font-size-sm); color: var(--color-text-muted); }
    .inv-summary, .inv-checklist { margin-top: var(--spacing-lg); }
    .inv-table { width: 100%; border-collapse: collapse; font-size: var(--font-size-sm); }
    .inv-table th, .inv-table td { border: 1px solid var(--color-border); padding: 4px 6px; text-align: left; vertical-align: top; }
    .inv-table th { background: var(--color-surface-alt); }
    .inv-table__check { width: 28px; text-align: center; }
    .inv-table__note { min-width: 120px; }
    .inv-box { display: inline-block; width: 14px; height: 14px; border: 1px solid var(--color-text); }
    .inv-check { display: flex; gap: var(--spacing-xs); align-items: center; font-size: var(--font-size-sm); }
    .inv-footer { margin-top: var(--spacing-lg); }
    .inv-print-only { display: none; }
    .inv-summary, .inv-checklist { overflow-x: auto; }
    @media print {
      :host ::ng-deep .no-print { display: none !important; }
      .inv-print-only { display: block; }
      .inv-summary, .inv-checklist { border: none; box-shadow: none; padding: 0; }
      .inv-table th, .inv-table td { border-color: #000; color: #000; }
    }
  `,
})
export class CostumeInventoryDetailComponent {
  private readonly accessService = inject(AccessService);
  private readonly costumes = inject(CostumesService);
  private readonly membersService = inject(MembersService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  readonly tabs = INVENTORY_TABS;
  readonly results: InventoryResult[] = ['ok', 'problem', 'missing'];
  readonly resultLabels = INVENTORY_RESULT_LABELS;
  readonly resultLabel = resultLabel;

  readonly state = toSignal(this.costumes.state$);
  readonly members = toSignal(this.membersService.getMembers(), { initialValue: [] });
  private readonly inventoryId = toSignal(this.route.paramMap.pipe(map((p) => Number(p.get('id')))), { initialValue: NaN });

  readonly tab = signal<InventoryTab>('unchecked');
  readonly query = signal('');
  readonly checklistMode = signal(false);
  readonly error = signal('');
  readonly busy = signal(false);

  // Rozbalený editor řádku (nesrovnalost, poznámka, nalezený počet)
  readonly editKey = signal<string | null>(null);
  readonly editResult = signal<InventoryResult>('ok');
  readonly editNote = signal('');
  readonly editFound = signal<number | null>(null);

  readonly inventory = computed(() => this.state()?.inventories.find((i) => i.id === this.inventoryId()));
  readonly progress = computed(() => {
    const inv = this.inventory();
    return inv ? inventoryProgress(inv) : undefined;
  });
  readonly canEdit = computed(() => this.accessService.canManageCostumes() && !this.inventory()?.closedAt);

  readonly scopeLabel = computed(() => {
    const inv = this.inventory();
    const state = this.state();
    if (!inv || !state) return '';
    return inv.seriesId !== undefined ? `Řada ${seriesName(state, inv.seriesId)}` : 'Celý sklad';
  });

  readonly lineViews = computed<InventoryLineView[]>(() => {
    const inv = this.inventory();
    const state = this.state();
    if (!inv || !state) return [];
    return inv.lines.map((line) => inventoryLineView(state, line, this.members()));
  });

  readonly groups = computed(() => groupByKit(filterLineViews(this.lineViews(), this.tab(), this.query())));
  readonly allGroups = computed(() => groupByKit(this.lineViews()));
  readonly summaryLines = computed(() =>
    this.allGroups().flatMap((g) => g.lines).filter((v) => v.line.result !== 'ok'),
  );


  tabCount(tab: InventoryTab): number {
    return this.inventory()?.lines.filter((l) => matchesTab(l, tab)).length ?? 0;
  }

  userName(userId: number): string {
    return userNameFromMembers(this.members(), userId);
  }

  suggest(v: InventoryLineView): InventoryResult {
    return suggestBulkResult(v.line.expectedCount, this.editFound() ?? 0);
  }

  onFoundChange(v: InventoryLineView, value: number | null): void {
    const found = value === null || (value as unknown) === '' ? null : Number(value);
    this.editFound.set(found);
    // Nalezeno méně, než se čekalo → rovnou předvolit nesrovnalost
    if (found !== null && !Number.isNaN(found)) this.editResult.set(suggestBulkResult(v.line.expectedCount, found));
  }

  openEdit(v: InventoryLineView, result: InventoryResult): void {
    this.editKey.set(v.line.key);
    this.editResult.set(result);
    this.editNote.set(v.line.note ?? '');
    this.editFound.set(v.isBulk ? (v.line.foundCount ?? null) : null);
  }

  quickOk(v: InventoryLineView): void {
    this.record(v, { result: 'ok', foundCount: v.isBulk ? v.line.expectedCount : undefined, note: v.line.note });
  }

  quickMissing(v: InventoryLineView): void {
    this.record(v, { result: 'missing', foundCount: v.isBulk ? 0 : undefined, note: v.line.note });
  }

  reset(v: InventoryLineView): void {
    this.record(v, { result: undefined });
  }

  saveEdit(v: InventoryLineView): void {
    const found = this.editFound();
    this.record(v, {
      result: this.editResult(),
      foundCount: v.isBulk && found !== null && !Number.isNaN(found) ? Math.max(0, found) : undefined,
      note: this.editNote(),
    });
  }

  close(): void {
    const inv = this.inventory();
    if (!inv) return;
    const unchecked = this.progress()?.unchecked ?? 0;
    const message = unchecked
      ? `Zbývá ${unchecked} nezkontrolovaných položek – zůstanou v uzavřené inventuře jako nezkontrolované (ne jako chybějící). Opravdu uzavřít?`
      : 'Uzavřít inventuru? Po uzavření ji už nelze měnit.';
    if (!confirm(message)) return;
    this.busy.set(true);
    this.costumes.closeInventory(inv.id).subscribe({
      next: () => this.busy.set(false),
      error: (e) => this.fail(e),
    });
  }

  print(): void {
    printPage();
  }

  exportCsv(): void {
    const inv = this.inventory();
    if (!inv) return;
    const rows = inventoryCsvRows(this.allGroups(), (id) => this.userName(id));
    downloadCsv(`inventura-${inv.id}-${inv.startedAt.slice(0, 10)}`, rows);
  }

  private record(v: InventoryLineView, check: { result?: InventoryResult; foundCount?: number; note?: string }): void {
    const inv = this.inventory();
    if (!inv || !this.canEdit()) return;
    this.busy.set(true);
    this.error.set('');
    this.costumes.recordInventoryCheck(inv.id, v.line.key, check).subscribe({
      next: () => {
        this.busy.set(false);
        this.editKey.set(null);
      },
      error: (e) => this.fail(e),
    });
  }

  private fail(e: unknown): void {
    this.busy.set(false);
    this.error.set(e instanceof CostumeRuleError ? e.message : 'Akci se nepodařilo provést.');
  }
}

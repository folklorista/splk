import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CostumesService } from '../../costumes.service';
import { findSeries, nextFreeNumber, seriesLabel, seriesStats, variantsForPartType } from '../../utils/costume-logic';
import { WardrobeNavComponent } from '../shared/wardrobe-nav.component';
import { errorMessage } from '../shared/wardrobe-ui';
import { WARDROBE_STYLES } from '../shared/wardrobe.styles';

// Založení / úprava fyzické součástky. Číslo platí v rámci řady; bez pravidla řady se čísla
// vyřazených kusů znovu nepřidělují.
@Component({
  selector: 'app-wardrobe-item-form',
  standalone: true,
  imports: [WardrobeNavComponent, RouterLink],
  template: `
    <div class="page">
      <app-wardrobe-nav />
      <a [routerLink]="id ? ['/app/wardrobe/stock', id] : '/app/wardrobe/stock'" class="back-link">← Zpět</a>
      <h1 class="page__title">{{ id ? 'Upravit součástku' : 'Nová součástka' }}</h1>
      @if (error()) { <div class="error-box" role="alert">{{ error() }}</div> }
      @if (state(); as st) {
        <div class="detail stack">
          <label class="field">Evidenční řada *
            <select class="input" (change)="selectSeries($any($event.target).value)">
              <option value="">— vyberte řadu —</option>
              @for (s of seriesOptions(); track s.id) { <option [value]="s.id" [selected]="seriesId() === s.id">{{ s.label }}</option> }
            </select>
          </label>
          @if (stats(); as s) {
            <p class="muted">
              V řadě {{ s.active }} kusů, nejvyšší číslo {{ s.maxNumber }}.
              @if (s.retiredNumbers.length) { Čísla vyřazených kusů: {{ s.retiredNumbers.join(', ') }} ({{ reuse() ? 'smí se znovu použít' : 'nepoužívají se znovu' }}). }
              @if (s.unusedNumbers.length) { Nepoužitá čísla: {{ s.unusedNumbers.join(', ') }}. }
            </p>
          }
          <div class="fields">
            <label class="field">Evidenční číslo
              <input class="input" type="number" inputmode="numeric" min="1" [value]="number()" (input)="number.set($any($event.target).value)" placeholder="prázdné = zatím bez čísla" />
            </label>
            @if (variants().length) {
              <label class="field">Varianta (atribut kusu)
                <select class="input" (change)="variantId.set($any($event.target).value)">
                  <option value="">—</option>
                  @for (v of variants(); track v.id) { <option [value]="v.id" [selected]="variantId() === v.id">{{ v.label }}</option> }
                </select>
              </label>
            }
            <label class="field">Velikost<input class="input" [value]="size()" (input)="size.set($any($event.target).value)" /></label>
          </div>
          @if (seriesId() && suggested()) {
            <p class="muted">Navržené číslo: <button type="button" class="btn-link" (click)="number.set('' + suggested())">{{ suggested() }}</button></p>
          }
          <label class="field">Popis<input class="input" [value]="description()" (input)="description.set($any($event.target).value)" /></label>
          <label class="field">Dlouhodobá poznámka<input class="input" [value]="note()" (input)="note.set($any($event.target).value)" /></label>
          <div class="row">
            <button type="button" class="btn-primary btn-primary--sm" [disabled]="busy()" (click)="save()">Uložit</button>
            <a class="btn-secondary" routerLink="/app/wardrobe/settings">Nová evidenční řada…</a>
          </div>
        </div>
      }
    </div>
  `,
  styles: [WARDROBE_STYLES],
})
export class WardrobeItemFormComponent {
  private costumes = inject(CostumesService);
  private router = inject(Router);
  readonly state = toSignal(this.costumes.state$);
  readonly id = Number(inject(ActivatedRoute).snapshot.paramMap.get('id')) || undefined;

  readonly seriesId = signal<number | null>(null);
  readonly number = signal('');
  readonly variantId = signal('');
  readonly size = signal('');
  readonly description = signal('');
  readonly note = signal('');
  readonly busy = signal(false);
  readonly error = signal('');

  readonly seriesOptions = computed(() => {
    const state = this.state();
    return state ? state.series.map((s) => ({ id: s.id, label: seriesLabel(state, s) })).sort((a, b) => a.label.localeCompare(b.label, 'cs')) : [];
  });
  private series = computed(() => (this.state() ? findSeries(this.state()!, this.seriesId() ?? undefined) : undefined));
  readonly stats = computed(() => (this.series() ? seriesStats(this.state()!, this.series()!.id) : null));
  readonly reuse = computed(() => !!this.series()?.allowNumberReuse);
  readonly suggested = computed(() => (this.series() && !this.id ? nextFreeNumber(this.state()!, this.series()!.id) : null));
  // Varianta jako atribut jen tam, kde není součástí klíče řady
  readonly variants = computed(() => {
    const series = this.series();
    return series && !series.variantId ? variantsForPartType(this.state()!, series.partTypeId) : [];
  });

  constructor() {
    const item = this.id ? this.costumes.snapshot.items.find((i) => i.id === this.id) : undefined;
    if (item) {
      this.seriesId.set(item.seriesId);
      this.number.set(item.number !== undefined ? String(item.number) : '');
      this.variantId.set(item.variantId ?? '');
      this.size.set(item.size ?? '');
      this.description.set(item.description ?? '');
      this.note.set(item.note ?? '');
    }
  }

  selectSeries(value: string): void {
    this.seriesId.set(value ? Number(value) : null);
    this.variantId.set('');
    if (!this.id && this.suggested()) this.number.set(String(this.suggested()));
  }

  save(): void {
    const seriesId = this.seriesId();
    if (!seriesId) {
      this.error.set('Vyberte evidenční řadu.');
      return;
    }
    const input = {
      seriesId,
      number: this.number().trim() ? Number(this.number()) : undefined,
      variantId: this.variants().length ? this.variantId() || undefined : undefined,
      size: this.size(),
      description: this.description(),
      note: this.note(),
    };
    this.busy.set(true);
    (this.id ? this.costumes.updateItem(this.id, input) : this.costumes.createItem(input)).subscribe({
      next: (item) => this.router.navigate(['/app/wardrobe/stock', item.id]),
      error: (e) => { this.busy.set(false); this.error.set(errorMessage(e)); },
    });
  }
}

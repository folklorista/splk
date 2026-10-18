import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { CostumesService } from '../../costumes.service';
import { AccessService } from '../../../../core/access/access.service';
import { CostumeKitTemplate } from '../../models/costume.model';
import { genderLabel, partTypeName, regionLabel, seriesLabel, seriesStats } from '../../utils/costume-logic';
import { WardrobeNavComponent } from '../shared/wardrobe-nav.component';
import { errorMessage } from '../shared/wardrobe-ui';
import { WARDROBE_STYLES } from '../shared/wardrobe.styles';

// Nastavení fondu pro soubor: klasifikace, druhy součástek, evidenční řady (včetně výslovného
// pravidla pro čísla vyřazených kusů), šablony kompletů a výchozí kapacita inventurního termínu.
@Component({
  selector: 'app-wardrobe-settings',
  standalone: true,
  imports: [WardrobeNavComponent],
  template: `
    <div class="page">
      <app-wardrobe-nav />
      <h1 class="page__title">Nastavení správy krojů</h1>
      @if (error()) { <div class="error-box" role="alert">{{ error() }}</div> }
      @if (state(); as st) {
        <section class="section">
          <h2 class="detail__section-title">Klasifikace</h2>
          <p class="muted">Pohlaví kroje: {{ labels(st.classification.genders) }}</p>
          <p class="muted">Regiony: {{ labels(st.classification.regions) }}</p>
          @if (canManage()) {
            <div class="row no-print">
              <input class="input" placeholder="Nový region" [value]="newRegion()" (input)="newRegion.set($any($event.target).value)" />
              <button type="button" class="btn-secondary" (click)="addRegion()">Přidat region</button>
            </div>
          }
          <h3 class="group-title">Varianty (doplňkové rozlišení)</h3>
          <ul class="item-list">
            @for (v of st.classification.variants; track v.id) {
              <li class="item-list__item"><strong>{{ v.label }}</strong> <span class="muted">– platí pro: {{ partNames(v.partTypeIds) }}</span></li>
            }
          </ul>
          @if (canManage()) {
            <div class="panel stack no-print">
              <input class="input" placeholder="Nová varianta (např. sváteční)" [value]="variantLabel()" (input)="variantLabel.set($any($event.target).value)" />
              <div class="row">@for (t of st.partTypes; track t.id) { <label class="check"><input type="checkbox" [checked]="variantParts().includes(t.id)" (change)="toggleVariantPart(t.id)" /> {{ t.name }}</label> }</div>
              <button type="button" class="btn-secondary" (click)="saveVariant()">Přidat variantu</button>
            </div>
          }
        </section>

        <section class="section">
          <h2 class="detail__section-title">Druhy součástek</h2>
          <p class="muted">@for (t of st.partTypes; track t.id) { {{ t.name }}@if (t.genderId) { ({{ gender(t.genderId) }}) }; }</p>
          @if (canManage()) {
            <div class="row no-print">
              <input class="input" placeholder="Nový druh" [value]="partName()" (input)="partName.set($any($event.target).value)" />
              <select class="input" (change)="partGender.set($any($event.target).value)">
                <option value="">mužský i ženský</option>
                @for (g of st.classification.genders; track g.id) { <option [value]="g.id">{{ g.label }}</option> }
              </select>
              <button type="button" class="btn-secondary" (click)="addPartType()">Přidat druh</button>
            </div>
          }
        </section>

        <section class="section">
          <h2 class="detail__section-title">Evidenční řady</h2>
          <p class="info-box">Řada = konkrétní kombinace klasifikace. Varianta může být součástí klíče řady (vlastní číselná řada, např. „Slovensko / Gatě modré“), nebo jen atributem kusů v jedné řadě (např. horňácké gatě bílé/modré v jedné řadě). O tom rozhoduje soubor při zakládání řady.</p>
          <div class="table-wrap">
            <table class="table">
              <tr><th>Řada</th><th>Kusů</th><th>Nejvyšší č.</th><th>Mezery / vyřazená č.</th><th>Čísla vyřazených</th></tr>
              @for (s of seriesRows(); track s.series.id) {
                <tr>
                  <td>{{ s.label }}</td>
                  <td>{{ s.stats.active }}</td>
                  <td>{{ s.stats.maxNumber }}</td>
                  <td class="muted">{{ s.stats.unusedNumbers.join(', ') || '–' }} / {{ s.stats.retiredNumbers.join(', ') || '–' }}</td>
                  <td>
                    @if (canManage()) {
                      <label class="check"><input type="checkbox" [checked]="!!s.series.allowNumberReuse" (change)="run(costumes.setSeriesNumberReuse(s.series.id, $any($event.target).checked))" /> smí se znovu použít</label>
                    } @else { {{ s.series.allowNumberReuse ? 'smí se znovu použít' : 'nepoužívají se' }} }
                  </td>
                </tr>
              }
            </table>
          </div>
          @if (canManage()) {
            <div class="panel stack no-print">
              <strong>Nová řada</strong>
              <div class="fields">
                <label class="field">Pohlaví<select class="input" (change)="sGender.set($any($event.target).value)"><option value="">—</option>@for (g of st.classification.genders; track g.id) { <option [value]="g.id">{{ g.label }}</option> }</select></label>
                <label class="field">Region<select class="input" (change)="sRegion.set($any($event.target).value)"><option value="">—</option>@for (r of st.classification.regions; track r.id) { <option [value]="r.id">{{ r.label }}</option> }</select></label>
                <label class="field">Druh<select class="input" (change)="sPart.set(+$any($event.target).value)"><option value="0">—</option>@for (t of st.partTypes; track t.id) { <option [value]="t.id">{{ t.name }}</option> }</select></label>
                <label class="field">Varianta v klíči řady<select class="input" (change)="sVariant.set($any($event.target).value)"><option value="">ne – varianta je atribut kusu</option>@for (v of st.classification.variants; track v.id) { <option [value]="v.id">{{ v.label }}</option> }</select></label>
              </div>
              <button type="button" class="btn-secondary" (click)="createSeries()">Založit řadu</button>
            </div>
          }
        </section>

        <section class="section">
          <h2 class="detail__section-title">Komplety (šablony)</h2>
          <p class="info-box">Komplet je šablona druhů součástek, které kroj potřebuje. Nevynucuje se při výdeji – jen upozorní v krojové kartě, který druh držiteli chybí.</p>
          <ul class="item-list">
            @for (t of st.kitTemplates; track t.id) {
              <li class="item-list__item">
                <div class="item-list__row">
                  <span class="item-list__title">{{ t.name }}</span>
                  @if (canManage()) {
                    <span class="row no-print"><button type="button" class="btn-link" (click)="editTemplate(t)">upravit</button><button type="button" class="btn-link" (click)="run(costumes.deleteKitTemplate(t.id))">smazat</button></span>
                  }
                </div>
                <div class="item-list__meta">{{ gender(t.genderId) }} / {{ region(t.regionId) }} · {{ partNames(t.partTypeIds) }}</div>
              </li>
            }
          </ul>
          @if (canManage()) {
            <div class="panel stack no-print">
              <strong>{{ tId() ? 'Upravit komplet' : 'Nový komplet' }}</strong>
              <input class="input" placeholder="Název" [value]="tName()" (input)="tName.set($any($event.target).value)" />
              <div class="fields">
                <label class="field">Pohlaví<select class="input" (change)="tGender.set($any($event.target).value)">@for (g of st.classification.genders; track g.id) { <option [value]="g.id" [selected]="tGender() === g.id">{{ g.label }}</option> }</select></label>
                <label class="field">Region<select class="input" (change)="tRegion.set($any($event.target).value)">@for (r of st.classification.regions; track r.id) { <option [value]="r.id" [selected]="tRegion() === r.id">{{ r.label }}</option> }</select></label>
              </div>
              <div class="row">@for (p of st.partTypes; track p.id) { <label class="check"><input type="checkbox" [checked]="tParts().includes(p.id)" (change)="toggleTemplatePart(p.id)" /> {{ p.name }}</label> }</div>
              <div class="row">
                <button type="button" class="btn-secondary" (click)="saveTemplate()">Uložit komplet</button>
                @if (tId()) { <button type="button" class="btn-link" (click)="resetTemplate()">zrušit úpravu</button> }
              </div>
            </div>
          }
        </section>

        <section class="section">
          <h2 class="detail__section-title">Inventury</h2>
          <label class="field">Výchozí kapacita termínu návštěv (osob)
            <input class="input input--short" type="number" min="1" inputmode="numeric" [disabled]="!canManage()" [value]="st.defaultSlotCapacity" (change)="run(costumes.setDefaultSlotCapacity(+$any($event.target).value))" />
          </label>
        </section>
      }
    </div>
  `,
  styles: [WARDROBE_STYLES],
})
export class WardrobeSettingsComponent {
  readonly costumes = inject(CostumesService);
  readonly canManage = inject(AccessService).canManageCostumes;
  readonly state = toSignal(this.costumes.state$);
  readonly error = signal('');

  readonly newRegion = signal('');
  readonly variantLabel = signal('');
  readonly variantParts = signal<number[]>([]);
  readonly partName = signal('');
  readonly partGender = signal('');
  readonly sGender = signal('');
  readonly sRegion = signal('');
  readonly sPart = signal(0);
  readonly sVariant = signal('');
  readonly tId = signal<number | undefined>(undefined);
  readonly tName = signal('');
  readonly tGender = signal('male');
  readonly tRegion = signal('hornacko');
  readonly tParts = signal<number[]>([]);

  readonly seriesRows = computed(() => {
    const state = this.state();
    if (!state) return [];
    return state.series
      .map((series) => ({ series, label: seriesLabel(state, series), stats: seriesStats(state, series.id) }))
      .sort((a, b) => a.label.localeCompare(b.label, 'cs'));
  });

  labels = (options: { label: string }[]) => options.map((o) => o.label).join(', ');
  partNames = (ids: number[]) => ids.map((id) => partTypeName(this.state()!, id)).join(', ');
  gender = (id: string) => genderLabel(this.state()!, id);
  region = (id: string) => regionLabel(this.state()!, id);

  private toggle(list: number[], id: number): number[] {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  }

  toggleVariantPart(id: number): void {
    this.variantParts.update((l) => this.toggle(l, id));
  }

  toggleTemplatePart(id: number): void {
    this.tParts.update((l) => this.toggle(l, id));
  }

  addRegion(): void {
    this.run(this.costumes.addRegion(this.newRegion()), () => this.newRegion.set(''));
  }

  addPartType(): void {
    this.run(this.costumes.createPartType(this.partName(), this.partGender()), () => this.partName.set(''));
  }

  saveVariant(): void {
    this.run(this.costumes.saveVariant({ label: this.variantLabel(), partTypeIds: this.variantParts() }), () => {
      this.variantLabel.set('');
      this.variantParts.set([]);
    });
  }

  createSeries(): void {
    if (!this.sGender() || !this.sRegion() || !this.sPart()) {
      this.error.set('Vyberte pohlaví, region a druh.');
      return;
    }
    this.run(this.costumes.createSeries({ genderId: this.sGender(), regionId: this.sRegion(), partTypeId: this.sPart(), variantId: this.sVariant() || undefined }));
  }

  editTemplate(t: CostumeKitTemplate): void {
    this.tId.set(t.id);
    this.tName.set(t.name);
    this.tGender.set(t.genderId);
    this.tRegion.set(t.regionId);
    this.tParts.set([...t.partTypeIds]);
  }

  resetTemplate(): void {
    this.tId.set(undefined);
    this.tName.set('');
    this.tParts.set([]);
  }

  saveTemplate(): void {
    this.run(
      this.costumes.saveKitTemplate({ id: this.tId(), name: this.tName(), genderId: this.tGender(), regionId: this.tRegion(), partTypeIds: this.tParts() }),
      () => this.resetTemplate(),
    );
  }

  run(obs: Observable<unknown>, done?: () => void): void {
    this.error.set('');
    obs.subscribe({ next: () => done?.(), error: (e) => this.error.set(errorMessage(e)) });
  }
}

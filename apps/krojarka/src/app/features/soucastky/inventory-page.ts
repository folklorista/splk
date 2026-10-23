import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { BulkStock, Gender, ItemCondition, ItemLocation } from '@splk/api-contracts';
import { errorMessage } from '../../core/auth/error-messages';
import { InventoryStore } from './inventory.store';
import { COMPOSITION_STATES, CONDITIONS, LOCATIONS } from './inventory-labels';

@Component({
  selector: 'app-inventory-page', imports: [RouterLink, ReactiveFormsModule], templateUrl: './inventory-page.html',
})
export class InventoryPage {
  protected readonly store = inject(InventoryStore);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  protected readonly conditions = Object.entries(CONDITIONS);
  protected readonly locations = Object.entries(LOCATIONS);
  protected readonly stateLabel = COMPOSITION_STATES;
  protected readonly conditionLabel = CONDITIONS;
  protected readonly locationLabel = LOCATIONS;
  protected readonly notice = signal('');
  protected readonly editingStock = signal<BulkStock | null>(null);
  protected readonly search = signal('');
  protected readonly selectedSeries = signal(0);
  protected readonly region = signal(0);
  protected readonly gender = signal<'' | Gender>('');
  protected readonly partType = signal(0);
  protected readonly variant = signal('');
  protected readonly condition = signal<'' | ItemCondition>('');
  protected readonly location = signal<'' | ItemLocation>('');
  protected readonly acquiredFrom = signal('');
  protected readonly acquiredTo = signal('');
  protected readonly retired = signal(false);
  protected readonly stockForm = this.fb.group({ partTypeId: [0], variant: [''], quantityTotal: [0], note: [''] });
  protected readonly kitForm = this.fb.group({ seriesId: [0], number: [''], description: [''], note: [''] });
  protected readonly unnumberedTypes = computed(() => this.store.partTypes().filter((t) => !t.numbered && !t.archived));
  protected readonly kitSeries = computed(() => this.store.series().filter((s) => s.kind === 'kit' && !s.archived));
  protected readonly groups = computed(() => this.store.series().filter((s) => s.kind === 'part' && (!this.selectedSeries() || this.selectedSeries() === s.id))
    .filter((s) => (!this.region() || this.region() === s.regionId || this.store.regions().find((r) => r.id === s.regionId)?.parentId === this.region())
      && (!this.gender() || this.gender() === s.gender) && (!this.partType() || this.partType() === s.partTypeId))
    .map((series) => ({ series, items: this.store.items().filter((i) => i.seriesId === series.id && !!i.retiredAt === this.retired())
      .filter((i) => (!this.condition() || this.condition() === i.condition) && (!this.location() || this.location() === i.location)
        && (!this.variant() || normalize(i.variant ?? series.variant ?? '').includes(normalize(this.variant())))
        && (!this.acquiredFrom() || !!i.acquiredOn && i.acquiredOn >= this.acquiredFrom()) && (!this.acquiredTo() || !!i.acquiredOn && i.acquiredOn <= this.acquiredTo()))
      .filter((i) => !this.search() || normalize([series.name, series.variant, i.number, i.variant, i.description, i.note].join(' ')).includes(normalize(this.search())))
      .sort((a, b) => (a.number ?? '~').localeCompare(b.number ?? '~', 'cs')) }))
    .sort((a, b) => a.series.name.localeCompare(b.series.name, 'cs')));
  protected readonly visibleKits = computed(() => this.store.kits().filter((k) => (!this.selectedSeries() || this.selectedSeries() === k.seriesId)
    && (!this.search() || normalize([this.store.seriesName(k.seriesId), k.number, k.description].join(' ')).includes(normalize(this.search())))));

  constructor() {
    effect(() => { this.store.fund()?.unitId; untracked(() => { this.editingStock.set(null); this.stockForm.reset(); this.kitForm.reset(); this.notice.set(''); }); });
  }

  protected editStock(stock: BulkStock): void { this.editingStock.set(stock); this.stockForm.reset({ partTypeId: stock.partTypeId, variant: stock.variant ?? '', quantityTotal: stock.quantityTotal, note: stock.note ?? '' }); }
  protected cancelStock(): void { this.editingStock.set(null); this.stockForm.reset(); }
  protected async saveStock(): Promise<void> {
    const unit = this.store.fund()?.unitId, value = this.stockForm.getRawValue(), editing = this.editingStock();
    this.notice.set('');
    try {
      const input = { variant: value.variant || null, quantityTotal: value.quantityTotal, note: value.note || null };
      if (editing) await this.store.updateStock(editing.id, input); else await this.store.createStock({ ...input, partTypeId: value.partTypeId });
      if (this.store.fund()?.unitId === unit) { this.cancelStock(); this.notice.set('Zásoba je uložená.'); }
    } catch (error) { if (this.store.fund()?.unitId === unit) this.notice.set(errorMessage(error)); }
  }
  protected async saveKit(): Promise<void> {
    const unit = this.store.fund()?.unitId, value = this.kitForm.getRawValue();
    this.notice.set('');
    try {
      const kit = await this.store.createKit({ seriesId: value.seriesId, number: value.number || null, description: value.description || null, note: value.note || null });
      if (this.store.fund()?.unitId === unit) await this.router.navigate(['/soucastky/komplety', kit.id]);
    } catch (error) { if (this.store.fund()?.unitId === unit) this.notice.set(errorMessage(error)); }
  }
}
function normalize(value: string): string { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }

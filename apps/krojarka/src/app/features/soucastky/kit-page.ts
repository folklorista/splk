import { AttachmentGallery } from '../dokumenty/attachment-gallery';
import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { CompositionInput, CompositionState, CostumeItem } from '@splk/api-contracts';
import { errorMessage } from '../../core/auth/error-messages';
import { InventoryStore } from './inventory.store';
import { COMPOSITION_STATES, LOCATIONS } from './inventory-labels';

@Component({ selector: 'app-kit-page', imports: [AttachmentGallery, RouterLink, ReactiveFormsModule, DatePipe], templateUrl: './kit-page.html' })
export class KitPage {
  protected readonly store = inject(InventoryStore);
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly id = computed(() => Number(this.params()?.get('id')) || 0);
  private editVersion = 1;
  protected readonly notice = signal('');
  protected readonly pending = signal<CompositionInput | null>(null);
  protected readonly states = Object.entries(COMPOSITION_STATES);
  protected readonly stateLabel = COMPOSITION_STATES;
  protected readonly locationLabel = LOCATIONS;
  protected readonly kitSeries = computed(() => this.store.series().filter((s) => s.kind === 'kit' && (!s.archived || s.id === this.store.kit()?.seriesId)));
  protected readonly targets = computed(() => this.store.kits().filter((k) => k.id !== this.id() && !k.retiredAt));
  protected readonly unassigned = computed(() => this.store.items().filter((i) => !i.retiredAt && i.kitId === null));
  protected readonly form = this.fb.group({ seriesId: [0], number: [''], description: [''], note: [''], compositionState: ['unverified' as CompositionState] });
  protected readonly itemForm = this.fb.group({ itemId: [0], targetKitId: [0], note: [''] });
  protected readonly bulkForm = this.fb.group({ stockId: [0], requiredQty: [1], presentQty: [0], targetKitId: [0], note: [''] });

  constructor() {
    effect(() => {
      const id = this.id(), unit = this.store.fund()?.unitId;
      untracked(() => { this.notice.set(''); this.pending.set(null); this.form.reset(); this.itemForm.reset(); this.bulkForm.reset(); if (id && unit) void this.store.openKit(id); });
    });
    effect(() => { const kit = this.store.kit(); if (kit && !this.form.dirty) untracked(() => { this.editVersion = kit.version; this.form.reset({ seriesId: kit.seriesId, number: kit.number ?? '', description: kit.description ?? '', note: kit.note ?? '', compositionState: kit.compositionState }); }); });
  }
  protected async refresh(): Promise<void> { this.pending.set(null); this.form.markAsPristine(); await this.store.openKit(this.id()); }
  protected async save(): Promise<void> {
    const kit = this.store.kit(), unit = this.store.fund()?.unitId;
    if (!kit) return;
    const value = this.form.getRawValue();
    try {
      await this.store.updateKit(kit.id, { ...value, number: value.number || null, description: value.description || null, note: value.note || null, version: this.editVersion });
      if (this.store.fund()?.unitId === unit) { this.form.markAsPristine(); await this.store.openKit(kit.id); this.notice.set('Komplet je uložený.'); }
    } catch (error) { if (this.store.fund()?.unitId === unit) this.notice.set(errorMessage(error)); }
  }
  protected proposeItem(action: 'add' | 'remove' | 'move', item?: CostumeItem): void {
    const kit = this.store.kit(), value = this.itemForm.getRawValue();
    const selected = item ?? this.store.items().find((i) => i.id === value.itemId);
    if (!kit || !selected) { this.notice.set('Vyberte konkrétní součástku.'); return; }
    const base = { version: kit.version, itemId: selected.id, itemVersion: selected.version, note: value.note };
    if (action === 'move') {
      const target = this.targets().find((k) => k.id === value.targetKitId);
      if (!target) { this.notice.set('Vyberte cílový komplet.'); return; }
      this.pending.set({ ...base, action, targetKitId: target.id, targetVersion: target.version });
    } else this.pending.set({ ...base, action });
    this.notice.set('');
  }
  protected proposeBulk(action: 'add' | 'remove' | 'move', stockId?: number, partial = false): void {
    const kit = this.store.kit(), value = this.bulkForm.getRawValue(), stock = stockId ?? value.stockId;
    if (!kit || !stock) { this.notice.set('Vyberte nečíslovanou zásobu.'); return; }
    const base = { version: kit.version, bulkStockId: stock, note: value.note };
    if (action === 'remove') this.pending.set(partial ? { ...base, action, requiredQty: value.requiredQty, presentQty: value.presentQty } : { ...base, action });
    else if (action === 'add') this.pending.set({ ...base, action, requiredQty: value.requiredQty, presentQty: value.presentQty });
    else {
      const target = this.targets().find((k) => k.id === value.targetKitId);
      if (!target) { this.notice.set('Vyberte cílový komplet.'); return; }
      this.pending.set({ ...base, action, requiredQty: value.requiredQty, presentQty: value.presentQty, targetKitId: target.id, targetVersion: target.version });
    }
    this.notice.set('');
  }
  protected async apply(): Promise<void> {
    const pending = this.pending(), unit = this.store.fund()?.unitId;
    if (!pending) return;
    try {
      await this.store.composition(this.id(), pending);
      if (this.store.fund()?.unitId === unit) { this.pending.set(null); await this.store.openKit(this.id()); this.notice.set('Změna určeného složení je uložená. Fyzická kontrola tím nevznikla.'); }
    } catch (error) { if (this.store.fund()?.unitId === unit) this.notice.set(errorMessage(error)); }
  }
  protected stockName(id: number): string { const stock = this.store.stocks().find((s) => s.id === id); return stock ? this.store.stockName(stock) : `Zásoba ${id}`; }
  protected operationSummary(input: CompositionInput): string {
    const action = input.action === 'add' ? 'Přidat do určeného složení' : input.action === 'remove' ? 'Odebrat z určeného složení' : 'Přesunout určené složení';
    const item = 'itemId' in input ? this.store.items().find((i) => i.id === input.itemId) : null;
    const subject = 'itemId' in input ? item ? this.store.itemName(item) : `Součástka ${input.itemId}` : this.stockName(input.bulkStockId);
    const counts = 'requiredQty' in input && input.requiredQty !== undefined ? ` · požadováno ${input.requiredQty}, evidováno ${input.presentQty}` : 'bulkStockId' in input ? ' · celý řádek včetně evidovaného počtu' : '';
    const target = input.action === 'move' ? this.targets().find((k) => k.id === input.targetKitId) : null;
    return `${action}: ${subject}${counts}${target ? ' → ' + this.store.kitName(target) : ''}${input.note ? ' · ' + input.note : ''}`;
  }
}

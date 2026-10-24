import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ItemCondition, ItemInput, ItemLocation, WorkOrder, WorkOrderStatus, WorkOrderType } from '@splk/api-contracts';
import { errorMessage } from '../../core/auth/error-messages';
import { InventoryStore } from './inventory.store';
import { InventoryOperationNotice } from '../inventury/inventory-operation-notice';
import { CONDITIONS, EVENT_LABELS, FIELD_LABELS, LOCATIONS, ORDER_STATES, ORDER_TYPES } from './inventory-labels';

@Component({ selector: 'app-item-page', imports: [ReactiveFormsModule, RouterLink, DatePipe, InventoryOperationNotice], templateUrl: './item-page.html' })
export class ItemPage {
  protected readonly store = inject(InventoryStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly params = toSignal(this.route.paramMap);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly id = computed(() => Number(this.params()?.get('id')) || null);
  private editVersion = 1;
  protected readonly notice = signal('');
  protected readonly editingOrder = signal<WorkOrder | null>(null);
  protected readonly reason = signal('');
  protected readonly confirmRetire = signal(false);
  protected readonly conditions = Object.entries(CONDITIONS);
  protected readonly locations = Object.entries(LOCATIONS);
  protected readonly conditionLabel = CONDITIONS;
  protected readonly locationLabel = LOCATIONS;
  protected readonly orderTypes = Object.entries(ORDER_TYPES);
  protected readonly orderStates = Object.entries(ORDER_STATES);
  protected readonly orderTypeLabel = ORDER_TYPES;
  protected readonly orderStateLabel = ORDER_STATES;
  protected readonly events = EVENT_LABELS;
  protected readonly fields = FIELD_LABELS;
  protected readonly partSeries = computed(() => this.store.series().filter((s) => s.kind === 'part' && (!s.archived || s.id === this.store.item()?.seriesId)));
  protected readonly form = this.fb.group({ seriesId: [0, Validators.min(1)], number: [''], variant: [''], size: [''], description: [''], note: [''],
    condition: ['ok' as ItemCondition], issuable: [true], location: ['unknown' as ItemLocation], locationNote: [''], acquiredOn: [''] });
  protected readonly orderForm = this.fb.group({ type: ['repair' as WorkOrderType], description: ['', Validators.required], assignee: [''], dueOn: [''] });

  constructor() {
    effect(() => {
      const id = this.id(), unit = this.store.fund()?.unitId;
      untracked(() => { this.notice.set(''); this.confirmRetire.set(false); this.reason.set(''); this.orderForm.reset(); this.editingOrder.set(null); this.form.reset(); if (id && unit) void this.store.openItem(id); else { this.store.closeDetail(); this.resetForm(); } });
    });
    effect(() => { const item = this.store.item(); if (item && item.id === this.id() && !this.form.dirty) untracked(() => this.resetForm()); });
  }

  protected async refresh(): Promise<void> { this.form.markAsPristine(); if (this.id()) await this.store.openItem(this.id()!); }

  protected resetForm(): void {
    const i = this.id() ? this.store.item() : null;
    this.editVersion = i?.version ?? 1;
    this.form.reset({ seriesId: i?.seriesId ?? (Number(this.route.snapshot.queryParamMap.get('series')) || 0), number: i?.number ?? '', variant: i?.variant ?? '', size: i?.size ?? '',
      description: i?.description ?? '', note: i?.note ?? '', condition: i?.condition ?? 'ok', issuable: i?.issuable ?? true,
      location: i?.location ?? 'unknown', locationNote: i?.locationNote ?? '', acquiredOn: i?.acquiredOn ?? '' });
  }
  protected async save(): Promise<void> {
    if (this.form.invalid) { this.notice.set('Vyberte evidenční řadu.'); return; }
    const unit = this.store.fund()?.unitId, v = this.form.getRawValue(), item = this.store.item();
    const input: ItemInput = { ...v, number: v.number || null, variant: v.variant || null, size: v.size || null, description: v.description || null,
      note: v.note || null, locationNote: v.locationNote || null, acquiredOn: v.acquiredOn || null };
    try {
      const saved = this.id() && item ? await this.store.updateItem(item.id, { ...input, version: this.editVersion }) : await this.store.createItem(input);
      if (this.store.fund()?.unitId !== unit) return;
      if (this.id()) { this.form.markAsPristine(); await this.store.openItem(saved.id); this.notice.set('Součástka je uložená.'); }
      else await this.router.navigate(['/soucastky/kusy', saved.id]);
    } catch (error) { if (this.store.fund()?.unitId === unit) this.notice.set(errorMessage(error)); }
  }
  protected async retire(): Promise<void> {
    const item = this.store.item(), unit = this.store.fund()?.unitId;
    if (!item || !this.confirmRetire() || !this.reason().trim()) return;
    try {
      await this.store.retireItem(item.id, item.version, this.reason());
      if (this.store.fund()?.unitId === unit) { await this.store.openItem(item.id); this.confirmRetire.set(false); this.notice.set('Součástka je vyřazená; historie zůstává zachovaná.'); }
    } catch (error) { if (this.store.fund()?.unitId === unit) this.notice.set(errorMessage(error)); }
  }
  protected async createOrder(): Promise<void> {
    const item = this.store.item(), unit = this.store.fund()?.unitId;
    if (!item || this.orderForm.invalid) return;
    const value = this.orderForm.getRawValue();
    try {
      const input = { ...value, assignee: value.assignee || null, dueOn: value.dueOn || null };
      const editing = this.editingOrder();
      if (editing) await this.store.updateOrder(editing.id, input); else await this.store.createOrder(item.id, input);
      if (this.store.fund()?.unitId === unit) { await this.store.openItem(item.id); this.orderForm.reset(); this.editingOrder.set(null); this.notice.set('Pracovní úkol je uložený. Stav a umístění kusu zůstávají podle evidence.'); }
    } catch (error) { if (this.store.fund()?.unitId === unit) this.notice.set(errorMessage(error)); }
  }
  protected editOrder(order: WorkOrder): void {
    this.editingOrder.set(order);
    this.orderForm.reset({ type: order.type, description: order.description, assignee: order.assignee ?? '', dueOn: order.dueOn ?? '' });
  }
  protected cancelOrder(): void { this.editingOrder.set(null); this.orderForm.reset(); }

  protected async changeOrder(order: WorkOrder, status: WorkOrderStatus): Promise<void> {
    const unit = this.store.fund()?.unitId;
    try { await this.store.updateOrder(order.id, { status }); if (this.store.fund()?.unitId === unit) await this.store.openItem(order.itemId); }
    catch (error) { if (this.store.fund()?.unitId === unit) this.notice.set(errorMessage(error)); }
  }
  protected orderStatus(value: unknown): string { return ORDER_STATES[value as WorkOrderStatus] ?? 'neuvedeno'; }

  protected eventValue(field: string, value: unknown): string {
    if (value === null || value === undefined || value === '') return 'neuvedeno';
    if (field === 'condition') return CONDITIONS[value as ItemCondition] ?? String(value);
    if (field === 'location') return LOCATIONS[value as ItemLocation] ?? String(value);
    if (field === 'issuable') return value ? 'vydatelný' : 'nevydatelný';
    if (field === 'seriesId') return this.store.seriesName(Number(value));
    return String(value);
  }
}

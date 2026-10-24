import { AttachmentGallery } from '../dokumenty/attachment-gallery';
import { DatePipe } from '@angular/common';
import { Component, computed, effect, ElementRef, inject, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type * as Inv from '@splk/api-contracts';
import { NumberInputError, parseInventoryNumbers } from '@splk/domain';
import { InventoriesStore } from './inventories.store';
import { InventoryProgressPanel } from './inventory-progress-panel';
import { InventoryCheckForm } from './inventory-check-form';
import { CHECK_RESULTS, ISSUE_LABELS, checkFeedback } from './inventory-feedback';
import { COMPOSITION_STATES, CONDITIONS, LOCATIONS, ORDER_STATES } from '../soucastky/inventory-labels';
import { errorMessage } from '../../core/auth/error-messages';

@Component({ selector: 'app-inventory-detail-page', imports: [AttachmentGallery, FormsModule, RouterLink, DatePipe, InventoryProgressPanel, InventoryCheckForm], templateUrl: './inventory-detail-page.html', styles: [`
  .toolbar,.mode-buttons,.actions {display:flex;flex-wrap:wrap;gap:.6rem;align-items:center}.number-grid {display:grid;grid-template-columns:repeat(auto-fill,minmax(8rem,1fr));gap:.5rem;margin:1rem 0}
  :host {display:block;min-width:0;overflow-wrap:anywhere}.number-grid button {text-align:left;white-space:normal;overflow-wrap:anywhere;padding:.65rem;min-height:4rem}.number-grid small {display:block}.verified {border-left:5px solid #297d4d}.unresolved {border-left:5px solid #a45c24}
  .entry-list {display:grid;gap:.8rem;padding-left:1.3rem}.entry-list li {overflow-wrap:anywhere} label {display:grid;gap:.3rem;max-width:35rem} label:has(input[type=checkbox]) {display:block}
  fieldset {display:grid;gap:.8rem;min-width:0} input,select,textarea {max-width:100%;min-width:0} .columns {display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,19rem),1fr));gap:1rem}.card {min-width:0}
`] })
export class InventoryDetailPage {
  readonly store = inject(InventoriesStore);
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap);
  private readonly quickField = viewChild<ElementRef<HTMLInputElement>>('quickField');
  readonly id = computed(() => Number(this.params()?.get('id')) || null);
  readonly resultLabels = CHECK_RESULTS; readonly issueLabels = ISSUE_LABELS; readonly compositionLabels = COMPOSITION_STATES;
  readonly conditions = CONDITIONS; readonly locations = LOCATIONS; readonly orderStates = ORDER_STATES;
  mode: Inv.InventoryMode = 'store'; holder = ''; kitId = 0; seriesId = 0; targetId = 0; quick = ''; message = '';
  outcomes: { label: string; outcome: Inv.InventoryCheckOutcome }[] = [];
  addKind: 'item' | 'kit' | 'bulk' = 'item'; addId = 0; addNote = '';
  slotId = 0; editingSlotId = 0; startsAt = ''; endsAt = ''; capacity = 3;
  private slotVersion: number | undefined;
  closedWithIssues = false; closeReason = '';
  constructor() { effect(() => {
    const id = this.id(), unit = this.store.fund()?.unitId;
    untracked(() => { this.mode = 'store'; this.holder = ''; this.kitId = this.seriesId = this.targetId = 0; this.quick = this.message = ''; this.outcomes = []; this.addId = 0; this.addNote = ''; this.editingSlotId = this.slotId = 0; this.startsAt = this.endsAt = ''; this.closedWithIssues = false; this.closeReason = '';
      if (id && unit) void this.store.open(id); else this.store.closeDetail(); });
  }); }
  chooseMode(mode: Inv.InventoryMode): void { this.mode = mode; this.targetId = 0; this.outcomes = []; this.message = ''; }
  chooseKit(): void { this.targetId = 0; this.outcomes = []; void this.store.loadKit(this.kitId); }
  selectTarget(id: number): void { this.targetId = id; }
  target(): Inv.InventoryTarget | null { return this.store.targets().find((t) => t.id === this.targetId) ?? null; }
  holderChoices(): { key: string; label: string }[] {
    const holders = new Map<string, string>();
    for (const t of this.store.targets()) {
      if (t.holderPersonId !== null) holders.set(`person:${t.holderPersonId}`, this.store.personName(t.holderPersonId));
      if (t.holderUnitId !== null) holders.set(`unit:${t.holderUnitId}`, this.store.holderLabel(t) + ' · složka');
    }
    return [...holders].map(([key, label]) => ({ key, label })).sort((a, b) => a.label.localeCompare(b.label, 'cs'));
  }
  kitChoices(): { id: number; label: string }[] {
    const ids = new Set<number>();
    for (const t of this.store.targets()) { if (t.kitId !== null) ids.add(t.kitId); if (t.contextKitId !== null) ids.add(t.contextKitId); if (typeof t.snapshot['kitId'] === 'number') ids.add(t.snapshot['kitId']); }
    for (const c of this.store.checks()) if (!c.cancelledAt && c.context.kitId) ids.add(c.context.kitId);
    return [...ids].map((id) => ({ id, label: this.kitName(id) }));
  }
  kitName(id: number): string { const target = this.store.targets().find((t) => t.kitId === id), kit = this.store.kits().find((k) => k.id === id); return target ? this.store.targetLabel(target) : kit ? `${this.seriesName(kit.seriesId)} ${kit.number ?? '(bez čísla)'}` : `Komplet #${id}`; }
  seriesName(id: number): string { return this.store.series().find((s) => s.id === id)?.name ?? `Řada #${id}`; }
  stockName(id: number): string { const stock = this.store.stocks().find((s) => s.id === id); return stock ? `${this.store.types().find((t) => t.id === stock.partTypeId)?.name ?? 'Zásoba'} ${stock.variant ?? ''}`.trim() : `Zásoba #${id}`; }
  targetName(id: number): string { const target = this.store.targets().find((t) => t.id === id); return target ? this.store.targetLabel(target) : `Cíl #${id}`; }
  movementLabel(type: Inv.LoanMovement['type']): string { return { issued: 'Výdej', paper_migration: 'Převzato z papíru', returned: 'Vrácení', exchanged: 'Výměna', settled: 'Vypořádání ztrátou' }[type]; }
  visibleTargets(): Inv.InventoryTarget[] {
    return this.store.targets().filter((t) => {
      if (this.mode === 'people') return this.holder === `person:${t.holderPersonId}` && t.holderPersonId !== null || this.holder === `unit:${t.holderUnitId}` && t.holderUnitId !== null;
      if (this.mode === 'kit') return this.kitId !== 0 && (t.kitId === this.kitId || t.contextKitId === this.kitId || t.snapshot['kitId'] === this.kitId || this.store.items().find((i) => i.id === t.itemId)?.kitId === this.kitId || this.store.checks().some((c) => c.targetId === t.id && !c.cancelledAt && c.context.kitId === this.kitId));
      if (this.seriesId && this.currentSeries(t) !== this.seriesId) return false;
      if (t.bulkStockId !== null) return t.contextKitId === null && t.loanLineId === null && !this.seriesId;
      if (t.itemId !== null) { const item = this.store.items().find((i) => i.id === t.itemId); return item ? item.loanId === null : t.holderPersonId === null && t.holderUnitId === null; }
      return !this.store.kits().find((k) => k.id === t.kitId)?.loanId;
    });
  }
  private currentSeries(t: Inv.InventoryTarget): number | null { return t.itemId !== null ? this.store.items().find((i) => i.id === t.itemId)?.seriesId ?? Number(t.snapshot['seriesId']) : t.kitId !== null ? this.store.kits().find((k) => k.id === t.kitId)?.seriesId ?? Number(t.snapshot['seriesId']) : null; }
  targetGroups(): { key: string; label: string; targets: Inv.InventoryTarget[] }[] {
    const groups = new Map<string, { key: string; label: string; targets: Inv.InventoryTarget[] }>();
    for (const target of this.visibleTargets()) {
      const series = this.currentSeries(target), key = this.mode !== 'store' ? 'selection' : target.bulkStockId !== null ? 'bulk' : `${target.kitId !== null ? 'kit' : 'part'}:${series}`;
      const label = this.mode !== 'store' ? 'Součástky ve výběru' : target.bulkStockId !== null ? 'Nečíslované zásoby' : `${target.kitId !== null ? 'Komplety · ' : ''}${this.seriesName(series!)}`;
      const group = groups.get(key) ?? { key, label, targets: [] }; group.targets.push(target); groups.set(key, group);
    }
    return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label, 'cs'));
  }
  currentLabel(t: Inv.InventoryTarget): string {
    const item = this.store.items().find((i) => i.id === t.itemId);
    return item && (item.number !== t.snapshot['number'] || item.seriesId !== t.snapshot['seriesId']) ? `Nyní: ${this.seriesName(item.seriesId)} ${item.number ?? '(bez čísla)'}` : '';
  }
  verified(t: Inv.InventoryTarget): boolean { return t.bulkStockId === null && this.store.checks().some((c) => c.targetId === t.id && !c.cancelledAt && ['found', 'presented'].includes(c.result)); }
  latest(t: Inv.InventoryTarget): Inv.InventoryCheck | undefined { return this.store.checks().filter((c) => c.targetId === t.id && !c.cancelledAt).at(-1); }
  status(t: Inv.InventoryTarget): string { const last = this.latest(t); return t.bulkStockId !== null ? last ? `${CHECK_RESULTS[last.result]} · zjištěno ${last.checkedQty ?? 'nezapsáno'}, evidováno ${last.context.expectedQty ?? t.expectedQty} při kontrole` : 'Počet zatím nezapsán' : this.verified(t) ? 'Fyzicky ověřeno' : 'Zatím fyzicky neověřeno'; }
  targetIssues(t: Inv.InventoryTarget): Inv.InventoryIssue[] { return this.store.detail()?.progress.issues.filter((i) => i.targetId === t.id) ?? []; }
  loanId(t: Inv.InventoryTarget): number | null {
    if (t.itemId !== null) return this.store.items().find((i) => i.id === t.itemId)?.loanId ?? null;
    if (t.kitId !== null) return this.store.kits().find((k) => k.id === t.kitId)?.loanId ?? null;
    return this.store.loans().find((l) => l.lines.some((line) => line.id === t.loanLineId && !line.closedAt))?.id ?? null;
  }
  personId(): number | null { const [kind, id] = this.holder.split(':'); return kind === 'person' && Number(id) > 0 ? Number(id) : null; }
  activeVisit(): Inv.InventoryVisit | undefined { return this.store.visits().find((v) => v.personId === this.personId() && ['booked', 'in_progress'].includes(v.status)); }
  occupancy(slot: number): number { return this.store.visits().filter((v) => v.slotId === slot && v.status !== 'cancelled').length; }
  visitLabel(status: Inv.InventoryVisit['status']): string { return { booked: 'objednáno', in_progress: 'probíhá', completed: 'dokončeno', cancelled: 'zrušeno' }[status]; }
  checkHistory(): Inv.InventoryCheck[] { const ids = new Set(this.visibleTargets().map((t) => t.id)); return [...this.store.checks()].filter((c) => ids.has(c.targetId)).reverse(); }
  outcomeMessage(outcome: Inv.InventoryCheckOutcome): string { return checkFeedback(outcome.code); }
  contextHolder(context?: Inv.InventoryCheck['context']): string { const h = context?.holder; return h ? 'personId' in h ? this.store.personName(h.personId!) : this.store.units().find((u) => u.id === h.unitId)?.name ?? `Složka #${h.unitId}` : ''; }
  saved(response: Inv.InventoryCheckResponse): void { this.outcomes = response.results.map((outcome) => ({ label: this.store.targets().find((t) => t.id === outcome.targetId)?.snapshot['label'] as string ?? 'Kontrola', outcome })); }
  async quickCheck(): Promise<void> {
    if (!this.seriesId || !this.quick.trim()) return;
    const id = this.id(), unit = this.store.fund()?.unitId;
    try {
      const numbers = parseInventoryNumbers(this.quick), response = await this.store.check({ mode: 'store', entries: numbers.map((number) => ({ seriesId: this.seriesId, number, result: 'found' })) });
      if (this.id() !== id || this.store.fund()?.unitId !== unit) return;
      this.outcomes = response.results.map((outcome, i) => ({ label: numbers[i], outcome })); this.quick = ''; this.message = ''; this.quickField()?.nativeElement.focus();
    } catch (e) { if (this.id() === id && this.store.fund()?.unitId === unit) this.message = e instanceof NumberInputError ? 'Zkontrolujte čísla a rozsahy. Dávka smí obsahovat nejvýše 200 položek, u rozsahů zachovejte stejné doplnění nul.' : errorMessage(e); }
  }
  async refresh(): Promise<void> { const id = this.id(); if (!id || this.store.busy()) return; await this.store.reload(); if (this.id() === id) await this.store.open(id); if (this.mode === 'kit' && this.kitId) await this.store.loadKit(this.kitId); }
  async addTarget(): Promise<void> {
    if (!this.addId || !this.addNote.trim()) return;
    const input: Inv.InventoryTargetSelection = this.addKind === 'item' ? { itemId: this.addId, note: this.addNote } : this.addKind === 'kit' ? { kitId: this.addId, note: this.addNote } : { bulkStockId: this.addId, ...(this.mode === 'kit' && this.kitId ? { contextKitId: this.kitId } : {}), note: this.addNote };
    await this.run(async () => { await this.store.addTarget(input); });
  }
  async startVisit(status: 'booked' | 'in_progress'): Promise<void> { const personId = this.personId(); if (personId) await this.run(async () => { await this.store.createVisit({ personId, status, slotId: this.slotId || null }); }); }
  async visitStatus(visit: Inv.InventoryVisit, status: Inv.InventoryVisit['status']): Promise<void> { await this.run(async () => { await this.store.updateVisit(visit.id, { status }); }); }
  editSlot(slot: Inv.InventorySlot): void { this.editingSlotId = slot.id; this.slotVersion = this.store.detail()?.version; this.startsAt = localTime(slot.startsAt); this.endsAt = localTime(slot.endsAt); this.capacity = slot.capacity; }
  async saveSlot(): Promise<void> {
    const start = new Date(this.startsAt), end = new Date(this.endsAt);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start || !Number.isInteger(this.capacity) || this.capacity < 1 || this.capacity > 2147483647) { this.message = 'Zadejte platný začátek a pozdější konec termínu a kladnou celou kapacitu.'; return; }
    await this.run(async () => {
      const input = { startsAt: start.toISOString(), endsAt: end.toISOString(), capacity: this.capacity };
      const response = this.editingSlotId ? await this.store.updateSlot(this.editingSlotId, input, this.slotVersion) : await this.store.createSlot(input);
      if (this.id() === response.id && this.store.fund()?.unitId === response.inventory.unitId) { this.editingSlotId = response.slot.id; this.slotVersion = response.inventory.version; }
    });
  }
  async cancel(id: number): Promise<void> { await this.run(async () => { await this.store.cancel(id); }); }
  async close(): Promise<void> { await this.run(async () => { await this.store.close({ closedWithIssues: this.closedWithIssues, ...(this.closedWithIssues ? { reason: this.closeReason } : {}) }); }); }
  private async run(work: () => Promise<void>): Promise<void> { const id = this.id(), unit = this.store.fund()?.unitId; try { await work(); if (this.id() === id && this.store.fund()?.unitId === unit) this.message = 'Změna je uložená.'; } catch (e) { if (this.id() === id && this.store.fund()?.unitId === unit) this.message = errorMessage(e); } }
}
function localTime(iso: string): string { const date = new Date(iso); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }

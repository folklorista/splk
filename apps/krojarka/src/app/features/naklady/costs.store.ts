import { computed, DestroyRef, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import type * as C from '@splk/api-contracts';
import { AuthService } from '../../core/auth/auth.service';
import { errorMessage } from '../../core/auth/error-messages';
import { ApiError } from '../../data/api-error';
import { CostsApi } from '../../data/costs/costs-api';
import { InventoryApi } from '../../data/inventory/inventory-api';
import { CatalogApi } from '../../data/catalog/catalog-api';

export interface CostTargetOption { kind: C.CostTargetKind; targetId: number; label: string }
@Injectable()
export class CostsStore {
  private readonly api = inject(CostsApi);
  private readonly inventory = inject(InventoryApi);
  private readonly catalog = inject(CatalogApi);
  private readonly auth = inject(AuthService);
  readonly funds = signal<C.CostFund[]>([]);
  readonly query = signal<C.CostQuery>({});
  readonly rows = signal<C.CostumeCost[]>([]);
  readonly total = signal(0);
  readonly totals = signal<C.CostTotal[]>([]);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly editor = signal<{ unit: number; cost: C.CostumeCost | null } | null>(null);
  readonly detail = signal<C.CostumeCost | null>(null);
  readonly targets = signal<CostTargetOption[]>([]);
  readonly targetsLoading = signal(false);
  readonly canCreate = computed(() => this.funds().some((f) => f.unitId === this.query().unitId && f.canManage));
  private destroyed = false;
  private readonly urls = new Set<string>();
  private scope = '{}';
  private generation = 0;
  private listRequest = 0;
  private editorRequest = 0;
  private user: object | null = null;
  constructor() {
    inject(DestroyRef).onDestroy(() => { this.destroyed = true; this.generation++; this.listRequest++; this.close(); this.rows.set([]); this.funds.set([]); this.total.set(0); this.totals.set([]); this.loading.set(false); this.busy.set(false); for (const url of this.urls) URL.revokeObjectURL(url); this.urls.clear(); });
    effect(() => { const user = this.auth.user(); untracked(() => { this.user = user; this.generation++; this.listRequest++; this.close(); this.funds.set([]); this.rows.set([]); this.total.set(0); this.totals.set([]); this.error.set(''); this.busy.set(false); if (user) void this.loadFunds(); }); });
    effect(() => { this.query(); untracked(() => { this.scope = JSON.stringify(this.query()); this.generation++; this.close(); this.busy.set(false); this.rows.set([]); this.total.set(0); this.totals.set([]); this.error.set(''); this.notice.set(''); if (this.funds().length) void this.load(); }); });
  }
  private current(generation: number) { return !this.destroyed && this.generation === generation && this.auth.user() === this.user && JSON.stringify(this.query()) === this.scope; }
  async loadFunds(): Promise<void> {
    const user = this.auth.user(); this.loading.set(true);
    try { const funds = await firstValueFrom(this.api.funds()); if (!this.destroyed && this.auth.user() === user && user) { this.funds.set(funds); await this.load(); } }
    catch (error) { if (!this.destroyed && this.auth.user() === user) this.error.set(errorMessage(error)); }
    finally { if (!this.destroyed && this.auth.user() === user) this.loading.set(false); }
  }
  async load(): Promise<void> {
    const generation = this.generation, request = ++this.listRequest, query = { ...this.query(), limit: 50, offset: this.query().offset ?? 0 }; this.loading.set(true); this.error.set('');
    try { const page = await firstValueFrom(this.api.list(query)); if (this.current(generation) && request === this.listRequest) {
      if (page.items.some((c) => !this.funds().some((f) => f.unitId === c.unitId) || query.unitId && c.unitId !== query.unitId)) throw new ApiError(404, 'not_found');
      const lastOffset = Math.max(0, Math.floor((page.total - 1) / 50) * 50);
      if (query.offset > lastOffset) { this.query.update((q) => ({ ...q, offset: lastOffset })); return; }
      if (!page.items.length && query.offset < page.total) throw new ApiError(500, 'internal_error');
      this.rows.set(page.items); this.total.set(page.total); this.totals.set(page.totals);
    } } catch (error) { if (this.current(generation) && request === this.listRequest) this.error.set(errorMessage(error)); }
    finally { if (this.current(generation) && request === this.listRequest) this.loading.set(false); }
  }
  canEdit(cost: C.CostumeCost): boolean { return this.funds().some((f) => f.unitId === cost.unitId && f.canManage); }
  fundName(id: number): string { return this.funds().find((f) => f.unitId === id)?.name ?? ''; }
  close(): void { this.editorRequest++; this.editor.set(null); this.detail.set(null); this.targets.set([]); this.targetsLoading.set(false); }
  async open(row?: C.CostumeCost): Promise<void> {
    const generation = this.generation, request = ++this.editorRequest, unit = row?.unitId ?? this.query().unitId; if (!unit) return;
    this.editor.set(null); this.detail.set(null); this.targets.set([]); this.error.set('');
    try {
      const cost = row ? await firstValueFrom(this.api.detail(row.id)) : null;
      if (!this.current(generation) || request !== this.editorRequest) return;
      if (cost && (cost.unitId !== unit || !this.funds().some((f) => f.unitId === cost.unitId))) throw new ApiError(404, 'not_found');
      if (cost) this.detail.set(cost);
      if (!this.funds().some((f) => f.unitId === unit && f.canManage)) return;
      this.editor.set({ unit, cost }); await this.loadTargets(unit, generation, request);
    } catch (error) { if (this.current(generation) && request === this.editorRequest) this.error.set(errorMessage(error)); }
  }
  private async loadTargets(unit: number, generation: number, request: number): Promise<void> {
    this.targetsLoading.set(true);
    try {
      const [series, types, active, retired, stocks, kits] = await Promise.all([firstValueFrom(this.catalog.series(unit)), firstValueFrom(this.catalog.partTypes(unit)), this.all((offset) => this.inventory.items(unit, { offset, limit: 200 })), this.all((offset) => this.inventory.items(unit, { offset, limit: 200, retired: true })), this.all((offset) => this.inventory.stocks(unit, { offset, limit: 200 })), this.all((offset) => this.inventory.kits(unit, { offset, limit: 200 }))]);
      const targets: CostTargetOption[] = [...active, ...retired].map((i) => ({ kind: 'item', targetId: i.id, label: `${series.find((s) => s.id === i.seriesId)?.name ?? 'Řada'} ${i.number ?? '(bez čísla)'}${i.retiredAt ? ' · vyřazeno' : ''}` }));
      targets.push(...stocks.map((s): CostTargetOption => ({ kind: 'bulk_stock', targetId: s.id, label: `${types.find((t) => t.id === s.partTypeId)?.name ?? 'Zásoba'} ${s.variant ?? ''}`.trim() })), ...kits.map((k): CostTargetOption => ({ kind: 'kit', targetId: k.id, label: `Komplet · ${series.find((s) => s.id === k.seriesId)?.name ?? 'Řada'} ${k.number ?? '(bez čísla)'}` })));
      if (this.current(generation) && request === this.editorRequest) this.targets.set(targets.sort((a, b) => a.label.localeCompare(b.label, 'cs')));
    } catch (error) { if (this.current(generation) && request === this.editorRequest) this.error.set(errorMessage(error)); }
    finally { if (this.current(generation) && request === this.editorRequest) this.targetsLoading.set(false); }
  }
  async save(input: C.CostInput): Promise<boolean> {
    const editor = this.editor(), generation = this.generation, editorRequest = this.editorRequest; if (!editor || this.busy() || !this.funds().some((f) => f.unitId === editor.unit && f.canManage)) return false;
    this.busy.set(true); this.error.set(''); this.notice.set('');
    try {
      const request = editor.cost ? this.api.update(editor.cost.id, { ...input, version: editor.cost.version }) : this.api.create(editor.unit, input);
      await firstValueFrom(request); if (!this.current(generation) || editorRequest !== this.editorRequest) return false;
      this.close(); await this.load(); if (this.current(generation)) this.notice.set('Náklad je uložený. Evidence součástek ani jejich fyzické počty se nezměnily.'); return this.current(generation);
    } catch (error) { if (this.current(generation) && editorRequest === this.editorRequest) this.error.set(errorMessage(error)); return false; }
    finally { if (this.current(generation)) this.busy.set(false); }
  }
  async csv(): Promise<void> {
    if (this.busy()) return; const generation = this.generation, query = { ...this.query() }; delete query.limit; delete query.offset;
    this.busy.set(true); this.error.set('');
    try { const blob = await firstValueFrom(this.api.csv(query)); if (!this.current(generation)) return;
      const url = URL.createObjectURL(blob), anchor = document.createElement('a'); this.urls.add(url); anchor.href = url; anchor.download = 'naklady.csv'; anchor.click(); setTimeout(() => { if (this.urls.delete(url)) URL.revokeObjectURL(url); }, 60_000);
    } catch (error) { if (this.current(generation)) this.error.set(errorMessage(error)); }
    finally { if (this.current(generation)) this.busy.set(false); }
  }
  private async all<T>(read: (offset: number) => Observable<C.Page<T>>): Promise<T[]> { const rows: T[] = []; for (;;) { const page = await firstValueFrom(read(rows.length)); if (!page.items.length && rows.length < page.total) throw new ApiError(500, 'internal_error'); rows.push(...page.items); if (rows.length >= page.total) return rows; } }
}

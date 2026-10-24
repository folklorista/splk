import { effect, inject, Injectable, signal, untracked } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import type { CostumeReport, Page, ReportKind, ReportQuery } from '@splk/api-contracts';
import { FundContext } from '../../core/fund/fund-context';
import { errorMessage } from '../../core/auth/error-messages';
import { ApiError } from '../../data/api-error';
import { ReportsApi } from '../../data/reports/reports-api';
import { CatalogApi } from '../../data/catalog/catalog-api';
import { PeopleApi } from '../../data/people/people-api';
import { InventoryApi } from '../../data/inventory/inventory-api';

@Injectable()
export class ReportsStore {
  readonly fund = inject(FundContext).current;
  private readonly api = inject(ReportsApi);
  private readonly catalog = inject(CatalogApi);
  private readonly people = inject(PeopleApi);
  private readonly inventory = inject(InventoryApi);
  readonly kind = signal<ReportKind>('items');
  readonly choices = signal<{ id: number; label: string; kind?: 'part' | 'kit' }[]>([]);
  readonly result = signal<CostumeReport | null>(null);
  readonly loading = signal(false);
  readonly exporting = signal(false);
  readonly error = signal('');
  private request = 0;
  private loaded: { unit: number; kind: ReportKind; id?: number; query: ReportQuery } | null = null;
  constructor() { effect(() => { const fund = this.fund(), kind = this.kind(); untracked(() => { this.clear(); this.choices.set([]); if (fund) void this.loadChoices(fund.unitId, kind); }); }); }
  clear(): void { this.request++; this.result.set(null); this.loaded = null; this.error.set(''); this.loading.set(false); this.exporting.set(false); }
  private current(unit: number, kind: ReportKind, request: number) { return this.fund()?.unitId === unit && this.kind() === kind && request === this.request; }
  private async loadChoices(unit: number, kind: ReportKind): Promise<void> {
    const request = this.request; this.loading.set(true);
    try {
      let rows: { id: number; label: string; kind?: 'part' | 'kit' }[] = [];
      if (kind === 'person') rows = (await this.all((offset) => this.people.people({ fund: unit, offset, limit: 200 }))).map((p) => ({ id: p.id, label: `${p.firstName} ${p.lastName} ${p.nickname ?? ''}`.trim() }));
      if (['series', 'item', 'kit'].includes(kind)) {
        const series = await firstValueFrom(this.catalog.series(unit));
        if (kind === 'series') rows = series.map((s) => ({ id: s.id, label: s.name, kind: s.kind }));
        else {
          const entries = kind === 'item' ? [...await this.all((offset) => this.inventory.items(unit, { offset, limit: 200 })), ...await this.all((offset) => this.inventory.items(unit, { offset, limit: 200, retired: true }))] : await this.all((offset) => this.inventory.kits(unit, { offset, limit: 200 }));
          rows = entries.map((i) => ({ id: i.id, label: `${series.find((s) => s.id === i.seriesId)?.name ?? 'Řada'} ${i.number ?? '(bez čísla)'}${i.retiredAt ? ' · vyřazeno' : ''}` }));
        }
      }
      if (kind === 'inventory') rows = (await this.all((offset) => this.inventory.inventories(unit, { offset, limit: 200 }))).map((i) => ({ id: i.id, label: `${i.name} · ${i.status === 'closed' ? 'uzavřeno' : 'probíhá'}` }));
      if (this.current(unit, kind, request)) this.choices.set(rows.sort((a, b) => a.label.localeCompare(b.label, 'cs')));
    } catch (error) { if (this.current(unit, kind, request)) this.error.set(errorMessage(error)); }
    finally { if (this.current(unit, kind, request)) this.loading.set(false); }
  }
  async load(id?: number, query: ReportQuery = {}): Promise<void> {
    const unit = this.fund()?.unitId, kind = this.kind(), request = ++this.request; if (!unit) return;
    this.result.set(null); this.loaded = null; this.loading.set(true); this.error.set('');
    if (['series', 'person', 'item', 'kit', 'inventory'].includes(kind) && (!id || !this.choices().some((c) => c.id === id))) { this.loading.set(false); this.error.set('Vyberte položku ze seznamu.'); return; }
    const captured = structuredClone(query);
    try { const report = await firstValueFrom(this.api.report(unit, kind, id, captured)); if (this.current(unit, kind, request)) { if (report.unitId !== unit) throw new ApiError(404, 'not_found'); this.result.set(report); this.loaded = { unit, kind, id, query: captured }; } }
    catch (error) { if (this.current(unit, kind, request)) this.error.set(errorMessage(error)); }
    finally { if (this.current(unit, kind, request)) this.loading.set(false); }
  }
  async csv(): Promise<void> {
    const loaded = this.loaded, request = this.request; if (!loaded || this.exporting()) return;
    this.exporting.set(true); this.error.set('');
    try { const blob = await firstValueFrom(this.api.csv(loaded.unit, loaded.kind, loaded.id, loaded.query)); if (!this.current(loaded.unit, loaded.kind, request)) return;
      const url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = 'soupis.csv'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) { if (this.current(loaded.unit, loaded.kind, request)) this.error.set(errorMessage(error)); }
    finally { if (this.current(loaded.unit, loaded.kind, request)) this.exporting.set(false); }
  }
  print(): void { if (this.result() && !this.loading()) window.print(); }
  private async all<T>(read: (offset: number) => Observable<Page<T>>): Promise<T[]> { const rows: T[] = []; for (;;) { const page = await firstValueFrom(read(rows.length)); if (!page.items.length && rows.length < page.total) throw new ApiError(500, 'internal_error'); rows.push(...page.items); if (rows.length >= page.total) return rows; } }
}

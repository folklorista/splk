import { inject, Injectable } from '@angular/core';
import { defer, firstValueFrom, from, Observable } from 'rxjs';
import type * as C from '@splk/api-contracts';
import { normalizeCostAmount, sumCostAmounts, reportCsv } from '@splk/domain';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../api-error';
import { CatalogApi } from '../catalog/catalog-api';
import { InventoryApi } from '../inventory/inventory-api';
import { OrganizationApi } from '../organization/organization-api';
import { CostsApi } from './costs-api';

@Injectable()
export class MockCostsApi extends CostsApi {
  private readonly auth = inject(AuthService);
  private readonly inventory = inject(InventoryApi);
  private readonly catalog = inject(CatalogApi);
  private readonly organization = inject(OrganizationApi);
  private rows: C.CostumeCost[] = [];
  private nextId = 1;
  private queue: Promise<unknown> = Promise.resolve();
  funds() { return this.run(async (): Promise<C.CostFund[]> => {
    const units = (await this.units()).filter((u) => (u.hasCostumeFund || this.rows.some((c) => c.unitId === u.id)) && this.readable(u.id));
    if (!units.length && !this.readable(0)) throw new ApiError(403, 'forbidden');
    return units.map((u) => ({ unitId: u.id, name: u.name, archived: u.archived, canManage: !u.archived && u.hasCostumeFund && (this.auth.user()?.mandates ?? []).some((m) => m.kind === 'costumes.manage' && m.scopeType === 'unit' && m.scopeId === u.id) }));
  }); }
  list(query: C.CostQuery = {}) { return this.run(async () => this.page(await this.filtered(query), query)); }
  detail(id: number) { return this.run(async () => { const row = await this.accessible(id); return this.currentObjects(row); }); }
  create(unit: number, input: C.CostInput) { return this.run(async () => {
    await this.access(unit, true); this.only(input, ['spentOn', 'amount', 'currency', 'description', 'supplier', 'documentRef', 'purpose', 'links']);
    const value = this.values(input), links = await this.links(unit, input.links === undefined ? [] : input.links), actor = this.actor(), at = new Date().toISOString();
    const row: C.CostumeCost = { ...value, id: this.nextId++, unitId: unit, links, createdAt: at, createdBy: actor, updatedAt: at, updatedBy: actor, version: 1 };
    this.rows.push(row); return row;
  }); }
  update(id: number, input: C.CostPatch) { return this.run(async () => {
    const row = await this.accessible(id); await this.access(row.unitId, true); this.only(input, ['version', 'spentOn', 'amount', 'currency', 'description', 'supplier', 'documentRef', 'purpose', 'links']);
    if (!Number.isInteger(input.version) || input.version < 1) throw invalid('version'); if (row.version !== input.version) throw new ApiError(409, 'version_conflict');
    const value = this.values({ ...row, ...input }), links = input.links === undefined ? row.links : await this.links(row.unitId, input.links);
    Object.assign(row, value, { links, updatedAt: new Date().toISOString(), updatedBy: this.actor(), version: row.version + 1 }); return this.currentObjects(row);
  }); }
  csv(query: C.CostQuery = {}) { return this.run(async () => {
    const rows = await this.filtered(query), totals = this.totals(rows);
    return new Blob([reportCsv({ unitId: query.unitId ?? 0, title: 'Náklady na kroje', generatedAt: new Date().toISOString(), notice: 'Evidence nákladů; souhrny po měnách bez přepočtu.', sections: [
      { title: 'Náklady a dobropisy', columns: ['ID', 'Fond ID', 'Datum', 'Částka', 'Měna', 'Dodavatel', 'Doklad', 'Popis', 'Účel', 'Navázané součástky'], rows: rows.map((c) => [c.id, c.unitId, c.spentOn, c.amount, c.currency, c.supplier, c.documentRef, c.description, c.purpose, c.links.map((l) => `${l.object.label} × ${l.qty}`).join(' · ')]) },
      { title: 'Souhrny po měnách', columns: ['Měna', 'Částka', 'Počet záznamů'], rows: totals.map((t) => [t.currency, t.amount, t.count]) },
    ] })], { type: 'text/csv;charset=utf-8' });
  }); }
  private async units() { return firstValueFrom(this.organization.units()); }
  private readable(unit: number) { return (this.auth.user()?.mandates ?? []).some((m) => m.kind === 'costs.view' && m.scopeType === 'organization' || ['costumes.manage', 'costumes.view'].includes(m.kind) && (m.scopeType === 'organization' && m.kind === 'costumes.view' || m.scopeType === 'unit' && m.scopeId === unit)); }
  private async access(unit: number, write: boolean) {
    const found = (await this.units()).find((u) => u.id === unit && (u.hasCostumeFund || this.rows.some((c) => c.unitId === unit)));
    if (!found || !this.readable(unit)) throw new ApiError(404, 'not_found');
    if (write) {
      if (!found.hasCostumeFund || found.archived) throw new ApiError(404, 'not_found');
      if (!(this.auth.user()?.mandates ?? []).some((m) => m.kind === 'costumes.manage' && m.scopeType === 'unit' && m.scopeId === unit)) throw new ApiError(403, 'forbidden');
    }
  }
  private actor() { const id = this.auth.user()?.account.id; if (!id) throw new ApiError(401, 'unauthenticated'); return id; }
  private async accessible(id: number) { const row = this.rows.find((c) => c.id === id); if (!row) throw new ApiError(404, 'not_found'); await this.access(row.unitId, false); return row; }
  private values(input: C.CostInput): Omit<C.CostumeCost, 'id' | 'unitId' | 'links' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy' | 'version'> {
    let amount: string; try { amount = normalizeCostAmount(input.amount); } catch { throw invalid('amount'); }
    if (!validDate(input.spentOn)) throw invalid('spentOn'); if (typeof input.currency !== 'string' || input.currency.length !== 3 || !/^[A-Z]{3}$/u.test(input.currency)) throw invalid('currency');
    if (typeof input.description !== 'string' || !input.description.trim() || input.description.trim().length > 2000) throw invalid('description');
    const text = (value: string | null | undefined, field: string, max: number): string | null => { if (value !== undefined && value !== null && (typeof value !== 'string' || value.length > max)) throw invalid(field); return value?.trim() || null; };
    return { spentOn: input.spentOn, amount, currency: input.currency, description: input.description.trim(), supplier: text(input.supplier, 'supplier', 500), documentRef: text(input.documentRef, 'documentRef', 500), purpose: text(input.purpose, 'purpose', 1000) };
  }
  private async links(unit: number, entries: C.CostLinkInput[]): Promise<C.CostLink[]> {
    if (!Array.isArray(entries) || entries.length > 200) throw invalid('links'); const seen = new Set<string>(), links: C.CostLink[] = [];
    for (const entry of entries) {
      this.only(entry, ['kind', 'targetId', 'qty']); if (!['item', 'bulk_stock', 'kit'].includes(entry.kind) || !Number.isSafeInteger(entry.targetId) || entry.targetId < 1 || !Number.isInteger(entry.qty) || entry.qty < 1 || entry.qty > 2147483647 || entry.kind !== 'bulk_stock' && entry.qty !== 1 || seen.has(`${entry.kind}:${entry.targetId}`)) throw invalid('links');
      seen.add(`${entry.kind}:${entry.targetId}`); links.push({ ...entry, id: this.nextId++, object: await this.object(unit, entry) });
    }
    return links.sort((a, b) => a.kind.localeCompare(b.kind) || a.targetId - b.targetId);
  }
  private async object(unit: number, link: C.CostLinkInput): Promise<C.CostLinkedObject> {
    if (link.kind === 'bulk_stock') {
      const stocks = await this.all((offset) => this.inventory.stocks(unit, { offset, limit: 200 })); const stock = stocks.find((s) => s.id === link.targetId); if (!stock) throw new ApiError(404, 'not_found');
      const types = await firstValueFrom(this.catalog.partTypes(unit)); return { id: stock.id, label: `${types.find((t) => t.id === stock.partTypeId)?.name ?? 'Zásoba'} ${stock.variant ?? ''}`.trim(), number: null, description: null, variant: stock.variant, quantityTotal: stock.quantityTotal };
    }
    const series = await firstValueFrom(this.catalog.series(unit));
    if (link.kind === 'item') { const i = await firstValueFrom(this.inventory.item(link.targetId)); if (i.unitId !== unit) throw new ApiError(404, 'not_found'); return { id: i.id, label: `${series.find((s) => s.id === i.seriesId)?.name ?? 'Řada'} ${i.number ?? '(bez čísla)'}`, number: i.number, variant: i.variant, description: i.description, size: i.size, condition: i.condition, acquiredOn: i.acquiredOn, retiredAt: i.retiredAt }; }
    const k = await firstValueFrom(this.inventory.kit(link.targetId)); if (k.unitId !== unit) throw new ApiError(404, 'not_found'); return { id: k.id, label: `${series.find((s) => s.id === k.seriesId)?.name ?? 'Řada'} ${k.number ?? '(bez čísla)'}`, number: k.number, variant: null, description: k.description, compositionState: k.compositionState, retiredAt: k.retiredAt };
  }
  private async currentObjects(row: C.CostumeCost): Promise<C.CostumeCost> { return { ...row, links: await Promise.all(row.links.map(async (l) => ({ ...l, object: await this.object(row.unitId, l) }))) }; }
  private async filtered(query: C.CostQuery): Promise<C.CostumeCost[]> {
    this.only(query, ['unitId', 'from', 'to', 'currency', 'q', 'limit', 'offset']);
    const units = (await this.units()).filter((u) => (u.hasCostumeFund || this.rows.some((c) => c.unitId === u.id)) && this.readable(u.id)); if (!units.length && !this.readable(0)) throw new ApiError(403, 'forbidden');
    if (query.unitId !== undefined) await this.access(query.unitId, false);
    if (query.from !== undefined && !validDate(query.from) || query.to !== undefined && !validDate(query.to) || query.from && query.to && query.from > query.to) throw invalid('from');
    if (query.currency !== undefined && (query.currency.length !== 3 || !/^[A-Z]{3}$/u.test(query.currency))) throw invalid('currency');
    if (query.q !== undefined && (!query.q.trim() || query.q.length > 200)) throw invalid('q');
    if (query.limit !== undefined && (!Number.isInteger(query.limit) || query.limit < 1 || query.limit > 200) || query.offset !== undefined && (!Number.isInteger(query.offset) || query.offset < 0)) throw invalid('limit');
    const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const rows = this.rows.filter((c) => units.some((u) => u.id === c.unitId) && (!query.unitId || c.unitId === query.unitId) && (!query.from || c.spentOn >= query.from) && (!query.to || c.spentOn <= query.to) && (!query.currency || c.currency === query.currency) && (!query.q || normalize([c.supplier, c.documentRef, c.description, c.purpose].join(' ')).includes(normalize(query.q)))).sort((a, b) => b.spentOn.localeCompare(a.spentOn) || b.id - a.id);
    return Promise.all(rows.map((c) => this.currentObjects(c)));
  }
  private totals(rows: C.CostumeCost[]): C.CostTotal[] { return [...new Set(rows.map((r) => r.currency))].sort().map((currency) => { const found = rows.filter((r) => r.currency === currency); return { currency, amount: sumCostAmounts(found.map((r) => r.amount)), count: found.length }; }); }
  private page(rows: C.CostumeCost[], query: C.CostQuery): C.CostPage { return { items: rows.slice(query.offset ?? 0, (query.offset ?? 0) + (query.limit ?? 50)), total: rows.length, totals: this.totals(rows) }; }
  private async all<T>(read: (offset: number) => Observable<C.Page<T>>): Promise<T[]> { const rows: T[] = []; for (;;) { const page = await firstValueFrom(read(rows.length)); if (!page.items.length && rows.length < page.total) throw new ApiError(500, 'internal_error'); rows.push(...page.items); if (rows.length >= page.total) return rows; } }
  private only(value: object, allowed: string[]) { if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some((k) => !allowed.includes(k))) throw invalid('input'); }
  private run<T>(work: () => Promise<T>): Observable<T> { return defer(() => { const task = this.queue.then(async () => { const before = structuredClone(this.rows); try { const result = await work(); return result instanceof Blob ? result : structuredClone(result); } catch (error) { this.rows = before; throw error; } }); this.queue = task.catch(() => undefined); return from(task); }); }
}
function invalid(field: string) { return new ApiError(422, 'validation_failed', { field, reason: 'invalid' }); }
function validDate(value: string) { return typeof value === 'string' && Number(value.slice(0, 4)) > 0 && /^\d{4}-\d{2}-\d{2}$/u.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value; }

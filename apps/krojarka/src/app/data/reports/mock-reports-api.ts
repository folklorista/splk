import { REPORT_LABELS, reportDetails } from './report-labels';
import { inject, Injectable } from '@angular/core';
import { defer, firstValueFrom, from, Observable } from 'rxjs';
import type * as C from '@splk/api-contracts';
import { reportCsv } from '@splk/domain';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../api-error';
import { CatalogApi } from '../catalog/catalog-api';
import { InventoryApi } from '../inventory/inventory-api';
import { PeopleApi } from '../people/people-api';
import { OrganizationApi } from '../organization/organization-api';
import { ReportsApi } from './reports-api';
@Injectable()
export class MockReportsApi extends ReportsApi {
  private readonly auth = inject(AuthService);
  private readonly catalog = inject(CatalogApi);
  private readonly inventory = inject(InventoryApi);
  private readonly people = inject(PeopleApi);
  private readonly organization = inject(OrganizationApi);
  report(unit: number, kind: C.ReportKind, id?: number, query: C.ReportQuery = {}) { return defer(() => from(this.build(unit, kind, id, query))); }
  csv(unit: number, kind: C.ReportKind, id?: number, query: C.ReportQuery = {}) { return defer(() => from(this.build(unit, kind, id, query).then((report) => new Blob([reportCsv(report)], { type: 'text/csv;charset=utf-8' })))); }
  search(query: C.SearchQuery) { return defer(() => from(this.find(query))); }
  private async funds() {
    const mandates = this.auth.user()?.mandates ?? [];
    return (await firstValueFrom(this.organization.units())).filter((u) => u.hasCostumeFund && !u.archived && mandates.some((m) => ['costumes.manage', 'costumes.view'].includes(m.kind) && (m.scopeType === 'organization' && m.kind === 'costumes.view' || m.scopeType === 'unit' && m.scopeId === u.id)));
  }
  private async build(unit: number, kind: C.ReportKind, id: number | undefined, query: C.ReportQuery): Promise<C.CostumeReport> {
    if (!(await this.funds()).some((f) => f.id === unit)) throw new ApiError(404, 'not_found');
    const sections: C.CostumeReport['sections'] = [], series = await firstValueFrom(this.catalog.series(unit));
    const table = (title: string, columns: string[], rows: (string | number | null)[][]) => sections.push({ title, columns, rows: rows.map((row) => row.map((value, index) => typeof value === 'string' && ['Stav', 'Umístění', 'Původ', 'Uzavření', 'Událost', 'Výsledek', 'Druh', 'Typ'].includes(columns[index]) ? REPORT_LABELS[value] ?? value : value)) });
    const people = await this.all((offset) => this.people.people({ fund: unit, offset, limit: 200 }));
    const units = await firstValueFrom(this.organization.units());
    const holder = (h: C.LoanHolder | null) => !h ? null : h.personId ? people.find((p) => p.id === h.personId) ? [people.find((p) => p.id === h.personId)!.firstName, people.find((p) => p.id === h.personId)!.lastName].join(' ') : 'Osoba' : units.find((u) => u.id === h.unitId)?.name ?? 'Složka';
    const itemLabel = (i: C.CostumeItem) => `${series.find((s) => s.id === i.seriesId)?.name ?? 'Řada'} ${i.number ?? '(bez čísla)'}`;
    let title = 'Soupis součástek', selected: C.CostumeItem[] = [];
    const kitSeries = kind === 'series' && series.some((s) => s.id === id && s.kind === 'kit');
    if (kitSeries && Object.keys(query).length) throw new ApiError(422, 'validation_failed');
    const seriesKits = kitSeries ? await this.all((offset) => this.inventory.kits(unit, { series: id, offset, limit: 200 })) : [];
    if (kitSeries) table('Komplety podle evidence; složení není fyzické ověření', ['Komplet ID', 'Řada', 'Číslo', 'Stav složení', 'Držitel'], seriesKits.map((k) => [k.id, series.find((s) => s.id === id)!.name, k.number, REPORT_LABELS[k.compositionState] ?? k.compositionState, holder(k.holder)]));
    if (!kitSeries && ['items', 'series', 'item'].includes(kind)) {
      if (kind === 'item') { const item = await firstValueFrom(this.inventory.item(id!)); if (item.unitId !== unit) throw new ApiError(404, 'not_found'); selected = [item]; }
      else {
        if (kind === 'series' && !series.some((s) => s.id === id)) throw new ApiError(404, 'not_found');
        const q = { ...query, ...(kind === 'series' ? { series: id } : {}), limit: 200 };
        selected = await this.all((offset) => this.inventory.items(unit, { ...q, retired: query.retired ?? false, offset }));
        if (query.retired === undefined) selected.push(...await this.all((offset) => this.inventory.items(unit, { ...q, retired: true, offset })));
      }
      table('Součástky podle evidence', ['Kus ID', 'Řada', 'Číslo', 'Stav', 'Umístění', 'Držitel', 'Vyřazeno', 'Pořízeno'], selected.map((i) => [i.id, series.find((s) => s.id === i.seriesId)?.name ?? '', i.number, i.condition, i.location, holder(i.holder), i.retiredAt, i.acquiredOn]));
      if (kind === 'item') { title = 'Současný a historický soupis součástky'; const events = await this.all((offset) => this.inventory.history(id!, { offset, limit: 200 })); table('Zaznamenaná historie; papírová minulost nemusí být úplná', ['Datum zápisu', 'Událost', 'Autor účtu', 'Údaje'], events.map((e) => [e.at, e.event, e.by, [reportDetails(e.data), e.data['holder'] ? `Držitel: ${holder(e.data['holder'] as C.LoanHolder)}` : ''].filter(Boolean).join(' · ')])); }
    }
    if (['loans', 'person', 'item', 'series'].includes(kind)) {
      if (kind === 'person' && !people.some((p) => p.id === id)) throw new ApiError(404, 'not_found');
      const loans = await this.all((offset) => this.inventory.loans(unit, { ...(kind === 'person' ? { person: id } : {}), open: query.open, overdue: query.overdue, holderType: query.holderType, offset, limit: 200 }));
      table('Držení a výpůjčky podle evidence', ['Výpůjčka ID', 'Držitel', 'Součást', 'Původně', 'Vráceno', 'Zbývá', 'Původ', 'Skutečný výdej', 'Digitalizace', 'Původní datum z papíru', 'Termín', 'Uzavření'], loans.flatMap((l) => l.lines.filter((line) => kind !== 'item' || line.itemId === id).filter((line) => kind !== 'series' || (kitSeries ? seriesKits.some((k) => k.id === l.kitId) : selected.some((i) => i.id === line.itemId))).map((line) => [l.id, holder(l.holder), line.label, line.qty, line.returnedQty, line.closedAt ? 0 : line.qty - line.returnedQty, l.origin ?? 'handover', l.issuedAt, l.migratedAt ?? null, l.originalIssuedOn ?? null, l.dueAt, line.closeType])));
      if (kind === 'person') title = `Krojová karta · ${holder({ personId: id! })}`;
      if (kind === 'loans') title = 'Výpůjčky a nevrácené součástky';
    }
    if (kind === 'kit') {
      const kit = await firstValueFrom(this.inventory.kit(id!)); if (kit.unitId !== unit) throw new ApiError(404, 'not_found'); title = `Komplet · ${series.find((s) => s.id === kit.seriesId)?.name} ${kit.number ?? ''}`;
      table(`Určené složení, nikoli fyzické ověření · ${REPORT_LABELS[kit.compositionState] ?? kit.compositionState}`, ['Kus ID', 'Řada', 'Číslo', 'Držitel', 'Umístění'], kit.items.map((i) => [i.id, itemLabel(i), i.number, holder(i.holder), i.location]));
      table('Nečíslované doplňky; počty v evidenci nejsou potvrzení přítomnosti', ['Zásoba ID', 'Požadováno', 'Evidováno', 'Chybí podle evidence'], kit.bulkLines.map((l) => [l.bulkStockId, l.requiredQty, l.presentQty, Math.max(0, l.requiredQty - l.presentQty)]));
    }
    if (kind === 'inventory') {
      const inventory = await firstValueFrom(this.inventory.inventory(id!)); if (inventory.unitId !== unit) throw new ApiError(404, 'not_found'); title = `Inventura · ${inventory.name}`;
      const targets = await this.all((offset) => this.inventory.inventoryCollection(id!, 'targets', { offset, limit: 200 })), checks = await this.all((offset) => this.inventory.inventoryCollection(id!, 'checks', { offset, limit: 200 }));
      table('Zmrazený inventurní soupis', ['Cíl ID', 'Popis při zahájení', 'Očekávaný počet', 'Držitel při zahájení'], targets.map((t) => [t.id, String(t.snapshot['label'] ?? ''), t.expectedQty, holder(t.holderPersonId ? { personId: t.holderPersonId } : t.holderUnitId ? { unitId: t.holderUnitId } : null)]));
      table('Skutečně zapsané kontroly včetně zrušených', ['Cíl ID', 'Datum', 'Výsledek', 'Stav', 'Zjištěný počet', 'Zrušeno', 'Poznámka'], checks.map((c) => [c.targetId, c.at, c.result, c.condition, c.checkedQty, c.cancelledAt, c.note]));
      table('Nesrovnalosti; zásoby mimo procento kusů', ['Cíl ID', 'Druh', 'Podrobnosti'], inventory.progress.issues.map((i) => [i.targetId, i.kind, reportDetails(i as unknown as Record<string, unknown>)]));
    }
    if (kind === 'work-orders') {
      title = 'Pracovní úkoly'; const items = [...await this.all((offset) => this.inventory.items(unit, { offset, limit: 200 })), ...await this.all((offset) => this.inventory.items(unit, { offset, limit: 200, retired: true }))], rows: (string | number | null)[][] = [];
      for (const item of items) { const orders = await this.all((offset) => this.inventory.workOrders(item.id, { offset, limit: 200 })); rows.push(...orders.filter((o) => !query.status || (query.status === 'active' ? ['open', 'in_progress'].includes(o.status) : o.status === query.status)).map((o) => [o.id, o.itemId, o.type, o.status, o.description, o.dueOn])); }
      table('Opravy a další úkoly', ['Úkol ID', 'Kus ID', 'Typ', 'Stav', 'Popis', 'Termín'], rows);
    }
    return { unitId: unit, generatedAt: new Date().toISOString(), title, notice: 'Podle evidence v okamžiku sestavení. Pouze výslovná nezrušená inventurní kontrola je fyzické ověření. Historická evidence nemusí být úplná.', sections };
  }
  private async find(query: C.SearchQuery): Promise<C.SearchPage> {
    const funds = await this.funds(); if (!funds.length) throw new ApiError(403, 'forbidden');
    if (!query.q.trim() || query.q.length > 200) throw new ApiError(422, 'validation_failed');
    if (query.fund && !funds.some((f) => f.id === query.fund)) throw new ApiError(404, 'not_found');
    const items: C.SearchResult[] = (await this.all((offset) => this.people.people({ offset, limit: 200 }))).map((p) => ({ kind: 'person', id: p.id, unitId: null, label: `${p.firstName} ${p.lastName} ${p.nickname ?? ''}`.trim(), retired: false }));
    for (const fund of funds.filter((f) => !query.fund || query.fund === f.id)) {
      const series = await firstValueFrom(this.catalog.series(fund.id)), rows = [...await this.all((offset) => this.inventory.items(fund.id, { offset, limit: 200 })), ...await this.all((offset) => this.inventory.items(fund.id, { offset, limit: 200, retired: true }))];
      for (const i of rows) items.push({ kind: 'item', id: i.id, unitId: fund.id, label: `${series.find((s) => s.id === i.seriesId)?.name ?? ''} ${i.number ?? ''}`.trim(), retired: !!i.retiredAt });
      for (const k of await this.all((offset) => this.inventory.kits(fund.id, { offset, limit: 200 }))) items.push({ kind: 'kit', id: k.id, unitId: fund.id, label: `${series.find((s) => s.id === k.seriesId)?.name ?? ''} ${k.number ?? ''}`.trim(), retired: false });
    }
    const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(), tokens = normalize(query.q.trim()).split(/\s+/);
    const rows = items.filter((i) => tokens.every((t) => normalize(i.label).includes(t))).sort((a, b) => a.kind.localeCompare(b.kind) || a.label.localeCompare(b.label, 'cs') || a.id - b.id);
    return { items: rows.slice(query.offset ?? 0, (query.offset ?? 0) + (query.limit ?? 50)), total: rows.length };
  }
  private async all<T>(read: (offset: number) => Observable<C.Page<T>>): Promise<T[]> { const rows: T[] = []; for (;;) { const page = await firstValueFrom(read(rows.length)); if (!page.items.length && rows.length < page.total) throw new ApiError(500, 'internal_error'); rows.push(...page.items); if (rows.length >= page.total) return rows; } }
}

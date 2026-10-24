import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import type { CostumeReport } from '@splk/api-contracts';
import { reportCsv } from '@splk/domain';
import { FundContext } from '../../core/fund/fund-context';
import { ReportsApi } from '../../data/reports/reports-api';
import { CatalogApi } from '../../data/catalog/catalog-api';
import { PeopleApi } from '../../data/people/people-api';
import { InventoryApi } from '../../data/inventory/inventory-api';
import { ReportsStore } from './reports.store';
const report: CostumeReport = { unitId: 1, generatedAt: '2026-10-24T12:00:00Z', title: 'Soupis', notice: 'Podle evidence', sections: [{ title: 'Kusy', columns: ['Popis', 'Počet'], rows: [['=SUM(A1)', 2], ['Jan; „Lojza“\nNovák', null], [' \t+CMD()', -3]] }] };
describe('ReportsStore', () => {
  let store: ReportsStore, fund: ReturnType<typeof signal<{ unitId: number; name: string; canManage: boolean }>>, api: Record<string, ReturnType<typeof vi.fn>>;
  beforeEach(() => {
    fund = signal({ unitId: 1, name: 'Fund', canManage: false }); api = { report: vi.fn(() => of(report)), csv: vi.fn(() => of(new Blob(['csv']))) };
    TestBed.configureTestingModule({ providers: [ReportsStore, { provide: FundContext, useValue: { current: fund } }, { provide: ReportsApi, useValue: api }, { provide: CatalogApi, useValue: { series: () => of([]) } }, { provide: PeopleApi, useValue: {} }, { provide: InventoryApi, useValue: {} }] }); store = TestBed.inject(ReportsStore); TestBed.tick();
  });
  it('exports captured filters and prevents printing before a complete report', async () => {
    vi.spyOn(window, 'print').mockImplementation(() => undefined); vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:csv'); vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined); vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    store.print(); expect(window.print).not.toHaveBeenCalled(); const query = { retired: false }; await store.load(undefined, query); query.retired = true; await store.csv(); expect(api['csv']).toHaveBeenCalledWith(1, 'items', undefined, { retired: false }); store.print(); expect(window.print).toHaveBeenCalledTimes(1); vi.restoreAllMocks();
  });
  it('ignores old reports and completed exports after changing funds', async () => {
    const delayed = new Subject<CostumeReport>(); api['report'].mockReturnValueOnce(delayed); const pending = store.load(); fund.set({ unitId: 2, name: 'Other', canManage: false }); TestBed.tick(); delayed.next(report); delayed.complete(); await pending; expect(store.result()).toBeNull();
    api['report'].mockReturnValue(of({ ...report, unitId: 2 })); await store.load(); const binary = new Subject<Blob>(); api['csv'].mockReturnValueOnce(binary); vi.spyOn(URL, 'createObjectURL'); const exporting = store.csv(); fund.set({ unitId: 1, name: 'Fund', canManage: false }); TestBed.tick(); binary.next(new Blob(['old'])); binary.complete(); await exporting; expect(URL.createObjectURL).not.toHaveBeenCalled(); vi.restoreAllMocks();
  });
  it('rejects incomplete selections and returned foreign reports', async () => {
    store.kind.set('person'); TestBed.tick(); await store.load(); expect(api['report']).not.toHaveBeenCalled(); store.kind.set('items'); TestBed.tick(); api['report'].mockReturnValue(of({ ...report, unitId: 2 })); await store.load(); expect(store.result()).toBeNull(); expect(store.error()).toBeTruthy();
  });
  it('escapes CSV formulas, delimiters, Unicode and line breaks, preserving numeric values', () => {
    const csv = reportCsv(report); expect(csv).toContain("'=SUM(A1);2\r\n"); expect(csv).toContain('"Jan; „Lojza“\nNovák";'); expect(csv).toContain("' \t+CMD();-3\r\n"); expect(csv.charCodeAt(0)).toBe(0xfeff); expect(report.sections[0].rows[0][0]).toBe('=SUM(A1)');
  });
});

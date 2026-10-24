import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import type { Fund } from '../../core/fund/fund-context';
import { FundContext } from '../../core/fund/fund-context';
import { PeopleApi } from '../../data/people/people-api';
import { CatalogApi } from '../../data/catalog/catalog-api';
import { InventoryApi } from '../../data/inventory/inventory-api';
import { PaperMigrationStore } from './paper-migration.store';

describe('PaperMigrationStore', () => {
  let store: PaperMigrationStore, fund: ReturnType<typeof signal<Fund>>, people: Record<string, ReturnType<typeof vi.fn>>;
  beforeEach(() => {
    fund = signal({ unitId: 1, name: 'Fund', canManage: true });
    people = { card: vi.fn(() => of({ person: { id: 3 }, profile: null })), paperFindings: vi.fn(() => of({ items: [], total: 0 })), migratePaper: vi.fn(() => of({ id: 3, results: [{ status: 'conflict', label: '03' }] })), profile: vi.fn(() => of({})) };
    TestBed.configureTestingModule({ providers: [PaperMigrationStore, { provide: FundContext, useValue: { current: fund } }, { provide: PeopleApi, useValue: people }, { provide: CatalogApi, useValue: { series: () => of([]) } }, { provide: InventoryApi, useValue: { loans: () => of({ items: [], total: 0 }) } }] });
    store = TestBed.inject(PaperMigrationStore); store.personId.set(3); TestBed.tick();
  });
  const loaded = async () => { await vi.waitFor(() => expect(store.loading()).toBe(false)); };
  it('keeps findings and permits explicit completion with unavailable original and a reason', async () => {
    await loaded(); await store.migrate({ entries: [{ seriesId: 1, number: '03' }] }); expect(store.results()[0].status).toBe('conflict');
    expect(await store.finish(false, true, '')).toBe(false); expect(await store.finish(true, false, '')).toBe(false); expect(people['profile']).not.toHaveBeenCalled();
    expect(await store.finish(true, false, 'Original unavailable; conflict retained')).toBe(true);
    expect(people['profile']).toHaveBeenCalledWith(1, 3, { paperState: 'digital', originalChecked: false, note: 'Original unavailable; conflict retained' });
  });
  it('never writes for readers', async () => {
    await loaded(); fund.set({ unitId: 1, name: 'Fund', canManage: false }); TestBed.tick(); await loaded();
    expect(await store.start(true, '')).toBe(false); expect(await store.migrate({ entries: [{ itemId: 1 }] })).toBe(false); expect(people['profile']).not.toHaveBeenCalled(); expect(people['migratePaper']).not.toHaveBeenCalled();
  });
  it('ignores a late import after changing the fund', async () => {
    await loaded(); const delayed = new Subject<{ id: number; results: [] }>(); people['migratePaper'].mockReturnValueOnce(delayed);
    const pending = store.migrate({ entries: [{ itemId: 1 }] }); fund.set({ unitId: 2, name: 'Other', canManage: true }); TestBed.tick(); await loaded(); delayed.next({ id: 3, results: [] }); delayed.complete();
    expect(await pending).toBe(false); expect(store.results()).toEqual([]); expect(store.notice()).toBe(''); expect(store.busy()).toBe(false);
  });
});

import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import type { SearchPage } from '@splk/api-contracts';
import { FundContext } from '../../core/fund/fund-context';
import { ReportsApi } from '../../data/reports/reports-api';
import { SearchStore } from './search.store';
describe('SearchStore', () => {
  let store: SearchStore, search: ReturnType<typeof vi.fn>, select: ReturnType<typeof vi.fn>, fund: ReturnType<typeof signal<{ unitId: number; name: string }>>;
  beforeEach(() => {
    fund = signal({ unitId: 1, name: 'Fund' }); search = vi.fn(() => of({ items: [], total: 0 })); select = vi.fn();
    TestBed.configureTestingModule({ providers: [SearchStore, { provide: FundContext, useValue: { current: fund, funds: signal([{ unitId: 1, name: 'Fund' }, { unitId: 2, name: 'Other' }]), select } }, { provide: ReportsApi, useValue: { search } }] }); store = TestBed.inject(SearchStore); TestBed.tick();
  });
  it('ignores a slower previous query and retains the submitted term for pagination', async () => {
    const old = new Subject<SearchPage>(); search.mockReturnValueOnce(old); const pending = store.search('old'); await store.search('03'); old.next({ items: [{ kind: 'item', id: 1, unitId: 1, label: 'Old', retired: false }], total: 1 }); old.complete(); await pending; expect(store.rows()).toEqual([]); expect(store.term()).toBe('03');
    await store.search('unsent edit', true); expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ q: '03', fund: 1 }));
  });
  it('cancels a pending query when the next submitted query is blank', async () => {
    const delayed = new Subject<SearchPage>(); search.mockReturnValueOnce(delayed); const pending = store.search('old'); await store.search('  '); expect(store.loading()).toBe(false); expect(store.error()).toBeTruthy();
    delayed.next({ items: [], total: 0 }); delayed.complete(); await pending; expect(store.loading()).toBe(false);
  });
  it('rejects foreign fund responses and selects only a visible fund when navigating', async () => {
    search.mockReturnValueOnce(of({ items: [{ kind: 'kit', id: 3, unitId: 99, label: 'Hidden', retired: false }], total: 1 })); await store.search('Hidden'); expect(store.rows()).toEqual([]); expect(store.error()).toBeTruthy();
    store.select({ kind: 'kit', id: 3, unitId: 2, label: 'Visible', retired: false }); expect(select).toHaveBeenCalledWith(2);
    expect(store.link({ kind: 'item', id: 3, unitId: 1, label: '03', retired: false })).toEqual(['/soucastky', 'kusy', 3]);
  });
});

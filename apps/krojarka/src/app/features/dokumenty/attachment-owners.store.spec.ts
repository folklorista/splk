import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { FundContext } from '../../core/fund/fund-context';
import { PeopleApi } from '../../data/people/people-api';
import { CatalogApi } from '../../data/catalog/catalog-api';
import { InventoryApi } from '../../data/inventory/inventory-api';
import { AttachmentOwnersStore } from './attachment-owners.store';

describe('AttachmentOwnersStore', () => {
  it('loads every person page using the selected fund and readable identities', async () => {
    const people = vi.fn((q) => of({ items: [{ id: q.offset + 1, firstName: 'Jan', lastName: 'Novák', nickname: q.offset ? 'Honza' : null }], total: 2 }));
    TestBed.configureTestingModule({ providers: [AttachmentOwnersStore, { provide: FundContext, useValue: { current: signal({ unitId: 2, name: 'Fund' }) } }, { provide: PeopleApi, useValue: { people } }, { provide: CatalogApi, useValue: {} }, { provide: InventoryApi, useValue: {} }] });
    const store = TestBed.inject(AttachmentOwnersStore); await store.load('person'); expect(people).toHaveBeenLastCalledWith({ fund: 2, offset: 1, limit: 200 });
    expect(store.options().map((o) => o.label)).toEqual(['Jan Novák', 'Jan Novák (Honza)']);
  });
  it('ignores stale owners after changing kind and fund', async () => {
    const fund = signal({ unitId: 1, name: 'First' }), delayed = new Subject<{ id: number; name: string }[]>();
    TestBed.configureTestingModule({ providers: [AttachmentOwnersStore, { provide: FundContext, useValue: { current: fund } }, { provide: PeopleApi, useValue: {} }, { provide: CatalogApi, useValue: { series: () => delayed } }, { provide: InventoryApi, useValue: {} }] });
    const store = TestBed.inject(AttachmentOwnersStore), pending = store.load('series'); fund.set({ unitId: 2, name: 'Second' }); await store.load('archive');
    delayed.next([{ id: 7, name: 'Old series' }]); delayed.complete(); await pending; expect(store.options()).toEqual([{ id: 2, label: 'Dokumenty fondu Second' }]);
  });
});

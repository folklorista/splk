import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { PartType, Series } from '@splk/api-contracts';
import { CatalogApi } from '../catalog/catalog-api';
import { MockInventoryApi } from './mock-inventory-api';

describe('MockInventoryApi', () => {
  let api: MockInventoryApi;
  let series: Series[];
  beforeEach(() => {
    const types: PartType[] = [{ id: 1, name: 'Košile', numbered: true, archived: false, gender: 'male', regionId: null },
      { id: 2, name: 'Mašle', numbered: false, archived: false, gender: null, regionId: null }];
    series = [{ id: 1, kind: 'part', name: 'Kopaničká košile', partTypeId: 1, archived: false, regionId: null, gender: 'male', variant: null, allowNumberReuse: true },
      { id: 2, kind: 'kit', name: 'Komplety', partTypeId: null, archived: false, regionId: null, gender: null, variant: null, allowNumberReuse: true }];
    TestBed.configureTestingModule({ providers: [MockInventoryApi, { provide: CatalogApi, useValue: { series: () => of(series), partTypes: () => of(types), regions: () => of([]) } }] });
    api = TestBed.inject(MockInventoryApi);
  });
  const item = () => firstValueFrom(api.createItem(1, { seriesId: 1, number: null }));
  const kit = (number: string) => firstValueFrom(api.createKit(1, { seriesId: 2, number }));

  it('keeps stable identities, old notes and independent copies', async () => {
    const a = await firstValueFrom(api.createItem(1, { seriesId: 1, number: '3', note: 'Old' }));
    a.note = 'Local edit';
    expect((await firstValueFrom(api.item(a.id))).note).toBe('Old');
    await firstValueFrom(api.updateItem(a.id, { version: 1, note: 'New' }));
    await expect(firstValueFrom(api.updateItem(a.id, { version: 1, note: 'Stale' }))).rejects.toMatchObject({ code: 'version_conflict' });
    await firstValueFrom(api.retireItem(a.id, { version: 2, reason: 'Old piece' }));
    const b = await firstValueFrom(api.createItem(1, { seriesId: 1, number: '3' }));
    expect(b.id).not.toBe(a.id);
    const history = await firstValueFrom(api.history(a.id));
    expect(history.items.at(-1)?.data['note']).toBe('Old');
    expect(history.total).toBe(3);
    series[0].allowNumberReuse = false;
    await firstValueFrom(api.retireItem(b.id, { version: 1, reason: 'Old' }));
    await expect(firstValueFrom(api.createItem(1, { seriesId: 1, number: '3' }))).rejects.toMatchObject({ code: 'number_already_used' });
  });

  it('serializes duplicate creation and leaves rejected requests without rows', async () => {
    const a = firstValueFrom(api.createItem(1, { seriesId: 1, number: '1' }));
    const b = firstValueFrom(api.createItem(1, { seriesId: 1, number: '1' })).catch((e: unknown) => e);
    await a; expect(await b).toMatchObject({ code: 'number_already_used' });
    expect((await firstValueFrom(api.items(1))).total).toBe(1);
    expect((await firstValueFrom(api.items(2))).total).toBe(0);
  });

  it('searches without diacritics and paginates with total', async () => {
    await firstValueFrom(api.createItem(1, { seriesId: 1, number: '17', note: '100% linen' }));
    await firstValueFrom(api.createItem(1, { seriesId: 1, number: '18' }));
    expect((await firstValueFrom(api.items(1, { q: 'kopanicka kosile 17' }))).total).toBe(1);
    expect((await firstValueFrom(api.items(1, { q: '100%' }))).total).toBe(1);
    const page = await firstValueFrom(api.items(1, { limit: 1, offset: 1, sort: 'number' }));
    expect(page.total).toBe(2); expect(page.items[0].number).toBe('18');
  });

  it('changes intended kit membership without asserting presence and checks both versions', async () => {
    const a = await kit('A'), b = await kit('B'), i = await item();
    const added = await firstValueFrom(api.composition(a.id, { action: 'add', version: 1, itemId: i.id, itemVersion: 1 }));
    expect(added.compositionState).toBe('unverified'); expect(added.items[0].location).toBe('unknown');
    await expect(firstValueFrom(api.composition(a.id, { action: 'move', version: 2, itemId: i.id, itemVersion: 2, targetKitId: b.id, targetVersion: 9 }))).rejects.toMatchObject({ code: 'version_conflict' });
    expect((await firstValueFrom(api.kit(a.id))).items).toHaveLength(1);
    await firstValueFrom(api.composition(a.id, { action: 'move', version: 2, itemId: i.id, itemVersion: 2, targetKitId: b.id, targetVersion: 1 }));
    expect((await firstValueFrom(api.kit(a.id))).items).toHaveLength(0);
    expect((await firstValueFrom(api.kit(b.id))).version).toBe(2);
    expect((await firstValueFrom(api.item(i.id))).location).toBe('unknown');
  });

  it('separates bulk requirements from allocations and rejects reductions below allocations', async () => {
    const a = await kit('A'), b = await kit('B');
    const stock = await firstValueFrom(api.createStock(1, { partTypeId: 2, quantityTotal: 3 }));
    await firstValueFrom(api.composition(a.id, { action: 'add', version: 1, bulkStockId: stock.id, requiredQty: 5, presentQty: 0 }));
    expect((await firstValueFrom(api.stocks(1))).items[0].quantityInKits).toBe(0);
    await firstValueFrom(api.composition(a.id, { action: 'add', version: 2, bulkStockId: stock.id, requiredQty: 2, presentQty: 2 }));
    await expect(firstValueFrom(api.updateStock(stock.id, { quantityTotal: 1 }))).rejects.toMatchObject({ code: 'insufficient_stock' });
    await firstValueFrom(api.composition(a.id, { action: 'move', version: 3, bulkStockId: stock.id, requiredQty: 2, presentQty: 1, targetKitId: b.id, targetVersion: 1 }));
    expect((await firstValueFrom(api.kit(a.id))).bulkLines[0]).toMatchObject({ requiredQty: 5, presentQty: 1 });
    expect((await firstValueFrom(api.kit(b.id))).bulkLines[0]).toMatchObject({ requiredQty: 2, presentQty: 1 });
    await firstValueFrom(api.composition(a.id, { action: 'remove', version: 4, bulkStockId: stock.id, requiredQty: 1, presentQty: 1 }));
    expect((await firstValueFrom(api.kit(a.id))).bulkLines[0]).toMatchObject({ requiredQty: 4, presentQty: 0 });
    expect((await firstValueFrom(api.stocks(1))).items[0].quantityInKits).toBe(1);
  });

  it('rolls back source counts and both kit versions when target counts overflow', async () => {
    const a = await kit('A'), b = await kit('B');
    const stock = await firstValueFrom(api.createStock(1, { partTypeId: 2, quantityTotal: 0 }));
    await firstValueFrom(api.composition(a.id, { action: 'add', version: 1, bulkStockId: stock.id, requiredQty: 1, presentQty: 0 }));
    await firstValueFrom(api.composition(b.id, { action: 'add', version: 1, bulkStockId: stock.id, requiredQty: 2147483647, presentQty: 0 }));
    await expect(firstValueFrom(api.composition(a.id, { action: 'move', version: 2, bulkStockId: stock.id, requiredQty: 1, presentQty: 0, targetKitId: b.id, targetVersion: 2 }))).rejects.toMatchObject({ code: 'validation_failed' });
    const source = await firstValueFrom(api.kit(a.id)), target = await firstValueFrom(api.kit(b.id));
    expect(source.version).toBe(2); expect(source.bulkLines[0].requiredQty).toBe(1); expect(source.changes).toHaveLength(1);
    expect(target.version).toBe(2); expect(target.bulkLines[0].requiredQty).toBe(2147483647);
  });

  it('records work orders without changing condition, location or issuability', async () => {
    const i = await item();
    const order = await firstValueFrom(api.createWorkOrder(i.id, { type: 'repair', description: 'Button' }));
    await firstValueFrom(api.updateWorkOrder(order.id, { status: 'done' }));
    expect(await firstValueFrom(api.item(i.id))).toEqual(i);
    expect((await firstValueFrom(api.workOrders(i.id))).items[0].status).toBe('done');
    expect((await firstValueFrom(api.history(i.id))).total).toBe(3);
  });
});

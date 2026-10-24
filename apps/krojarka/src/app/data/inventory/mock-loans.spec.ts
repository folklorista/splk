import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { CatalogApi } from '../catalog/catalog-api';
import { OrganizationApi } from '../organization/organization-api';
import { MockInventoryApi } from './mock-inventory-api';

describe('MockInventoryApi handovers', () => {
  let api: MockInventoryApi;
  const holder = { personId: 3 };
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [MockInventoryApi,
      { provide: CatalogApi, useValue: { series: () => of([
        { id: 1, kind: 'part', partTypeId: 1, regionId: null, archived: false, allowNumberReuse: true },
        { id: 2, kind: 'kit', regionId: null, archived: false, allowNumberReuse: true },
      ]), partTypes: () => of([{ id: 1, numbered: true, archived: false, regionId: null }, { id: 2, numbered: false, archived: false, regionId: null }]), regions: () => of([]) } },
      { provide: OrganizationApi, useValue: { persons: () => of([{ id: 3 }]), units: () => of([{ id: 1 }, { id: 2 }]) } },
    ] });
    api = TestBed.inject(MockInventoryApi);
  });
  const piece = () => firstValueFrom(api.createItem(1, { seriesId: 1, number: null }));
  const issuePiece = async () => { const p = await piece(); return firstValueFrom(api.issue(1, { holder, items: [p.id] })); };
  async function kitWithRibbons() {
    const kit = await firstValueFrom(api.createKit(1, { seriesId: 2, number: null }));
    const stock = await firstValueFrom(api.createStock(1, { partTypeId: 2, quantityTotal: 2 }));
    await firstValueFrom(api.composition(kit.id, { version: 1, action: 'add', bulkStockId: stock.id, requiredQty: 2, presentQty: 2 }));
    return { kit, stock };
  }
  it('derives availability from an actual handover without changing location', async () => {
    const loan = await issuePiece(), id = loan.lines[0].itemId!;
    expect(await firstValueFrom(api.item(id))).toMatchObject({ available: false, holder, location: 'unknown' });
    expect((await firstValueFrom(api.items(1, { available: true }))).total).toBe(0);
    expect((await firstValueFrom(api.items(1, { holder: 3 }))).total).toBe(1);
    await expect(firstValueFrom(api.issue(1, { holder, items: [id] }))).rejects.toMatchObject({ code: 'item_unavailable' });
    await firstValueFrom(api.returnLoan(loan.id, { lines: [{ lineId: loan.lines[0].id, returnedQty: 1, closeType: 'returned' }] }));
    expect(await firstValueFrom(api.item(id))).toMatchObject({ available: true, holder: null, location: 'unknown' });
  });
  it('counts kit ribbons once and preserves outstanding capacity after composition removal', async () => {
    const { kit, stock } = await kitWithRibbons();
    const loan = await firstValueFrom(api.issue(1, { holder, kitId: kit.id }));
    expect((await firstValueFrom(api.kit(kit.id))).bulkLines[0].presentQty).toBe(2);
    expect((await firstValueFrom(api.stocks(1))).items[0]).toMatchObject({ quantityReserved: 2, quantityAvailable: 0 });
    await firstValueFrom(api.composition(kit.id, { version: 2, action: 'remove', bulkStockId: stock.id }));
    expect((await firstValueFrom(api.loan(loan.id))).lines[0].qty).toBe(2);
    await expect(firstValueFrom(api.updateStock(stock.id, { quantityTotal: 1 }))).rejects.toMatchObject({ code: 'insufficient_stock' });
    await expect(firstValueFrom(api.issue(1, { holder, bulk: [{ stockId: stock.id, qty: 1 }] }))).rejects.toMatchObject({ code: 'insufficient_stock' });
  });
  it('records partial returns separately and settles only the remaining loss', async () => {
    const { kit } = await kitWithRibbons();
    const loan = await firstValueFrom(api.issue(1, { holder, kitId: kit.id }));
    await firstValueFrom(api.returnLoan(loan.id, { lines: [{ lineId: loan.lines[0].id, returnedQty: 1, closeType: 'returned', note: 'First' }] }));
    const result = await firstValueFrom(api.returnLoan(loan.id, { lines: [{ lineId: loan.lines[0].id, returnedQty: 0, closeType: 'settled', note: 'Lost second' }] }));
    expect(result.lines[0]).toMatchObject({ qty: 2, returnedQty: 1, closeType: 'settled' });
    expect(result.returns.map((r) => [r.qty, r.lostQty, r.note])).toEqual([[1, 0, 'First'], [0, 1, 'Lost second']]);
    expect((await firstValueFrom(api.stocks(1))).items[0]).toMatchObject({ quantityTotal: 1, quantityInKits: 1, quantityAvailable: 0 });
    expect((await firstValueFrom(api.kit(kit.id))).bulkLines[0]).toMatchObject({ requiredQty: 2, presentQty: 1 });
    expect((await firstValueFrom(api.movements(1, { person: 3 }))).total).toBe(3);
  });
  it('retires a lost piece without recording a return and requires a reason', async () => {
    const loan = await issuePiece();
    await expect(firstValueFrom(api.returnLoan(loan.id, { lines: [{ lineId: loan.lines[0].id, returnedQty: 0, closeType: 'settled' }] }))).rejects.toMatchObject({ code: 'validation_failed' });
    const result = await firstValueFrom(api.returnLoan(loan.id, { lines: [{ lineId: loan.lines[0].id, returnedQty: 0, closeType: 'settled', note: 'Lost' }] }));
    expect(result.lines[0].returnedQty).toBe(0);
    expect(await firstValueFrom(api.item(loan.lines[0].itemId!))).toMatchObject({ available: false, holder: null, retireReason: 'Lost' });
  });
  it('rolls back the whole batch on a late error and rejects duplicate lines', async () => {
    const loan = await issuePiece();
    const line = { lineId: loan.lines[0].id, returnedQty: 1, closeType: 'returned' as const, condition: 'damaged' as const };
    await expect(firstValueFrom(api.returnLoan(loan.id, { lines: [line, { ...line, lineId: 999 }] }))).rejects.toMatchObject({ code: 'not_found' });
    expect((await firstValueFrom(api.loan(loan.id))).returns).toEqual([]);
    expect((await firstValueFrom(api.item(loan.lines[0].itemId!))).condition).toBe('ok');
    await expect(firstValueFrom(api.returnLoan(loan.id, { lines: [line, line] }))).rejects.toMatchObject({ code: 'validation_failed' });
  });
  it('exchanges atomically, links handovers and rolls back if the replacement is unavailable', async () => {
    const loan = await issuePiece(), replacement = await piece();
    await firstValueFrom(api.issue(1, { holder, items: [replacement.id] }));
    await expect(firstValueFrom(api.exchange(loan.id, { lineId: loan.lines[0].id, itemId: replacement.id, condition: 'damaged' }))).rejects.toMatchObject({ code: 'item_unavailable' });
    expect((await firstValueFrom(api.loan(loan.id))).lines[0].closedAt).toBeNull();
    expect((await firstValueFrom(api.item(loan.lines[0].itemId!))).condition).toBe('ok');
    const available = await piece();
    const next = await firstValueFrom(api.exchange(loan.id, { lineId: loan.lines[0].id, itemId: available.id }));
    expect(next.replacesLoanId).toBe(loan.id);
    expect((await firstValueFrom(api.loan(loan.id))).lines[0].closeType).toBe('exchanged');
  });
  it('rejects foreign fund stock and pieces without recording a handover', async () => {
    const item = await piece();
    await expect(firstValueFrom(api.issue(2, { holder, items: [item.id] }))).rejects.toMatchObject({ code: 'not_found' });
    expect((await firstValueFrom(api.loans(2))).total).toBe(0);
  });
  it('checks the reviewed kit version and snapshots explicit bulk exceptions', async () => {
    const { kit, stock } = await kitWithRibbons();
    await expect(firstValueFrom(api.issue(1, { holder, kitId: kit.id, kitVersion: 9 }))).rejects.toMatchObject({ code: 'version_conflict' });
    const loan = await firstValueFrom(api.issue(1, { holder, kitId: kit.id, kitVersion: 2, kitBulk: [{ stockId: stock.id, qty: 1 }], note: 'One ribbon handed over' }));
    expect(loan.lines[0].qty).toBe(1);
    expect((await firstValueFrom(api.kit(kit.id))).bulkLines[0].presentQty).toBe(2);
  });

});

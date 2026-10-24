import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { describe, expect, it, beforeEach } from 'vitest';
import { CatalogApi } from '../catalog/catalog-api';
import { OrganizationApi } from '../organization/organization-api';
import { MockOrganizationApi } from '../organization/mock-organization-api';
import { MockInventoryApi } from './mock-inventory-api';

describe('Mock inventory workflows', () => {
  let api: MockInventoryApi, organization: OrganizationApi;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [MockInventoryApi, { provide: OrganizationApi, useClass: MockOrganizationApi },
      { provide: CatalogApi, useValue: { series: () => of([
        { id: 1, kind: 'part', name: 'Shirts', partTypeId: 1, regionId: null, gender: 'male', variant: null, archived: false, allowNumberReuse: true },
        { id: 2, kind: 'kit', name: 'Bags', partTypeId: null, regionId: null, gender: 'female', variant: null, archived: false, allowNumberReuse: true },
      ]), partTypes: () => of([{ id: 1, name: 'Shirt', gender: 'male', numbered: true, regionId: null, archived: false }, { id: 2, name: 'Ribbon', gender: null, numbered: false, regionId: null, archived: false }]), regions: () => of([]) } },
    ] }); api = TestBed.inject(MockInventoryApi); organization = TestBed.inject(OrganizationApi);
  });
  const piece = (number = '03') => firstValueFrom(api.createItem(1, { seriesId: 1, number, location: 'store' }));
  const create = () => firstValueFrom(api.createInventory(1, { name: 'Autumn', scope: {} }));

  it('freezes scope and requires an explicit noted versioned addition', async () => {
    const item = await piece(), preview = await firstValueFrom(api.inventoryPreview(1, {}));
    expect(preview.unloanedItemCount).toBe(1); expect((await firstValueFrom(api.inventories(1))).total).toBe(0);
    const inventory = await create(), newItem = await piece('04');
    expect((await firstValueFrom(api.inventoryCollection(inventory.id, 'targets'))).items.map((t) => t.itemId)).toEqual([item.id]);
    await expect(firstValueFrom(api.addInventoryTarget(inventory.id, { version: 1, itemId: newItem.id, note: '' }))).rejects.toMatchObject({ code: 'validation_failed' });
    const expanded = await firstValueFrom(api.addInventoryTarget(inventory.id, { version: 1, itemId: newItem.id, note: 'New acquisition' }));
    expect(expanded.progress.expectedQuantity).toBe(2); expect(expanded.version).toBe(2);
    await expect(firstValueFrom(api.addInventoryTarget(inventory.id, { version: 2, itemId: newItem.id, note: 'Again' }))).rejects.toMatchObject({ code: 'inventory_target_exists' });
  });
  it('keeps physical coverage and later absence independently and freezes a clean closure after cancellation', async () => {
    const item = await piece(), inventory = await create(), target = (await firstValueFrom(api.inventoryCollection(inventory.id, 'targets'))).items[0];
    await firstValueFrom(api.checkInventory(inventory.id, { version: 1, mode: 'store', entries: [{ targetId: target.id, result: 'found' }] }));
    const absent = await firstValueFrom(api.checkInventory(inventory.id, { version: 2, mode: 'store', entries: [{ targetId: target.id, result: 'not_found' }] }));
    expect(absent.inventory.progress.verifiedQuantity).toBe(1); expect(absent.inventory.progress.canCloseCleanly).toBe(false);
    await expect(firstValueFrom(api.closeInventory(inventory.id, { version: 3, closedWithIssues: false }))).rejects.toMatchObject({ code: 'inventory_has_issues' });
    await firstValueFrom(api.cancelInventoryCheck(absent.results[0].check!.id, 3));
    const closed = await firstValueFrom(api.closeInventory(inventory.id, { version: 4, closedWithIssues: false }));
    await firstValueFrom(api.updateItem(item.id, { version: item.version, condition: 'damaged', number: 'Renamed' }));
    await firstValueFrom(api.createWorkOrder(item.id, { type: 'repair', description: 'Later repair' }));
    expect(await firstValueFrom(api.inventory(inventory.id))).toEqual(closed);
    expect((await firstValueFrom(api.inventoryCollection(inventory.id, 'targets'))).items[0].snapshot['number']).toBe('03');
    expect((await firstValueFrom(api.inventoryCollection(inventory.id, 'checks'))).total).toBe(2);
    expect((await firstValueFrom(api.inventoryCollection(inventory.id, 'issues'))).items).toEqual([]);
  });
  it('reports warehouse conflicts without returning a loan or relocating a piece', async () => {
    const item = await piece(), inventory = await create();
    const loan = await firstValueFrom(api.issue(1, { holder: { personId: 3 }, items: [item.id] }));
    const batch = { version: 1, mode: 'store' as const, entries: [{ seriesId: 1, number: '03', result: 'found' as const, confirmConflict: true, note: 'Seen' }] };
    expect((await firstValueFrom(api.checkInventory(inventory.id, batch))).results[0].code).toBe('loaned_to');
    expect((await firstValueFrom(api.loan(loan.id))).returns).toEqual([]);
    await firstValueFrom(api.returnLoan(loan.id, { lines: [{ lineId: loan.lines[0].id, returnedQty: 1, closeType: 'returned', location: 'repair' }] }));
    batch.entries[0].confirmConflict = false;
    expect((await firstValueFrom(api.checkInventory(inventory.id, batch))).results[0].code).toBe('not_in_store');
    batch.entries[0].confirmConflict = true;
    expect((await firstValueFrom(api.checkInventory(inventory.id, batch))).results[0].code).toBe('ok');
    expect((await firstValueFrom(api.item(item.id))).location).toBe('repair');
    expect((await firstValueFrom(api.checkInventory(inventory.id, { ...batch, version: 2 }))).results[0].code).toBe('already_checked');
  });
  it('counts bulk contexts once across a kit handover and later composition removal', async () => {
    const kit = await firstValueFrom(api.createKit(1, { seriesId: 2, number: '1' })), stock = await firstValueFrom(api.createStock(1, { partTypeId: 2, quantityTotal: 3 }));
    await firstValueFrom(api.composition(kit.id, { version: 1, action: 'add', bulkStockId: stock.id, requiredQty: 2, presentQty: 2 }));
    await firstValueFrom(api.issue(1, { holder: { personId: 3 }, kitId: kit.id }));
    await firstValueFrom(api.composition(kit.id, { version: 2, action: 'remove', bulkStockId: stock.id }));
    const inventory = await create(), targets = (await firstValueFrom(api.inventoryCollection(inventory.id, 'targets'))).items.filter((t) => t.bulkStockId === stock.id);
    expect(targets.map((t) => t.expectedQty).sort()).toEqual([1, 2]); expect(inventory.progress.expectedQuantity).toBe(0);
    const free = targets.find((t) => t.loanLineId === null)!;
    await firstValueFrom(api.updateStock(stock.id, { quantityTotal: 4 }));
    const checked = await firstValueFrom(api.checkInventory(inventory.id, { version: 1, mode: 'store', entries: [{ targetId: free.id, result: 'found', checkedQty: 2 }] }));
    expect(checked.results[0].check?.context.expectedQty).toBe(2); expect(checked.inventory.progress.verifiedQuantity).toBe(0);
    expect(checked.inventory.progress.issues.some((i) => i.kind === 'quantity_mismatch')).toBe(false);
  });
  it('intersects group and classification and preserves frozen targets after membership removal', async () => {
    const item = await piece(); await piece('04'); await firstValueFrom(api.issue(1, { holder: { personId: 3 }, items: [item.id] }));
    const inventory = await firstValueFrom(api.createInventory(1, { name: 'Musicians', scope: { groupId: 1, gender: 'male' } }));
    expect(inventory.progress.expectedQuantity).toBe(1);
    expect((await firstValueFrom(api.inventoryPreview(1, { groupId: 1, gender: 'female' }))).progress.expectedQuantity).toBe(0);
    await firstValueFrom(organization.revokeGroupMember(1, 1));
    expect((await firstValueFrom(api.inventoryPreview(1, { groupId: 1 }))).progress.expectedQuantity).toBe(0);
    expect((await firstValueFrom(api.inventoryCollection(inventory.id, 'targets'))).total).toBe(1);
  });
  it('enforces appointment capacity and preserves repeat completed visits without verifying pieces', async () => {
    const item = await piece(); await firstValueFrom(api.issue(1, { holder: { personId: 3 }, items: [item.id] })); const inventory = await create();
    const slot = await firstValueFrom(api.createInventorySlot(inventory.id, { version: 1, capacity: 1, startsAt: '2026-10-25T10:00:00Z', endsAt: '2026-10-25T10:30:00Z' }));
    const visit = await firstValueFrom(api.createInventoryVisit(inventory.id, { version: 2, personId: 3, slotId: slot.slot.id, status: 'completed' }));
    expect(visit.inventory.progress.visitedPeopleCount).toBe(1); expect(visit.inventory.progress.verifiedQuantity).toBe(0);
    await expect(firstValueFrom(api.createInventoryVisit(inventory.id, { version: 3, personId: 3, slotId: slot.slot.id }))).rejects.toMatchObject({ code: 'inventory_slot_full' });
    await expect(firstValueFrom(api.updateInventoryVisit(inventory.id, visit.visit.id, { version: 3, status: 'booked' }))).rejects.toMatchObject({ code: 'inventory_visit_closed' });
    const repeated = await firstValueFrom(api.createInventoryVisit(inventory.id, { version: 3, personId: 3, status: 'completed' }));
    expect(repeated.inventory.progress.visitedPeopleCount).toBe(1); expect((await firstValueFrom(api.inventoryCollection(inventory.id, 'visits'))).total).toBe(2);
  });
  it('links ordinary operations atomically and preserves immutable movement/work snapshots', async () => {
    const item = await piece(), inventory = await create(), context = { inventoryId: inventory.id, inventoryVersion: 1 };
    const loan = await firstValueFrom(api.issue(1, { holder: { personId: 3 }, items: [item.id], ...context }));
    expect(loan.lines[0].inventoryId).toBe(inventory.id);
    await expect(firstValueFrom(api.createWorkOrder(item.id, { type: 'repair', description: 'Seam', ...context }))).rejects.toMatchObject({ code: 'version_conflict' });
    const order = await firstValueFrom(api.createWorkOrder(item.id, { type: 'repair', description: 'Seam', ...context, inventoryVersion: 2 }));
    const closed = await firstValueFrom(api.closeInventory(inventory.id, { version: 3, closedWithIssues: true, reason: 'Repair remains' }));
    await firstValueFrom(api.updateWorkOrder(order.id, { status: 'done' }));
    expect(await firstValueFrom(api.inventory(inventory.id))).toEqual(closed);
    expect((await firstValueFrom(api.inventoryCollection(inventory.id, 'workOrders'))).items[0].status).toBe('open');
    expect((await firstValueFrom(api.movements(1, { inventoryId: inventory.id }))).total).toBe(1);
    await expect(firstValueFrom(api.returnLoan(loan.id, { lines: [{ lineId: loan.lines[0].id, returnedQty: 1, closeType: 'returned' }], ...context, inventoryVersion: 4 }))).rejects.toMatchObject({ code: 'inventory_closed' });
    expect((await firstValueFrom(api.loan(loan.id))).returns).toEqual([]);
  });
  it('rolls back a complete check batch and its events after a late validation failure', async () => {
    const item = await piece(), inventory = await create(), target = (await firstValueFrom(api.inventoryCollection(inventory.id, 'targets'))).items[0];
    await expect(firstValueFrom(api.checkInventory(inventory.id, { version: 1, mode: 'store', entries: [
      { targetId: target.id, result: 'found' }, { targetId: target.id, result: 'found', checkedQty: 1 },
    ] }))).rejects.toMatchObject({ code: 'validation_failed' });
    expect((await firstValueFrom(api.inventory(inventory.id))).version).toBe(1);
    expect((await firstValueFrom(api.inventoryCollection(inventory.id, 'checks'))).total).toBe(0);
    expect((await firstValueFrom(api.history(item.id))).items.filter((e) => e.event === 'inventory_checked')).toEqual([]);
  });
  it('links both sides of an exchange and a later actual return to the same open inventory', async () => {
    const first = await piece(), second = await piece('04'), inventory = await create();
    const loan = await firstValueFrom(api.issue(1, { holder: { personId: 3 }, items: [first.id] }));
    const replacement = await firstValueFrom(api.exchange(loan.id, { lineId: loan.lines[0].id, itemId: second.id, inventoryId: inventory.id, inventoryVersion: 1 }));
    expect((await firstValueFrom(api.loan(loan.id))).returns[0].inventoryId).toBe(inventory.id);
    expect(replacement.lines[0].inventoryId).toBe(inventory.id);
    const returned = await firstValueFrom(api.returnLoan(replacement.id, { inventoryId: inventory.id, inventoryVersion: 2,
      lines: [{ lineId: replacement.lines[0].id, returnedQty: 1, closeType: 'returned' }] }));
    expect(returned.returns[0].inventoryId).toBe(inventory.id);
    expect((await firstValueFrom(api.inventoryCollection(inventory.id, 'movements'))).total).toBe(3);
    expect((await firstValueFrom(api.inventory(inventory.id))).version).toBe(3);
  });
  it('physically verifies a handover to another unit without a fictional person or return', async () => {
    const item = await piece(); await firstValueFrom(api.issue(1, { holder: { unitId: 2 }, items: [item.id] }));
    const inventory = await create(), target = (await firstValueFrom(api.inventoryCollection(inventory.id, 'targets'))).items[0];
    const result = await firstValueFrom(api.checkInventory(inventory.id, { version: 1, mode: 'people', holderUnitId: 2, entries: [{ targetId: target.id, result: 'presented' }] }));
    expect(result.inventory.progress.verifiedQuantity).toBe(1); expect(result.inventory.progress.peopleCount).toBe(0);
    expect(result.results[0].check?.context).toMatchObject({ personId: null, holderUnitId: 2, holder: { unitId: 2 } });
    expect((await firstValueFrom(api.inventoryCollection(inventory.id, 'visits'))).items).toEqual([]);
  });
  it('records unexpected kit findings without changing intended membership or allocated stock', async () => {
    const item = await piece(), kit = await firstValueFrom(api.createKit(1, { seriesId: 2, number: '1' }));
    const stock = await firstValueFrom(api.createStock(1, { partTypeId: 2, quantityTotal: 3 })), inventory = await create();
    const target = (await firstValueFrom(api.inventoryCollection(inventory.id, 'targets'))).items.find((t) => t.itemId === item.id)!;
    const batch = { version: 1, mode: 'kit' as const, kitId: kit.id, entries: [{ targetId: target.id, result: 'found' as const }] };
    expect((await firstValueFrom(api.checkInventory(inventory.id, batch))).results[0].code).toBe('not_in_kit');
    const confirmed = await firstValueFrom(api.checkInventory(inventory.id, { ...batch, entries: [{ ...batch.entries[0], confirmConflict: true, note: 'Unexpected shirt' }] }));
    expect(confirmed.results[0].check?.context.confirmedCompositionConflict).toBe(true); expect((await firstValueFrom(api.item(item.id))).kitId).toBeNull();
    expect(confirmed.inventory.progress.issues.some((i) => i.kind === 'composition_mismatch')).toBe(true);
    await firstValueFrom(api.addInventoryTarget(inventory.id, { version: 2, bulkStockId: stock.id, contextKitId: kit.id, note: 'Unexpected ribbons' }));
    const bulk = (await firstValueFrom(api.inventoryCollection(inventory.id, 'targets'))).items.find((t) => t.bulkStockId === stock.id && t.contextKitId === kit.id)!;
    expect(bulk.expectedQty).toBe(0);
    const counted = await firstValueFrom(api.checkInventory(inventory.id, { version: 3, mode: 'kit', kitId: kit.id, entries: [{ targetId: bulk.id, result: 'found', checkedQty: 2 }] }));
    expect(counted.inventory.progress.issues.some((i) => i.kind === 'quantity_mismatch')).toBe(true);
    expect((await firstValueFrom(api.kit(kit.id))).bulkLines).toEqual([]);
    expect((await firstValueFrom(api.stocks(1))).items[0].quantityTotal).toBe(3);
  });
});

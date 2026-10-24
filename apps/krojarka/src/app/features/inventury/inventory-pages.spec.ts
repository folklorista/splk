import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of } from 'rxjs';
import { describe, beforeEach, expect, it, vi } from 'vitest';
import type * as Inv from '@splk/api-contracts';
import { inventoryProgress } from '@splk/domain';
import { InventoriesStore } from './inventories.store';
import { InventoriesPage } from './inventories-page';
import { InventoryDetailPage } from './inventory-detail-page';
import { InventoryCheckForm } from './inventory-check-form';

const target: Inv.InventoryTarget = { id: 1, inventoryId: 7, itemId: 3, kitId: null, bulkStockId: null, holderPersonId: 3, holderUnitId: null,
  contextKitId: null, loanLineId: 9, expectedQty: 1, snapshot: { label: 'Shirt 03', seriesId: 1, number: '03', kitId: null }, addedExplicitly: false, note: null };
const check: Inv.InventoryCheck = { id: 1, inventoryId: 7, targetId: 1, mode: 'store', result: 'found', condition: null, checkedQty: null,
  note: null, by: 1, at: '2026-10-24T10:00:00Z', cancelledAt: null, cancelledBy: null, context: {} };
const header: Inv.InventoryDetail = { id: 7, unitId: 1, name: 'Autumn', scope: {}, status: 'open', startedAt: '2026-10-24T10:00:00Z', startedBy: 1,
  closedAt: null, closedBy: null, closedWithIssues: false, closeReason: null, resultSnapshot: null, version: 1, progress: inventoryProgress([target], []) };
function fakeStore() {
  return { fund: signal({ unitId: 1, name: 'Vonica', canManage: true }), canManage: signal(true), detail: signal(header), preview: signal<Inv.InventoryPreview | null>(null),
    targets: signal([target]), checks: signal<Inv.InventoryCheck[]>([]), items: signal<{ id: number; kitId: number | null; loanId: number | null; seriesId?: number; number?: string | null }[]>([{ id: 3, kitId: null, loanId: null }]), kits: signal([]), stocks: signal([]), loans: signal([]), groups: signal([]), regions: signal([]), people: signal([]), units: signal([]),
    series: signal([{ id: 1, name: 'Shirts', kind: 'part' }]), types: signal([]), visits: signal<Inv.InventoryVisit[]>([]), slots: signal<Inv.InventorySlot[]>([]),
    open: vi.fn(async () => undefined), closeDetail: vi.fn(), reload: vi.fn(async () => undefined), loadKit: vi.fn(async () => undefined),
    invalidatePreview: vi.fn(), showPreview: vi.fn(async (_scope: Inv.InventoryScope) => undefined), create: vi.fn(async () => header),
    check: vi.fn(async (input: Omit<Inv.InventoryCheckBatch, 'version'>): Promise<Inv.InventoryCheckResponse> => ({ id: 7, inventory: header, results: input.entries.map((_e, i) => ({ code: 'ok', targetId: 1, check: { ...check, id: i + 1 } })) })),
    updateVisit: vi.fn(async () => ({ id: 7, inventory: header })), createSlot: vi.fn(async () => ({ id: 7, inventory: header, slot: { id: 8, inventoryId: 7, startsAt: '2026-10-25T10:00:00Z', endsAt: '2026-10-25T10:30:00Z', capacity: 3 } })),
    updateSlot: vi.fn(async (_id: number, _input: object, _version?: number) => ({ id: 7, inventory: header, slot: { id: 8, inventoryId: 7, startsAt: '2026-10-25T10:00:00Z', endsAt: '2026-10-25T10:30:00Z', capacity: 3 } })),
    personName: (id: number) => `Person ${id}`, targetLabel: (t: Inv.InventoryTarget) => String(t.snapshot['label']), holderLabel: () => 'Person 3',
  };
}
describe('Inventory page behavior', () => {
  let store: ReturnType<typeof fakeStore>, navigate: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    store = fakeStore(); navigate = vi.fn(async () => true); store.invalidatePreview.mockImplementation(() => store.preview.set(null));
    TestBed.configureTestingModule({ providers: [{ provide: InventoriesStore, useValue: store }, { provide: Router, useValue: { navigate } },
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: '7' })), snapshot: { queryParamMap: convertToParamMap({}) } } }] });
    for (const component of [InventoriesPage, InventoryDetailPage, InventoryCheckForm]) TestBed.overrideComponent(component, { set: { template: '' } });
  });
  it('requires a current scope preview before starting and invalidates it after a filter change', async () => {
    const fixture = TestBed.createComponent(InventoriesPage); fixture.detectChanges(); const page = fixture.componentInstance;
    page.name = 'Autumn'; page.groupId = 1; page.gender = 'male'; page.variant = ' Blue ';
    await page.start(); expect(store.create).not.toHaveBeenCalled();
    store.preview.set({ scope: page.scope(), progress: header.progress, unloanedItemCount: 0 });
    await page.start(); expect(store.create).toHaveBeenCalledWith({ name: 'Autumn', scope: { groupId: 1, gender: 'male', variant: 'Blue' } });
    expect(navigate).toHaveBeenCalledWith(['/inventury', 7]); page.groupId = 2; page.changed(); await page.start(); expect(store.create).toHaveBeenCalledTimes(1);
  });
  it('sends a parsed warehouse batch once and preserves every entry outcome', async () => {
    const fixture = TestBed.createComponent(InventoryDetailPage); fixture.detectChanges(); const page = fixture.componentInstance;
    page.seriesId = 1; page.quick = '1, 03, 7-9'; await page.quickCheck();
    expect(store.check).toHaveBeenCalledWith({ mode: 'store', entries: ['1', '03', '7', '8', '9'].map((number) => ({ seriesId: 1, number, result: 'found' })) });
    expect(page.outcomes.map((r) => r.label)).toEqual(['1', '03', '7', '8', '9']); expect(page.quick).toBe('');
    page.quick = '1-999999999'; await page.quickCheck(); expect(store.check).toHaveBeenCalledTimes(1); expect(page.quick).toBe('1-999999999');
  });
  it('shows shared physical evidence despite later absence and keeps returned pieces in the frozen holder view', () => {
    const fixture = TestBed.createComponent(InventoryDetailPage); fixture.detectChanges(); const page = fixture.componentInstance;
    store.checks.set([check, { ...check, id: 2, result: 'not_presented' }]);
    page.mode = 'people'; page.holder = 'person:3'; expect(page.visibleTargets()).toEqual([target]); expect(page.verified(target)).toBe(true); expect(page.latest(target)?.result).toBe('not_presented');
    page.mode = 'store'; expect(page.visibleTargets()).toEqual([target]);
    store.items.set([{ id: 3, kitId: null, loanId: 5 }]); expect(page.visibleTargets()).toEqual([]);
  });
  it('does not verify pieces when completing a visit and keeps the originally edited slot version', async () => {
    const fixture = TestBed.createComponent(InventoryDetailPage); fixture.detectChanges(); const page = fixture.componentInstance;
    const visit: Inv.InventoryVisit = { id: 4, inventoryId: 7, personId: 3, slotId: null, status: 'in_progress', completedAt: null };
    await page.visitStatus(visit, 'completed'); expect(store.updateVisit).toHaveBeenCalledWith(4, { status: 'completed' }); expect(store.check).not.toHaveBeenCalled();
    page.editSlot({ id: 8, inventoryId: 7, startsAt: '2026-10-25T10:00:00Z', endsAt: '2026-10-25T10:30:00Z', capacity: 3 });
    store.detail.set({ ...header, version: 2 }); await page.saveSlot(); expect(store.updateSlot).toHaveBeenCalledWith(8, expect.objectContaining({ capacity: 3 }), 1);
  });
  it('requires explicit physical result and manual bulk count without copying the expected quantity', async () => {
    const fixture = TestBed.createComponent(InventoryCheckForm); fixture.componentRef.setInput('target', { ...target, itemId: null, bulkStockId: 4, expectedQty: 2 }); fixture.componentRef.setInput('mode', 'store'); fixture.detectChanges();
    const page = fixture.componentInstance; expect(page.quantity).toBeNull(); await page.submit(); expect(store.check).not.toHaveBeenCalled();
    page.result = 'found'; page.quantity = 1; await page.submit();
    expect(store.check).toHaveBeenCalledWith({ mode: 'store', entries: [{ targetId: 1, result: 'found', checkedQty: 1, recheck: false, confirmConflict: false }] });
  });
  it('uses a unit holder without inventing a presenter and excludes a stale condition on absence', async () => {
    const fixture = TestBed.createComponent(InventoryCheckForm); fixture.componentRef.setInput('target', { ...target, holderPersonId: null, holderUnitId: 2 }); fixture.componentRef.setInput('mode', 'people'); fixture.componentRef.setInput('holder', 'unit:2'); fixture.detectChanges();
    const page = fixture.componentInstance; page.condition = 'damaged'; page.result = 'not_presented'; await page.submit();
    expect(store.check).toHaveBeenCalledWith({ mode: 'people', holderUnitId: 2, entries: [{ targetId: 1, result: 'not_presented', recheck: false, confirmConflict: false }] });
  });
  it('groups a reclassified piece under its current series while preserving the frozen identity', () => {
    const fixture = TestBed.createComponent(InventoryDetailPage); fixture.detectChanges(); const page = fixture.componentInstance;
    store.items.set([{ id: 3, kitId: null, loanId: null, seriesId: 2, number: '04' }]);
    page.seriesId = 1; expect(page.visibleTargets()).toEqual([]); page.seriesId = 2; expect(page.visibleTargets()).toEqual([target]);
    expect(page.targetGroups()[0].key).toBe('part:2'); expect(page.currentLabel(target)).toContain('04'); expect(target.snapshot['number']).toBe('03');
  });
});

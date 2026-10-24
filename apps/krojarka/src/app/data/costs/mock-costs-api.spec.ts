import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import type { CostInput, Mandate } from '@splk/api-contracts';
import { AuthService } from '../../core/auth/auth.service';
import { CatalogApi } from '../catalog/catalog-api';
import { InventoryApi } from '../inventory/inventory-api';
import { MockInventoryApi } from '../inventory/mock-inventory-api';
import { OrganizationApi } from '../organization/organization-api';
import { MockCostsApi } from './mock-costs-api';
describe('MockCostsApi', () => {
  let api: MockCostsApi, inventory: InventoryApi, user: ReturnType<typeof signal<{ account: { id: number }; mandates: Mandate[] }>>;
  let units: { id: number; name: string; hasCostumeFund: boolean; archived: boolean }[];
  beforeEach(() => {
    user = signal({ account: { id: 1 }, mandates: [1, 2].map((id) => ({ id, kind: 'costumes.manage', scopeType: 'unit', scopeId: id, scopeName: 'Fund' })) });
    units = [1, 2].map((id) => ({ id, name: `Fund ${id}`, hasCostumeFund: true, archived: false }));
    TestBed.configureTestingModule({ providers: [MockCostsApi, { provide: InventoryApi, useClass: MockInventoryApi }, { provide: AuthService, useValue: { user } },
      { provide: OrganizationApi, useValue: { units: () => of(units), persons: () => of([{ id: 3 }]) } },
      { provide: CatalogApi, useValue: { series: () => of([{ id: 1, name: 'Shirts', kind: 'part', partTypeId: 1, regionId: null }]), partTypes: () => of([{ id: 1, name: 'Shirt', numbered: true, regionId: null }]), regions: () => of([]) } },
    ] }); api = TestBed.inject(MockCostsApi); inventory = TestBed.inject(InventoryApi);
  });
  const input = (amount = '100', currency = 'CZK'): CostInput => ({ spentOn: '2026-10-24', amount, currency, description: 'Purchase' });
  const role = (kind: Mandate['kind'], scopeType: Mandate['scopeType'] = 'organization', scopeId: number | null = null) => user.set({ account: { id: 2 }, mandates: [{ id: 9, kind, scopeType, scopeId, scopeName: null }] });
  it('uses exact signed amounts and per-currency totals independently of page size', async () => {
    await firstValueFrom(api.create(1, input('0.1'))); await firstValueFrom(api.create(1, input('0.2'))); await firstValueFrom(api.create(2, input('-50.1234', 'EUR')));
    role('costs.view'); const page = await firstValueFrom(api.list({ limit: 1 })); expect(page.total).toBe(3); expect(page.items).toHaveLength(1);
    expect(page.totals).toEqual([{ currency: 'CZK', amount: '0.3000', count: 2 }, { currency: 'EUR', amount: '-50.1234', count: 1 }]);
    expect((await firstValueFrom(api.funds())).every((f) => !f.canManage)).toBe(true); await expect(firstValueFrom(api.create(1, input()))).rejects.toMatchObject({ code: 'forbidden' });
  });
  it('returns current linked object descriptions without creating movements or leaking holders', async () => {
    const item = await firstValueFrom(inventory.createItem(1, { seriesId: 1, number: '03' }));
    const cost = await firstValueFrom(api.create(1, { ...input(), links: [{ kind: 'item', targetId: item.id, qty: 1 }] }));
    await firstValueFrom(inventory.updateItem(item.id, { version: 1, description: 'New description' })); role('costs.view');
    const detail = await firstValueFrom(api.detail(cost.id)); expect(detail.links[0].object.description).toBe('New description'); expect(detail.links[0].object).not.toHaveProperty('holder'); expect(detail.links[0].object).not.toHaveProperty('available'); expect((await firstValueFrom(inventory.loans(1))).total).toBe(0);
    detail.description = 'Local edit'; expect((await firstValueFrom(api.detail(cost.id))).description).toBe('Purchase');
  });
  it('rejects foreign links, invalid precision and duplicate targets atomically', async () => {
    const own = await firstValueFrom(inventory.createItem(1, { seriesId: 1, number: '03' })), foreign = await firstValueFrom(inventory.createItem(2, { seriesId: 1, number: '04' }));
    await expect(firstValueFrom(api.create(1, { ...input(), links: [{ kind: 'item', targetId: own.id, qty: 1 }, { kind: 'item', targetId: foreign.id, qty: 1 }] }))).rejects.toMatchObject({ code: 'not_found' });
    for (const patch of [{ amount: '1.12345' }, { spentOn: '2026-02-31' }, { currency: 'EUR\n' }]) await expect(firstValueFrom(api.create(1, { ...input(), ...patch }))).rejects.toMatchObject({ code: 'validation_failed' });
    const link = { kind: 'item' as const, targetId: own.id, qty: 1 }; await expect(firstValueFrom(api.create(1, { ...input(), links: [link, link] }))).rejects.toMatchObject({ code: 'validation_failed' }); expect((await firstValueFrom(api.list())).total).toBe(0);
  });
  it('serializes edits and rejects stale versions without discarding existing links', async () => {
    const cost = await firstValueFrom(api.create(1, input())); const results = await Promise.allSettled([firstValueFrom(api.update(cost.id, { version: 1, amount: '-25' })), firstValueFrom(api.update(cost.id, { version: 1, amount: '999' }))]);
    expect(results[0].status).toBe('fulfilled'); expect(results[1]).toMatchObject({ status: 'rejected', reason: { code: 'version_conflict' } }); expect(await firstValueFrom(api.detail(cost.id))).toMatchObject({ amount: '-25.0000', version: 2, createdBy: 1 });
  });
  it('retains archived fund costs but denies writes and respects a revoked mandate', async () => {
    const cost = await firstValueFrom(api.create(1, input())); units[0].archived = true; expect((await firstValueFrom(api.funds()))[0].canManage).toBe(false); expect((await firstValueFrom(api.detail(cost.id))).id).toBe(cost.id); await expect(firstValueFrom(api.update(cost.id, { version: 1, amount: '2' }))).rejects.toMatchObject({ code: 'not_found' });
    role('organization.admin'); await expect(firstValueFrom(api.list())).rejects.toMatchObject({ code: 'forbidden' }); await expect(firstValueFrom(api.detail(cost.id))).rejects.toMatchObject({ code: 'not_found' });
  });
  it('exports all filtered records as real CSV with signed money and protected user formulas', async () => {
    await firstValueFrom(api.create(1, { ...input('-25', 'EUR'), description: '=HYPERLINK("bad")' })); await firstValueFrom(api.create(1, input()));
    const csv = await firstValueFrom(api.csv({ currency: 'EUR', limit: 1 })); const text = await csv.text(); expect(text).toContain(';-25.0000;EUR;'); expect(text).toContain("'=HYPERLINK"); expect(text).not.toContain(';CZK;');
  });
});

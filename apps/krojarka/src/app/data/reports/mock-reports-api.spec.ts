import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import type { Mandate } from '@splk/api-contracts';
import { AuthService } from '../../core/auth/auth.service';
import { CatalogApi } from '../catalog/catalog-api';
import { InventoryApi } from '../inventory/inventory-api';
import { MockInventoryApi } from '../inventory/mock-inventory-api';
import { OrganizationApi } from '../organization/organization-api';
import { PeopleApi } from '../people/people-api';
import { MockReportsApi } from './mock-reports-api';
describe('MockReportsApi', () => {
  let api: MockReportsApi, inventory: InventoryApi, mandates: Mandate[];
  beforeEach(() => {
    mandates = [{ id: 1, kind: 'costumes.view', scopeType: 'unit', scopeId: 1, scopeName: 'Fund' }];
    TestBed.configureTestingModule({ providers: [MockReportsApi, { provide: InventoryApi, useClass: MockInventoryApi },
      { provide: AuthService, useValue: { user: () => ({ mandates }) } },
      { provide: OrganizationApi, useValue: { units: () => of([{ id: 1, name: 'Fund', hasCostumeFund: true }, { id: 2, name: 'Other', hasCostumeFund: true }]), persons: () => of([{ id: 3 }]) } },
      { provide: PeopleApi, useValue: { people: () => of({ items: [{ id: 3, firstName: 'Lojza', lastName: 'Novák', nickname: null, contact: 'Private phone' }], total: 1 }) } },
      { provide: CatalogApi, useValue: { series: () => of([{ id: 1, name: 'Kopaničká košile', kind: 'part', partTypeId: 1, regionId: null }, { id: 2, name: 'Tašky', kind: 'kit', regionId: null }]), partTypes: () => of([{ id: 1, numbered: true, regionId: null }]), regions: () => of([]) } },
    ] }); api = TestBed.inject(MockReportsApi); inventory = TestBed.inject(InventoryApi);
  });
  it('uses the shared physical registry, exact identifiers, filtered dates and paper provenance', async () => {
    const item = await firstValueFrom(inventory.createItem(1, { seriesId: 1, number: '03', condition: 'damaged', acquiredOn: '2020-03-03' }));
    await firstValueFrom(inventory.migratePaper(1, 3, { entries: [{ itemId: item.id }] }));
    const report = await firstValueFrom(api.report(1, 'person', 3)); expect(report.sections[0].rows[0][6]).toContain('Převzato z papíru'); expect(report.sections[0].rows[0][7]).toBeNull(); expect(JSON.stringify(report)).not.toContain('Private phone');
    expect((await firstValueFrom(api.report(1, 'items', undefined, { acquiredFrom: '2021-01-01' }))).sections[0].rows).toEqual([]);
    const csv = await firstValueFrom(api.csv(1, 'series', 1)); expect(await csv.text()).toContain('03'); expect(await csv.text()).toContain('Lojza Novák');
  });
  it('finds accent-insensitive tokens but hides physical objects in an unauthorized fund', async () => {
    const item = await firstValueFrom(inventory.createItem(1, { seriesId: 1, number: '03' })); await firstValueFrom(inventory.createItem(2, { seriesId: 1, number: '9' }));
    expect((await firstValueFrom(api.search({ q: 'kopanicka kosile 03' }))).items[0].id).toBe(item.id);
    expect((await firstValueFrom(api.search({ q: '%' }))).total).toBe(0); expect((await firstValueFrom(api.search({ q: 'kosile 9' }))).total).toBe(0);
    await expect(firstValueFrom(api.report(2, 'items'))).rejects.toMatchObject({ code: 'not_found' }); await expect(firstValueFrom(api.search({ q: '9', fund: 2 }))).rejects.toMatchObject({ code: 'not_found' });
    mandates = []; await expect(firstValueFrom(api.search({ q: 'Lojza' }))).rejects.toMatchObject({ code: 'forbidden' });
  });
  it('filters active work without presenting completed repairs as open', async () => {
    const item = await firstValueFrom(inventory.createItem(1, { seriesId: 1, number: '03' }));
    const order = await firstValueFrom(inventory.createWorkOrder(item.id, { type: 'repair', description: 'Repair' }));
    expect((await firstValueFrom(api.report(1, 'work-orders', undefined, { status: 'active' }))).sections[0].rows).toHaveLength(1);
    await firstValueFrom(inventory.updateWorkOrder(order.id, { status: 'done' }));
    expect((await firstValueFrom(api.report(1, 'work-orders', undefined, { status: 'active' }))).sections[0].rows).toEqual([]);
    expect((await firstValueFrom(api.report(1, 'work-orders', undefined, { status: 'done' }))).sections[0].rows).toHaveLength(1);
  });
  it('distinguishes kit series from individual piece series without implying physical presence', async () => {
    const kit = await firstValueFrom(inventory.createKit(1, { seriesId: 2, number: 'A' }));
    const report = await firstValueFrom(api.report(1, 'series', 2)); expect(report.sections[0].rows[0][0]).toBe(kit.id); expect(report.sections[0].title).toContain('není fyzické ověření');
  });
});

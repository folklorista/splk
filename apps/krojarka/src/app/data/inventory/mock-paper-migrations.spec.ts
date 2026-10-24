import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { CatalogApi } from '../catalog/catalog-api';
import { OrganizationApi } from '../organization/organization-api';
import { MockInventoryApi } from './mock-inventory-api';

describe('Mock paper migration', () => {
  let api: MockInventoryApi;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [MockInventoryApi,
      { provide: CatalogApi, useValue: { series: () => of([{ id: 1, name: 'Shirts', regionId: null, kind: 'part', partTypeId: 1, allowNumberReuse: true }]), partTypes: () => of([{ id: 1, regionId: null, numbered: true }]), regions: () => of([]) } },
      { provide: OrganizationApi, useValue: { persons: () => of([{ id: 3 }, { id: 4 }]), units: () => of([]) } },
    ] }); api = TestBed.inject(MockInventoryApi);
  });
  const piece = (number = '03') => firstValueFrom(api.createItem(1, { seriesId: 1, number, condition: 'damaged' }));
  it('reserves without a physical issue, preserves condition, then permits the ordinary return', async () => {
    const item = await piece(); const result = await firstValueFrom(api.migratePaper(1, 3, { entries: [{ itemId: item.id }] }));
    const loan = await firstValueFrom(api.loan(result.results[0].loanId!));
    expect(loan).toMatchObject({ origin: 'paper_migration', issuedAt: null, issuedBy: null, originalIssuedOn: null, migratedBy: 1 });
    expect(loan.migratedAt).toBeTruthy(); expect(await firstValueFrom(api.item(item.id))).toMatchObject({ holder: { personId: 3 }, available: false, condition: 'damaged', location: 'unknown', version: 1 });
    expect((await firstValueFrom(api.movements(1))).items[0].type).toBe('paper_migration');
    await firstValueFrom(api.returnLoan(loan.id, { lines: [{ lineId: loan.lines[0].id, returnedQty: 1, closeType: 'returned' }] }));
    expect(await firstValueFrom(api.loan(loan.id))).toMatchObject({ origin: 'paper_migration', issuedAt: null }); expect((await firstValueFrom(api.item(item.id))).available).toBe(true);
    expect((await firstValueFrom(api.history(item.id))).items.map((e) => e.event)).not.toContain('issued');
  });
  it('serializes repeated imports and preserves historical dates separately', async () => {
    const item = await piece(); const input = { entries: [{ itemId: item.id, originalIssuedOn: '2020-04-01' }] };
    const results = await Promise.all([firstValueFrom(api.migratePaper(1, 3, input)), firstValueFrom(api.migratePaper(1, 3, input))]);
    expect(results.map((r) => r.results[0].status)).toEqual(['migrated', 'already_recorded']);
    const loans = await firstValueFrom(api.loans(1)); expect(loans.total).toBe(1); expect(loans.items[0]).toMatchObject({ originalIssuedOn: '2020-04-01', issuedAt: null });
  });
  it('retains ambiguous, missing, retired and conflicting entries without overwriting custody', async () => {
    const item = await piece(), old = await piece('7'); await firstValueFrom(api.retireItem(old.id, { version: 1, reason: 'Old' })); await piece('7');
    await firstValueFrom(api.issue(1, { holder: { personId: 4 }, items: [item.id] }));
    const result = await firstValueFrom(api.migratePaper(1, 3, { entries: [{ itemId: item.id }, { seriesId: 1, number: '99' }, { seriesId: 1, number: '7' }, { itemId: old.id }] }));
    expect(result.results.map((r) => r.status)).toEqual(['conflict', 'not_found', 'ambiguous', 'item_retired']); expect((await firstValueFrom(api.paperFindings(1, 3))).total).toBe(4);
    expect((await firstValueFrom(api.item(item.id))).holder).toEqual({ personId: 4 });
  });
  it('rolls back an earlier import if a later entry is invalid or outside the fund', async () => {
    const item = await piece(); await expect(firstValueFrom(api.migratePaper(1, 3, { entries: [{ itemId: item.id }, { seriesId: 99, number: '8' }] }))).rejects.toMatchObject({ code: 'not_found' });
    expect((await firstValueFrom(api.loans(1))).total).toBe(0); expect((await firstValueFrom(api.history(item.id))).items).toHaveLength(1);
    await expect(firstValueFrom(api.migratePaper(1, 3, { entries: [{ itemId: item.id, originalIssuedOn: '2026-02-31' }] }))).rejects.toMatchObject({ code: 'validation_failed' });
  });
});

import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { Region } from '@splk/api-contracts';
import { ApiError } from '../../data/api-error';
import { CatalogApi } from '../../data/catalog/catalog-api';
import { Fund, FundContext } from '../../core/fund/fund-context';
import { CatalogStore } from './catalog.store';

const regions: Region[] = [
  { id: 3, name: 'Slovensko', parentId: null, archived: false },
  { id: 4, name: 'Zemplín', parentId: 3, archived: false },
  { id: 1, name: 'Horňácko', parentId: null, archived: false },
];

describe('CatalogStore', () => {
  const current = signal<Fund | null>({ unitId: 1, name: 'Vonica', canManage: true });
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let store: CatalogStore;

  beforeEach(async () => {
    api = {
      regions: vi.fn(() => of(regions)),
      partTypes: vi.fn(() => of([])),
      series: vi.fn(() => of([])),
      createRegion: vi.fn((_unit: number, input) => of({ id: 9, ...input, archived: false })),
      updateRegion: vi.fn(() => throwError(() => new ApiError(422, 'duplicate_name'))),
    };
    TestBed.configureTestingModule({
      providers: [CatalogStore, { provide: CatalogApi, useValue: api }, { provide: FundContext, useValue: { current } }],
    });
    store = TestBed.inject(CatalogStore);
    TestBed.tick();
    await vi.waitFor(() => expect(store.regions().length).toBe(3));
  });

  it('loads the catalog of the selected fund and reloads when the fund changes', async () => {
    expect(api['regions']).toHaveBeenCalledWith(1);

    current.set({ unitId: 2, name: 'Malá Vonica', canManage: false });
    TestBed.tick();
    await vi.waitFor(() => expect(api['regions']).toHaveBeenCalledWith(2));
    expect(store.canManage()).toBe(false);
    current.set({ unitId: 1, name: 'Vonica', canManage: true });
  });

  it('orders regions as a tree and names areas with their region', () => {
    expect(store.regionTree().map((r) => [r.region.name, r.depth])).toEqual([
      ['Slovensko', 0],
      ['Zemplín', 1],
      ['Horňácko', 0],
    ]);
    expect(store.regionName(4)).toBe('Slovensko – Zemplín');
    expect(store.regionName(null)).toBe('univerzální');
  });

  it('adds created rows to the list and rethrows API errors for the form', async () => {
    await store.createRegion({ name: 'Zálesí', parentId: null });
    expect(store.regions().map((r) => r.name)).toContain('Zálesí');
    expect(api['createRegion']).toHaveBeenCalledWith(1, { name: 'Zálesí', parentId: null });

    await expect(store.updateRegion(1, { name: 'Slovensko' })).rejects.toMatchObject({ code: 'duplicate_name' });
  });
});

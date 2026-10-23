import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import {
  PartType,
  PartTypeInput,
  PartTypePatch,
  Region,
  RegionInput,
  RegionPatch,
  Series,
  SeriesCreateInput,
  SeriesPatch,
} from '@splk/api-contracts';
import { CatalogApi } from '../../data/catalog/catalog-api';
import { errorMessage } from '../../core/auth/error-messages';
import { FundContext } from '../../core/fund/fund-context';

/**
 * Catalog of the selected fund for the Nastavení pages: loads on fund change and keeps the lists in sync after writes.
 * Provided per page so each visit starts fresh.
 */
@Injectable()
export class CatalogStore {
  private readonly api = inject(CatalogApi);
  private readonly fundContext = inject(FundContext);

  readonly fund = this.fundContext.current;
  readonly canManage = computed(() => this.fund()?.canManage ?? false);
  readonly regions = signal<Region[]>([]);
  readonly partTypes = signal<PartType[]>([]);
  readonly series = signal<Series[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly activeRegions = computed(() => this.regions().filter((r) => !r.archived));
  /** top-level regions first, each followed by its areas */
  readonly regionTree = computed(() => {
    const regions = this.regions();
    return regions
      .filter((r) => r.parentId === null)
      .flatMap((parent) => [{ region: parent, depth: 0 }, ...regions.filter((r) => r.parentId === parent.id).map((region) => ({ region, depth: 1 }))]);
  });

  constructor() {
    effect(() => {
      const fund = this.fund();
      untracked(() => (fund ? void this.load(fund.unitId) : this.clear()));
    });
  }

  regionName(id: number | null): string {
    if (id === null) {
      return 'univerzální';
    }
    const region = this.regions().find((r) => r.id === id);
    const parent = region?.parentId ? this.regions().find((r) => r.id === region.parentId) : undefined;
    return region ? (parent ? `${parent.name} – ${region.name}` : region.name) : '?';
  }

  partTypeName(id: number | null): string {
    return this.partTypes().find((t) => t.id === id)?.name ?? '';
  }

  createRegion(input: RegionInput): Promise<void> {
    return this.write((unitId) => this.api.createRegion(unitId, input), (region) => this.regions.update((list) => [...list, region]));
  }

  updateRegion(id: number, patch: RegionPatch): Promise<void> {
    return this.write((unitId) => this.api.updateRegion(unitId, id, patch), (region) => this.regions.update((list) => replace(list, region)));
  }

  createPartType(input: PartTypeInput): Promise<void> {
    return this.write((unitId) => this.api.createPartType(unitId, input), (type) => this.partTypes.update((list) => [...list, type]));
  }

  updatePartType(id: number, patch: PartTypePatch): Promise<void> {
    return this.write((unitId) => this.api.updatePartType(unitId, id, patch), (type) => this.partTypes.update((list) => replace(list, type)));
  }

  createSeries(input: SeriesCreateInput): Promise<void> {
    return this.write((unitId) => this.api.createSeries(unitId, input), (series) => this.series.update((list) => [...list, series]));
  }

  updateSeries(id: number, patch: SeriesPatch): Promise<void> {
    return this.write((unitId) => this.api.updateSeries(unitId, id, patch), (series) => this.series.update((list) => replace(list, series)));
  }

  private async load(unitId: number): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [regions, partTypes, series] = await Promise.all([
        firstValueFrom(this.api.regions(unitId)),
        firstValueFrom(this.api.partTypes(unitId)),
        firstValueFrom(this.api.series(unitId)),
      ]);
      if (this.fund()?.unitId === unitId) {
        this.regions.set(regions);
        this.partTypes.set(partTypes);
        this.series.set(series);
      }
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  private clear(): void {
    this.regions.set([]);
    this.partTypes.set([]);
    this.series.set([]);
  }

  /** Errors are rethrown so the form that started the write can show them next to itself. */
  private async write<T>(request: (unitId: number) => Observable<T>, apply: (value: T) => void): Promise<void> {
    const fund = this.fund();
    if (!fund) {
      throw new Error('No fund selected');
    }
    apply(await firstValueFrom(request(fund.unitId)));
  }
}

function replace<T extends { id: number }>(list: T[], item: T): T[] {
  return list.map((existing) => (existing.id === item.id ? item : existing));
}

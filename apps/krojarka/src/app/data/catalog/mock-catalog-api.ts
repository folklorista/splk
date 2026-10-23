import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
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
import { mockFail, mockOk } from '../mock/mock-response';
import { CatalogApi } from './catalog-api';

interface FundCatalog {
  regions: Region[];
  partTypes: PartType[];
  series: Series[];
}

/** Small synthetic catalog of fund 1 with the API rules that matter for the UI (duplicates, numbering, immutability). */
function seedFund(): FundCatalog {
  const regions: Region[] = [
    { id: 1, name: 'Horňácko', parentId: null, archived: false },
    { id: 2, name: 'Kopanice', parentId: null, archived: false },
    { id: 3, name: 'Slovensko', parentId: null, archived: false },
    { id: 4, name: 'Zemplín', parentId: 3, archived: false },
    { id: 5, name: 'Moravské Lieskové', parentId: 3, archived: false },
  ];
  const partTypes: PartType[] = [
    { id: 1, name: 'košile', gender: 'male', regionId: 1, numbered: true, archived: false },
    { id: 2, name: 'pruclek', gender: 'male', regionId: 1, numbered: true, archived: false },
    { id: 3, name: 'strakaté rukávce', gender: 'female', regionId: 1, numbered: true, archived: false },
    { id: 4, name: 'kytička', gender: 'female', regionId: 1, numbered: false, archived: false },
    { id: 5, name: 'košile stuhová', gender: 'male', regionId: 4, numbered: true, archived: false },
    { id: 6, name: 'slovenské měkké', gender: 'female', regionId: null, numbered: true, archived: false },
  ];
  const series: Series[] = partTypes
    .filter((type) => type.numbered)
    .map((type, index) => ({
      id: index + 1,
      kind: 'part',
      name: type.name,
      partTypeId: type.id,
      regionId: type.regionId,
      gender: type.gender,
      variant: null,
      allowNumberReuse: true,
      archived: false,
    }));
  return { regions, partTypes, series };
}

@Injectable()
export class MockCatalogApi extends CatalogApi {
  private readonly funds = new Map<number, FundCatalog>([[1, seedFund()]]);
  private nextId = 100;

  regions(unitId: number): Observable<Region[]> {
    return mockOk(this.fund(unitId).regions);
  }

  createRegion(unitId: number, input: RegionInput): Observable<Region> {
    const fund = this.fund(unitId);
    if (this.duplicate(fund.regions, input.name, (r) => r.parentId === input.parentId)) {
      return mockFail(422, 'duplicate_name');
    }
    const region: Region = { id: this.nextId++, name: input.name.trim(), parentId: input.parentId, archived: false };
    fund.regions.push(region);
    return mockOk(region);
  }

  updateRegion(unitId: number, id: number, patch: RegionPatch): Observable<Region> {
    const region = this.fund(unitId).regions.find((r) => r.id === id);
    return region ? mockOk(Object.assign(region, patch)) : mockFail(404, 'not_found');
  }

  partTypes(unitId: number): Observable<PartType[]> {
    return mockOk(this.fund(unitId).partTypes);
  }

  createPartType(unitId: number, input: PartTypeInput): Observable<PartType> {
    const fund = this.fund(unitId);
    if (this.duplicate(fund.partTypes, input.name, (t) => t.gender === input.gender && t.regionId === input.regionId)) {
      return mockFail(422, 'duplicate_name');
    }
    const type: PartType = { id: this.nextId++, ...input, name: input.name.trim(), archived: false };
    fund.partTypes.push(type);
    return mockOk(type);
  }

  updatePartType(unitId: number, id: number, patch: PartTypePatch): Observable<PartType> {
    const type = this.fund(unitId).partTypes.find((t) => t.id === id);
    return type ? mockOk(Object.assign(type, patch)) : mockFail(404, 'not_found');
  }

  series(unitId: number): Observable<Series[]> {
    return mockOk(this.fund(unitId).series);
  }

  createSeries(unitId: number, input: SeriesCreateInput): Observable<Series> {
    const fund = this.fund(unitId);
    const type = fund.partTypes.find((t) => t.id === input.partTypeId);
    if (input.kind === 'part' && !type) {
      return mockFail(422, 'validation_failed', { field: 'partTypeId', reason: 'required' });
    }
    if (type && !type.numbered) {
      return mockFail(422, 'part_type_not_numbered');
    }
    const name = (input.name ?? type?.name ?? '').trim();
    if (!name) {
      return mockFail(422, 'validation_failed', { field: 'name', reason: 'required' });
    }
    const series: Series = {
      id: this.nextId++,
      kind: input.kind,
      name,
      partTypeId: type?.id ?? null,
      regionId: input.regionId !== undefined ? input.regionId : (type?.regionId ?? null),
      gender: input.gender !== undefined ? input.gender : (type?.gender ?? null),
      variant: input.variant?.trim() || null,
      allowNumberReuse: input.allowNumberReuse ?? true,
      archived: false,
    };
    const clash = fund.series.some(
      (s) => !s.archived && s.kind === series.kind && s.gender === series.gender && s.regionId === series.regionId &&
        s.name.toLowerCase() === name.toLowerCase() && (s.variant ?? '').toLowerCase() === (series.variant ?? '').toLowerCase(),
    );
    if (clash) {
      return mockFail(422, 'duplicate_name');
    }
    fund.series.push(series);
    return mockOk(series);
  }

  updateSeries(unitId: number, id: number, patch: SeriesPatch): Observable<Series> {
    const series = this.fund(unitId).series.find((s) => s.id === id);
    return series ? mockOk(Object.assign(series, patch)) : mockFail(404, 'not_found');
  }

  private fund(unitId: number): FundCatalog {
    let fund = this.funds.get(unitId);
    if (!fund) {
      fund = { regions: [], partTypes: [], series: [] };
      this.funds.set(unitId, fund);
    }
    return fund;
  }

  private duplicate<T extends { name: string; archived: boolean }>(rows: T[], name: string, sameScope: (row: T) => boolean): boolean {
    return rows.some((row) => !row.archived && sameScope(row) && row.name.toLowerCase() === name.trim().toLowerCase());
  }
}

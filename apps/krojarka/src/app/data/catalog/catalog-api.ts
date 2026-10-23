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

/** Catalog and series of one costume fund (Nastavení). Implemented by HttpCatalogApi and MockCatalogApi. */
export abstract class CatalogApi {
  abstract regions(unitId: number): Observable<Region[]>;
  abstract createRegion(unitId: number, input: RegionInput): Observable<Region>;
  abstract updateRegion(unitId: number, id: number, patch: RegionPatch): Observable<Region>;
  abstract partTypes(unitId: number): Observable<PartType[]>;
  abstract createPartType(unitId: number, input: PartTypeInput): Observable<PartType>;
  abstract updatePartType(unitId: number, id: number, patch: PartTypePatch): Observable<PartType>;
  abstract series(unitId: number): Observable<Series[]>;
  abstract createSeries(unitId: number, input: SeriesCreateInput): Observable<Series>;
  abstract updateSeries(unitId: number, id: number, patch: SeriesPatch): Observable<Series>;
}

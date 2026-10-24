import { Observable } from 'rxjs';
import type { CostumeCost, CostInput, CostPage, CostPatch, CostQuery, CostFund } from '@splk/api-contracts';
export abstract class CostsApi {
  abstract funds(): Observable<CostFund[]>;
  abstract list(query?: CostQuery): Observable<CostPage>;
  abstract detail(id: number): Observable<CostumeCost>;
  abstract create(unit: number, input: CostInput): Observable<CostumeCost>;
  abstract update(id: number, input: CostPatch): Observable<CostumeCost>;
  abstract csv(query?: CostQuery): Observable<Blob>;
}

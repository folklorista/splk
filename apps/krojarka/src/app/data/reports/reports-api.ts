import { Observable } from 'rxjs';
import type { CostumeReport, ReportKind, ReportQuery, SearchQuery, SearchPage } from '@splk/api-contracts';
export abstract class ReportsApi {
  abstract report(unit: number, kind: ReportKind, id?: number, query?: ReportQuery): Observable<CostumeReport>;
  abstract csv(unit: number, kind: ReportKind, id?: number, query?: ReportQuery): Observable<Blob>;
  abstract search(query: SearchQuery): Observable<SearchPage>;
}

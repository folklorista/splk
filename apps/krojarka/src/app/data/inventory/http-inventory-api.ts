import type { PaperMigrationRequest, PaperMigrationResult, PaperMigrationFindings, PageQuery as PaperPageQuery } from '@splk/api-contracts';
import type { CostumeLoan, LoanCreate, LoanIssueResult, LoanReturnInput, LoanExchangeInput, LoanPatch, LoanQuery, LoanMovement, MovementQuery } from '@splk/api-contracts';
import type * as Inv from '@splk/api-contracts';
import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import {
  BulkStock, BulkStockInput, BulkStockPatch, CompositionInput, CostumeItem, CostumeKit, ItemEvent,
  ItemInput, ItemPatch, ItemQuery, ItemRetireInput, KitDetail, KitInput, KitPatch, Page, PageQuery,
  WorkOrder, WorkOrderInput, WorkOrderPatch, WorkOrderStatus,
} from '@splk/api-contracts';
import { API_BASE_URL } from '../api-config';
import { ApiError } from '../api-error';
import { InventoryApi } from './inventory-api';

@Injectable()
export class HttpInventoryApi extends InventoryApi {
  migratePaper(unit: number, person: number, input: PaperMigrationRequest) { return this.write<PaperMigrationResult>('POST', `/funds/${unit}/people/${person}/paper-migrations`, input); }
  paperFindings(unit: number, person: number, query: PaperPageQuery = {}) { return this.get<PaperMigrationFindings>(`/funds/${unit}/people/${person}/paper-migration-findings`, query); }
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  inventories(unit: number, query: PageQuery = {}) { return this.get<Page<Inv.CostumeInventory>>(`/funds/${unit}/inventories`, query); }
  inventory(id: number) { return this.get<Inv.InventoryDetail>(`/inventories/${id}`); }
  inventoryPreview(unit: number, scope: Inv.InventoryScope) { return this.write<Inv.InventoryPreview>('POST', `/funds/${unit}/inventories/preview`, { scope }); }
  createInventory(unit: number, input: Inv.InventoryCreate) { return this.write<Inv.InventoryDetail>('POST', `/funds/${unit}/inventories`, input); }
  inventoryCollection<K extends keyof Inv.InventoryCollections>(id: number, kind: K, query: PageQuery = {}) { return this.get<Page<Inv.InventoryCollections[K]>>(`/inventories/${id}/${kind === 'workOrders' ? 'work-orders' : kind}`, query); }
  addInventoryTarget(id: number, input: Inv.InventoryTargetAdd) { return this.write<Inv.InventoryDetail>('POST', `/inventories/${id}/targets`, input); }
  checkInventory(id: number, input: Inv.InventoryCheckBatch) { return this.write<Inv.InventoryCheckResponse>('POST', `/inventories/${id}/checks`, input); }
  cancelInventoryCheck(id: number, version: number) { return this.http.delete<Inv.InventoryDetail>(`${this.base}/inventory-checks/${id}`, { params: { version } }).pipe(catchError((error: unknown) => throwError(() => ApiError.from(error)))); }
  createInventorySlot(id: number, input: Inv.InventorySlotInput) { return this.write<Inv.InventorySlotResponse>('POST', `/inventories/${id}/slots`, input); }
  updateInventorySlot(id: number, slot: number, input: Inv.InventorySlotPatch) { return this.write<Inv.InventorySlotResponse>('PATCH', `/inventories/${id}/slots/${slot}`, input); }
  createInventoryVisit(id: number, input: Inv.InventoryVisitInput) { return this.write<Inv.InventoryVisitResponse>('POST', `/inventories/${id}/visits`, input); }
  updateInventoryVisit(id: number, visit: number, input: Inv.InventoryVisitPatch) { return this.write<Inv.InventoryVisitResponse>('PATCH', `/inventories/${id}/visits/${visit}`, input); }
  closeInventory(id: number, input: Inv.InventoryClose) { return this.write<Inv.InventoryDetail>('POST', `/inventories/${id}/close`, input); }

  loans(unit: number, query: LoanQuery = {}) { return this.get<Page<CostumeLoan>>(`/funds/${unit}/loans`, query); }
  loan(id: number) { return this.get<CostumeLoan>(`/loans/${id}`); }
  issue(unit: number, input: LoanCreate) { return this.write<LoanIssueResult>('POST', `/funds/${unit}/loans`, input); }
  returnLoan(id: number, input: LoanReturnInput) { return this.write<CostumeLoan>('POST', `/loans/${id}/return`, input); }
  exchange(id: number, input: LoanExchangeInput) { return this.write<LoanIssueResult>('POST', `/loans/${id}/exchange`, input); }
  updateLoan(id: number, input: LoanPatch) { return this.write<CostumeLoan>('PATCH', `/loans/${id}`, input); }
  movements(unit: number, query: MovementQuery = {}) { return this.get<Page<LoanMovement>>(`/funds/${unit}/movements`, query); }

  items(unit: number, query: ItemQuery = {}) { return this.get<Page<CostumeItem>>(`/funds/${unit}/items`, query); }
  item(id: number) { return this.get<CostumeItem>(`/items/${id}`); }
  createItem(unit: number, input: ItemInput) { return this.write<CostumeItem>('POST', `/funds/${unit}/items`, input); }
  updateItem(id: number, input: ItemPatch) { return this.write<CostumeItem>('PATCH', `/items/${id}`, input); }
  retireItem(id: number, input: ItemRetireInput) { return this.write<CostumeItem>('POST', `/items/${id}/retire`, input); }
  history(id: number, query: PageQuery = {}) { return this.get<Page<ItemEvent>>(`/items/${id}/history`, query); }
  stocks(unit: number, query: PageQuery = {}) { return this.get<Page<BulkStock>>(`/funds/${unit}/bulk-stocks`, query); }
  createStock(unit: number, input: BulkStockInput) { return this.write<BulkStock>('POST', `/funds/${unit}/bulk-stocks`, input); }
  updateStock(id: number, input: BulkStockPatch) { return this.write<BulkStock>('PATCH', `/bulk-stocks/${id}`, input); }
  kits(unit: number, query: PageQuery & { series?: number; q?: string } = {}) { return this.get<Page<CostumeKit>>(`/funds/${unit}/kits`, query); }
  kit(id: number) { return this.get<KitDetail>(`/kits/${id}`); }
  createKit(unit: number, input: KitInput) { return this.write<KitDetail>('POST', `/funds/${unit}/kits`, input); }
  updateKit(id: number, input: KitPatch) { return this.write<KitDetail>('PATCH', `/kits/${id}`, input); }
  composition(id: number, input: CompositionInput) { return this.write<KitDetail>('POST', `/kits/${id}/composition`, input); }
  workOrders(id: number, query: PageQuery & { status?: WorkOrderStatus } = {}) { return this.get<Page<WorkOrder>>(`/items/${id}/work-orders`, query); }
  createWorkOrder(id: number, input: Inv.WorkOrderCreate) { return this.write<WorkOrder>('POST', `/items/${id}/work-orders`, input); }
  updateWorkOrder(id: number, input: WorkOrderPatch) { return this.write<WorkOrder>('PATCH', `/work-orders/${id}`, input); }

  private get<T>(path: string, query: object = {}): Observable<T> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) params = params.set(key, String(value));
    }
    return this.http.get<T>(this.base + path, { params }).pipe(catchError((error: unknown) => throwError(() => ApiError.from(error))));
  }

  private write<T>(method: 'POST' | 'PATCH', path: string, body: object): Observable<T> {
    return this.http.request<T>(method, this.base + path, { body }).pipe(catchError((error: unknown) => throwError(() => ApiError.from(error))));
  }
}

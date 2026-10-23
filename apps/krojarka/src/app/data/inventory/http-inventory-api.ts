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
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

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
  createWorkOrder(id: number, input: WorkOrderInput) { return this.write<WorkOrder>('POST', `/items/${id}/work-orders`, input); }
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

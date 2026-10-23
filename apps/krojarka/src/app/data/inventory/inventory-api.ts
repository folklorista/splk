import { Observable } from 'rxjs';
import {
  BulkStock, BulkStockInput, BulkStockPatch, CompositionInput, CostumeItem, CostumeKit, ItemEvent,
  ItemInput, ItemPatch, ItemQuery, ItemRetireInput, KitDetail, KitInput, KitPatch, Page, PageQuery,
  WorkOrder, WorkOrderInput, WorkOrderPatch, WorkOrderStatus,
} from '@splk/api-contracts';

export abstract class InventoryApi {
  abstract items(unitId: number, query?: ItemQuery): Observable<Page<CostumeItem>>;
  abstract item(id: number): Observable<CostumeItem>;
  abstract createItem(unitId: number, input: ItemInput): Observable<CostumeItem>;
  abstract updateItem(id: number, input: ItemPatch): Observable<CostumeItem>;
  abstract retireItem(id: number, input: ItemRetireInput): Observable<CostumeItem>;
  abstract history(id: number, query?: PageQuery): Observable<Page<ItemEvent>>;
  abstract stocks(unitId: number, query?: PageQuery): Observable<Page<BulkStock>>;
  abstract createStock(unitId: number, input: BulkStockInput): Observable<BulkStock>;
  abstract updateStock(id: number, input: BulkStockPatch): Observable<BulkStock>;
  abstract kits(unitId: number, query?: PageQuery & { series?: number; q?: string }): Observable<Page<CostumeKit>>;
  abstract kit(id: number): Observable<KitDetail>;
  abstract createKit(unitId: number, input: KitInput): Observable<KitDetail>;
  abstract updateKit(id: number, input: KitPatch): Observable<KitDetail>;
  abstract composition(id: number, input: CompositionInput): Observable<KitDetail>;
  abstract workOrders(itemId: number, query?: PageQuery & { status?: WorkOrderStatus }): Observable<Page<WorkOrder>>;
  abstract createWorkOrder(itemId: number, input: WorkOrderInput): Observable<WorkOrder>;
  abstract updateWorkOrder(id: number, input: WorkOrderPatch): Observable<WorkOrder>;
}

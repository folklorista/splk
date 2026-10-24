import type { CostumeLoan, LoanCreate, LoanIssueResult, LoanReturnInput, LoanExchangeInput, LoanPatch, LoanQuery, LoanMovement, MovementQuery } from '@splk/api-contracts';
import type * as Inv from '@splk/api-contracts';
import { Observable } from 'rxjs';
import {
  BulkStock, BulkStockInput, BulkStockPatch, CompositionInput, CostumeItem, CostumeKit, ItemEvent,
  ItemInput, ItemPatch, ItemQuery, ItemRetireInput, KitDetail, KitInput, KitPatch, Page, PageQuery,
  WorkOrder, WorkOrderInput, WorkOrderPatch, WorkOrderStatus,
} from '@splk/api-contracts';

export abstract class InventoryApi {
  abstract inventories(unitId: number, query?: PageQuery): Observable<Page<Inv.CostumeInventory>>;
  abstract inventory(id: number): Observable<Inv.InventoryDetail>;
  abstract inventoryPreview(unitId: number, scope: Inv.InventoryScope): Observable<Inv.InventoryPreview>;
  abstract createInventory(unitId: number, input: Inv.InventoryCreate): Observable<Inv.InventoryDetail>;
  abstract inventoryCollection<K extends keyof Inv.InventoryCollections>(id: number, kind: K, query?: PageQuery): Observable<Page<Inv.InventoryCollections[K]>>;
  abstract addInventoryTarget(id: number, input: Inv.InventoryTargetAdd): Observable<Inv.InventoryDetail>;
  abstract checkInventory(id: number, input: Inv.InventoryCheckBatch): Observable<Inv.InventoryCheckResponse>;
  abstract cancelInventoryCheck(id: number, version: number): Observable<Inv.InventoryDetail>;
  abstract createInventorySlot(id: number, input: Inv.InventorySlotInput): Observable<Inv.InventorySlotResponse>;
  abstract updateInventorySlot(id: number, slotId: number, input: Inv.InventorySlotPatch): Observable<Inv.InventorySlotResponse>;
  abstract createInventoryVisit(id: number, input: Inv.InventoryVisitInput): Observable<Inv.InventoryVisitResponse>;
  abstract updateInventoryVisit(id: number, visitId: number, input: Inv.InventoryVisitPatch): Observable<Inv.InventoryVisitResponse>;
  abstract closeInventory(id: number, input: Inv.InventoryClose): Observable<Inv.InventoryDetail>;
  abstract loans(unitId: number, query?: LoanQuery): Observable<Page<CostumeLoan>>;
  abstract loan(id: number): Observable<CostumeLoan>;
  abstract issue(unitId: number, input: LoanCreate): Observable<LoanIssueResult>;
  abstract returnLoan(id: number, input: LoanReturnInput): Observable<CostumeLoan>;
  abstract exchange(id: number, input: LoanExchangeInput): Observable<LoanIssueResult>;
  abstract updateLoan(id: number, input: LoanPatch): Observable<CostumeLoan>;
  abstract movements(unitId: number, query?: MovementQuery): Observable<Page<LoanMovement>>;
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
  abstract createWorkOrder(itemId: number, input: Inv.WorkOrderCreate): Observable<WorkOrder>;
  abstract updateWorkOrder(id: number, input: WorkOrderPatch): Observable<WorkOrder>;
}

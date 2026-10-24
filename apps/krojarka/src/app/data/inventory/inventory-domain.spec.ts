import { describe, expect, it } from 'vitest';
import { InventoryCheck, InventoryTarget } from '@splk/api-contracts';
import { inventoryProgress, NumberInputError, parseInventoryNumbers } from '@splk/domain';

describe('Inventory number parser', () => {
  it('expands ranges and preserves exact identifiers and repeats for server feedback', () => {
    expect(parseInventoryNumbers('1, 3; 12–15 03-05 A-7 1')).toEqual(['1', '3', '12', '13', '14', '15', '03', '04', '05', 'A-7', '1']);
  });
  it('rejects reversed, ambiguous, unsafe and oversized ranges before allocating them', () => {
    for (const input of ['15-12', '3-05', '1-999999999999999999', '1-201', '1-3-5', '<script>', '', ',;']) expect(() => parseInventoryNumbers(input)).toThrow(NumberInputError);
    expect(parseInventoryNumbers('1-200')).toHaveLength(200);
    expect(() => parseInventoryNumbers('1,2', 1)).toThrow(NumberInputError);
  });
});

const target: InventoryTarget = { id: 1, inventoryId: 2, itemId: 3, kitId: null, bulkStockId: null, holderPersonId: 4, holderUnitId: null,
  contextKitId: null, loanLineId: null, expectedQty: 1, snapshot: {}, addedExplicitly: false, note: null };
const check = (id: number, result: InventoryCheck['result']): InventoryCheck => ({ id, inventoryId: 2, targetId: 1, mode: 'store', result, condition: null,
  checkedQty: null, note: null, by: 1, at: '2026-10-24T12:00:00Z', cancelledAt: null, cancelledBy: null, context: {} });
describe('Inventory UI progress mirrors PHP D-63/D-64 cases', () => {
  it('keeps coverage and independent later absence; cancellation removes evidence', () => {
    const positive = check(1, 'found'), negative = check(2, 'not_found');
    const progress = inventoryProgress([target], [negative, positive]);
    expect(progress.verifiedQuantity).toBe(1); expect(progress.canCloseCleanly).toBe(false); expect(progress.issues.map((i) => i.kind)).toEqual(['not_found']);
    expect(inventoryProgress([target], [{ ...positive, cancelledAt: '2026-10-24T13:00:00Z' }, negative]).verifiedQuantity).toBe(0);
    expect(inventoryProgress([target], [positive, negative, check(3, 'found')]).canCloseCleanly).toBe(true);
  });
  it('excludes bulk and containers from numbered-item coverage and uses count at observation time', () => {
    const bulk = { ...target, itemId: null, bulkStockId: 5, expectedQty: 3 };
    const progress = inventoryProgress([bulk], [{ ...check(1, 'found'), checkedQty: 4, context: { expectedQty: 4 } }]);
    expect(progress.expectedQuantity).toBe(0); expect(progress.verifiedQuantity).toBe(0); expect(progress.comparedBulkTargetCount).toBe(1); expect(progress.issues).toEqual([]);
    const kit = { ...target, itemId: null, kitId: 6 };
    expect(inventoryProgress([kit], [check(1, 'found')])).toMatchObject({ expectedQuantity: 0, kitCount: 1, verifiedKitCount: 1 });
  });
  it('reports physical damage and open work while counting a physically seen piece once', () => {
    const progress = inventoryProgress([target], [{ ...check(1, 'found'), condition: 'damaged' }], [], [{ id: 5, itemId: 3, status: 'open' }]);
    expect(progress.verifiedQuantity).toBe(1); expect(progress.issues.map((i) => i.kind)).toEqual(['damaged', 'open_work_order']);
  });
});

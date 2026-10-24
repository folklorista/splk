import type { InventoryCheck, InventoryIssue, InventoryProgress, InventoryTarget, InventoryVisit, WorkOrder } from '../../api-contracts/src/index';

/** UI/mock projection only; PHP independently enforces closure and physical evidence (D-63/D-64). */
export function inventoryProgress(targets: InventoryTarget[], checks: InventoryCheck[], visits: InventoryVisit[] = [], orders: Pick<WorkOrder, 'id' | 'itemId' | 'status'>[] = []): InventoryProgress {
  const active = checks.filter((c) => !c.cancelledAt).sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.id - b.id);
  const progress: InventoryProgress = { allTargetCount: targets.length, targetCount: 0, verifiedTargetCount: 0, expectedQuantity: 0, verifiedQuantity: 0,
    kitCount: 0, verifiedKitCount: 0, bulkTargetCount: 0, comparedBulkTargetCount: 0, peopleCount: 0, visitedPeopleCount: 0, openIssueCount: 0, canCloseCleanly: false, issues: [] };
  const holders = new Set<number>();
  for (const target of targets) {
    const observations = active.filter((c) => c.targetId === target.id), bulk = target.bulkStockId !== null;
    const positive = observations.filter((c) => physical(c) && (!bulk || c.checkedQty !== null));
    const max = positive.length ? Math.max(...positive.map((c) => c.checkedQty ?? 1)) : null;
    const verified = max !== null && max >= target.expectedQty;
    const add = (kind: InventoryIssue['kind'], data: Partial<InventoryIssue> = {}) => progress.issues.push({ targetId: target.id, kind, ...data });
    if (!bulk) { progress.targetCount++; progress.verifiedTargetCount += Number(verified); }
    if (target.kitId !== null) { progress.kitCount++; progress.verifiedKitCount += Number(verified); }
    else if (!bulk) { progress.expectedQuantity += target.expectedQty; progress.verifiedQuantity += Math.min(target.expectedQty, max ?? 0); }
    if (target.holderPersonId !== null) holders.add(target.holderPersonId);
    if (!bulk && !verified) add('unverified', { expectedQty: target.expectedQty, verifiedQty: Math.min(target.expectedQty, max ?? 0) });
    const latest = observations.at(-1);
    if (bulk) {
      progress.bulkTargetCount++;
      if (latest && latest.checkedQty !== null) progress.comparedBulkTargetCount++; else add('bulk_not_counted');
    }
    if (latest && !physical(latest)) add(latest.result as 'not_found' | 'not_presented', { checkId: latest.id, note: latest.note });
    const compared = latest?.context.expectedQty ?? target.expectedQty;
    if (latest && physical(latest) && bulk && latest.checkedQty !== compared) add('quantity_mismatch', { checkId: latest.id, expectedQty: compared, checkedQty: latest.checkedQty });
    const lastPhysical = positive.at(-1), conditionCheck = positive.filter((c) => c.condition !== null).at(-1);
    if (lastPhysical?.context.confirmedCompositionConflict) add('composition_mismatch', { checkId: lastPhysical.id });
    if (lastPhysical?.context.confirmedLocationConflict) add('location_mismatch', { checkId: lastPhysical.id });
    for (const condition of new Set([conditionCheck?.condition, target.currentCondition ?? target.snapshot['condition']])) {
      if (lastPhysical && (condition === 'damaged' || condition === 'needs_adjustment')) add(condition, conditionCheck?.condition === condition ? { checkId: conditionCheck.id } : {});
    }
    for (const order of orders) if (target.itemId !== null && order.itemId === target.itemId && ['open', 'in_progress'].includes(order.status)) add('open_work_order', { workOrderId: order.id });
  }
  progress.peopleCount = holders.size;
  progress.visitedPeopleCount = new Set(visits.filter((v) => v.status === 'completed' && holders.has(v.personId)).map((v) => v.personId)).size;
  progress.openIssueCount = progress.issues.length;
  progress.canCloseCleanly = progress.verifiedTargetCount === progress.targetCount && progress.issues.length === 0;
  return progress;
}
function physical(check: InventoryCheck): boolean { return check.result === 'found' || check.result === 'presented'; }

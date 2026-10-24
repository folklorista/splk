import type * as Inv from '@splk/api-contracts';
import { inventoryProgress, formatInventoryNumber } from '@splk/domain';
import { ApiError } from '../api-error';

export interface MockInventoryState {
  loans: Inv.CostumeLoan[]; items: Inv.CostumeItem[]; stocks: Inv.BulkStock[]; kits: Inv.KitDetail[]; orders: Inv.WorkOrder[];
  inventories: Inv.CostumeInventory[]; targets: Inv.InventoryTarget[]; checks: Inv.InventoryCheck[]; slots: Inv.InventorySlot[]; visits: Inv.InventoryVisit[];
}
export interface InventoryMetadata { series: Inv.Series[]; types: Inv.PartType[]; regions: Inv.Region[]; groups: Inv.ManagedGroup[]; units: Inv.Unit[] }
type NewTarget = Omit<Inv.InventoryTarget, 'id' | 'inventoryId' | 'addedExplicitly' | 'note'>;
type Classification = { seriesId: number | null; partTypeId: number | null; regionId: number | null; gender: Inv.Gender | null; variant: string | null };

/** Uses the physical mock adapter's transaction queue/state; no parallel store or fabricated movements. */
export class MockInventories {
  constructor(private readonly state: MockInventoryState, private readonly next: () => number,
    private readonly event: (item: number, event: string, data: Record<string, unknown>) => void, private readonly metadata?: InventoryMetadata) {}

  header(id: number): Inv.CostumeInventory { return find(this.state.inventories, id); }
  open(id: number, version: number): Inv.CostumeInventory {
    const row = this.header(id);
    if (row.status !== 'open') throw new ApiError(409, 'inventory_closed');
    if (row.version !== version) throw new ApiError(409, 'version_conflict', { version: row.version });
    return row;
  }
  detail(id: number): Inv.InventoryDetail {
    const row = this.header(id);
    return { ...row, progress: row.status === 'closed' ? row.resultSnapshot!['progress'] as Inv.InventoryProgress :
      inventoryProgress(this.collection(id, 'targets'), this.collection(id, 'checks'), this.collection(id, 'visits'), this.collection(id, 'workOrders')) };
  }
  collection<K extends keyof Inv.InventoryCollections>(id: number, kind: K): Inv.InventoryCollections[K][] {
    const row = this.header(id);
    if (row.status === 'closed') return (kind === 'issues' ? (row.resultSnapshot!['progress'] as Inv.InventoryProgress).issues : row.resultSnapshot![kind]) as Inv.InventoryCollections[K][];
    let rows: unknown[];
    switch (kind) {
      case 'targets': rows = this.state.targets.filter((t) => t.inventoryId === id).map((t) => ({ ...t, currentCondition: this.state.items.find((i) => i.id === t.itemId)?.condition ?? null })); break;
      case 'checks': rows = this.state.checks.filter((c) => c.inventoryId === id).sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.id - b.id); break;
      case 'slots': rows = this.state.slots.filter((s) => s.inventoryId === id).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.id - b.id); break;
      case 'visits': rows = this.state.visits.filter((v) => v.inventoryId === id); break;
      case 'issues': rows = this.detail(id).progress.issues; break;
      case 'workOrders': {
        const ids = new Set(this.state.targets.filter((t) => t.inventoryId === id).map((t) => t.itemId));
        rows = this.state.orders.filter((w) => ids.has(w.itemId) && ['open', 'in_progress'].includes(w.status)); break;
      }
      case 'movements': rows = this.movements(row.unitId).filter((m) => m.inventoryId === id); break;
      default: throw invalid('collection');
    }
    return rows as Inv.InventoryCollections[K][];
  }
  movements(unit: number): Inv.LoanMovement[] {
    return this.state.loans.filter((l) => l.unitId === unit).flatMap((loan) => loan.lines.flatMap((line): Inv.LoanMovement[] => {
      const base = { loanId: loan.id, lineId: line.id, itemId: line.itemId, bulkStockId: line.bulkStockId, holder: loan.holder, kitId: loan.kitId };
      return [{ ...base, inventoryId: line.inventoryId ?? null, id: line.id, type: 'issued', at: loan.issuedAt, by: loan.issuedBy, qty: line.qty, lostQty: 0, note: loan.note },
        ...loan.returns.filter((r) => r.lineId === line.id).map((r) => ({ ...base, ...r, inventoryId: r.inventoryId ?? null, type: r.closeType }))];
    })).sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || b.id - a.id || a.type.localeCompare(b.type));
  }
  preview(unit: number, scope: Inv.InventoryScope): Inv.InventoryPreview {
    const targets = this.freeze(unit, scope).map((t, id) => ({ ...t, id, inventoryId: 0, addedExplicitly: false, note: null }));
    return { scope: normalizedScope(scope), progress: inventoryProgress(targets, []), unloanedItemCount: targets.filter((t) => t.itemId !== null && t.loanLineId === null).length };
  }
  create(unit: number, input: Inv.InventoryCreate): Inv.InventoryDetail {
    const name = required(input.name, 200), targets = this.freeze(unit, input.scope), id = this.next();
    this.state.inventories.push({ id, unitId: unit, name, scope: normalizedScope(input.scope), status: 'open', startedAt: now(), startedBy: 1,
      closedAt: null, closedBy: null, closedWithIssues: false, closeReason: null, resultSnapshot: null, version: 1 });
    for (const t of targets) this.state.targets.push({ ...structuredClone(t), id: this.next(), inventoryId: id, addedExplicitly: false, note: null });
    return this.detail(id);
  }
  add(id: number, input: Inv.InventoryTargetAdd): Inv.InventoryDetail {
    const header = this.open(id, input.version), note = required(input.note, 2000);
    const keys = (['itemId', 'kitId', 'bulkStockId'] as const).filter((key) => key in input);
    if (keys.length !== 1) throw invalid('target'); const kind = keys[0];
    const fresh = this.freeze(header.unitId, {}), contextKit = 'contextKitId' in input ? input.contextKitId ?? null : null;
    if (contextKit !== null && (kind !== 'bulkStockId' || find(this.state.kits, contextKit).unitId !== header.unitId)) throw invalid('contextKitId');
    let targets = fresh.filter((t) => t[kind] === input[kind] && (contextKit === null || t.contextKitId === contextKit));
    if (!targets.length && contextKit !== null) {
      const source = fresh.find((t) => t.bulkStockId === input[kind]);
      if (source) targets.push({ ...source, holderPersonId: null, holderUnitId: null, contextKitId: contextKit, loanLineId: null, expectedQty: 0, snapshot: { ...source.snapshot, source: 'kit' } });
    }
    if (!targets.length) throw new ApiError(404, 'not_found');
    if (kind === 'bulkStockId') {
      targets = targets.filter((t) => !this.state.targets.some((e) => e.inventoryId === id && e.bulkStockId === t.bulkStockId && e.contextKitId === t.contextKitId && e.loanLineId === t.loanLineId));
      if (!targets.length) throw new ApiError(422, 'inventory_target_exists');
    }
    for (const t of targets) {
      if (this.state.targets.some((e) => e.inventoryId === id && (t.itemId !== null ? e.itemId === t.itemId : t.kitId !== null ? e.kitId === t.kitId : e.bulkStockId === t.bulkStockId && e.contextKitId === t.contextKitId && e.loanLineId === t.loanLineId))) throw new ApiError(422, 'inventory_target_exists');
      this.state.targets.push({ ...structuredClone(t), id: this.next(), inventoryId: id, addedExplicitly: true, note });
    }
    header.version++; return this.detail(id);
  }
  close(id: number, input: Inv.InventoryClose): Inv.InventoryDetail {
    const header = this.open(id, input.version), progress = this.detail(id).progress;
    if (typeof input.closedWithIssues !== 'boolean') throw invalid('closedWithIssues');
    if (!input.closedWithIssues && !progress.canCloseCleanly) throw new ApiError(422, 'inventory_has_issues');
    const reason = input.closedWithIssues ? required(input.reason, 2000) : null;
    if (!input.closedWithIssues && input.reason?.trim()) throw invalid('reason');
    const snapshot: Record<string, unknown> = { progress };
    for (const name of ['targets', 'checks', 'visits', 'slots', 'movements', 'workOrders'] as const) snapshot[name] = this.collection(id, name);
    Object.assign(header, { status: 'closed', closedAt: now(), closedBy: 1, closedWithIssues: input.closedWithIssues, closeReason: reason, resultSnapshot: structuredClone(snapshot), version: header.version + 1 });
    return this.detail(id);
  }
  cancel(checkId: number, version: number): Inv.InventoryDetail {
    const check = find(this.state.checks, checkId), header = this.open(check.inventoryId, version);
    if (!check.cancelledAt) Object.assign(check, { cancelledAt: now(), cancelledBy: 1 });
    const target = find(this.state.targets, check.targetId);
    if (target.itemId !== null) this.event(target.itemId, 'inventory_check_cancelled', { checkId, inventoryId: header.id });
    header.version++; return this.detail(header.id);
  }

  link(unit: number, input: Partial<Inv.InventoryOperationContext>): Inv.CostumeInventory | null {
    if (input.inventoryId === undefined && input.inventoryVersion === undefined) return null;
    if (!Number.isInteger(input.inventoryId) || !Number.isInteger(input.inventoryVersion) || input.inventoryId! < 1 || input.inventoryVersion! < 1) throw invalid('inventoryId');
    const row = this.header(input.inventoryId!);
    if (row.unitId !== unit) throw new ApiError(404, 'not_found');
    return this.open(row.id, input.inventoryVersion!);
  }

  check(id: number, input: Inv.InventoryCheckBatch): Inv.InventoryCheckResponse {
    const header = this.open(id, input.version);
    const holders = Number(input.personId != null) + Number(input.holderUnitId != null);
    if (!['store', 'people', 'kit'].includes(input.mode) || (input.mode === 'people' ? holders !== 1 : holders !== 0) || (input.mode === 'kit') !== (input.kitId !== undefined)) throw invalid('mode');
    if (!Array.isArray(input.entries) || input.entries.length < 1 || input.entries.length > 200) throw invalid('entries');
    if (input.mode === 'kit' && find(this.state.kits, input.kitId!).unitId !== header.unitId) throw new ApiError(404, 'not_found');
    const current = this.freeze(header.unitId, {}), targets = this.collection(id, 'targets'), results: Inv.InventoryCheckOutcome[] = [];
    for (const entry of input.entries) {
      const positive = entry.result === 'presented' || entry.result === 'found';
      if (!(input.mode === 'people' ? ['presented', 'not_presented'] : ['found', 'not_found']).includes(entry.result)) throw invalid('result');
      if (entry.condition !== undefined && (!positive || !['ok', 'damaged', 'needs_adjustment'].includes(entry.condition))) throw invalid('condition');
      if (entry.note !== undefined && (typeof entry.note !== 'string' || entry.note.length > 2000)) throw invalid('note');
      for (const flag of ['confirmConflict', 'recheck'] as const) if (entry[flag] !== undefined && typeof entry[flag] !== 'boolean') throw invalid(flag);
      let target: Inv.InventoryTarget | undefined;
      if ('targetId' in entry && entry.targetId !== undefined) {
        if (!Number.isInteger(entry.targetId) || entry.targetId < 1 || 'seriesId' in entry || 'number' in entry) throw invalid('targetId');
        target = targets.find((t) => t.id === entry.targetId);
      } else {
        if (!Number.isInteger(entry.seriesId) || entry.seriesId! < 1) throw invalid('seriesId'); required(entry.number, 100);
        const item = this.state.items.find((i) => i.unitId === header.unitId && i.seriesId === entry.seriesId && i.number === entry.number?.trim() && !i.retiredAt);
        target = item ? targets.find((t) => t.itemId === item.id) : undefined;
      }
      if (!target) { results.push({ code: 'unknown_number', targetId: null }); continue; }
      const bulk = target.bulkStockId !== null;
      if (bulk ? !Number.isInteger(entry.checkedQty) || entry.checkedQty! < 0 || entry.checkedQty! > 2147483647 : entry.checkedQty !== undefined) throw invalid('checkedQty');
      if (target.itemId === null && entry.condition !== undefined) throw invalid('condition');
      if (input.mode === 'people' && (target.holderPersonId !== (input.personId ?? null) || target.holderUnitId !== (input.holderUnitId ?? null))) throw invalid('holder');
      const item = this.state.items.find((i) => i.id === target!.itemId);
      const loan = this.state.loans.find((l) => item ? l.lines.some((line) => line.itemId === item.id && !line.closedAt) : target!.kitId !== null ? l.kitId === target!.kitId && l.lines.some((line) => !line.closedAt) : l.lines.some((line) => line.id === target!.loanLineId && !line.closedAt));
      let compositionConflict = false;
      if (input.mode === 'kit' && !(target.kitId === input.kitId || target.contextKitId === input.kitId || item?.kitId === input.kitId)) {
        if (!item || !positive) throw invalid('kitId');
        if (!entry.confirmConflict || !entry.note?.trim()) { results.push({ code: 'not_in_kit', targetId: target.id, context: { kitId: input.kitId, intendedKitId: item.kitId } }); continue; }
        compositionConflict = true;
      }
      const context: Inv.InventoryCheck['context'] = { personId: input.personId ?? null, holderUnitId: input.holderUnitId ?? null, kitId: input.kitId ?? null, holder: loan?.holder ?? null, loanId: loan?.id ?? null, location: item?.location ?? null };
      if (compositionConflict) Object.assign(context, { confirmedCompositionConflict: true, intendedKitId: item?.kitId ?? null });
      if (bulk) context.expectedQty = current.find((t) => t.bulkStockId === target!.bulkStockId && t.contextKitId === target!.contextKitId && t.loanLineId === target!.loanLineId)?.expectedQty ?? 0;
      let code: Inv.InventoryCheckOutcome['code'] | null = positive && item?.retiredAt ? 'item_retired' : null;
      if (positive && loan && !(input.mode === 'people' ? input.personId != null ? 'personId' in loan.holder && loan.holder.personId === input.personId : 'unitId' in loan.holder && loan.holder.unitId === input.holderUnitId : input.mode === 'kit' ? loan.kitId === input.kitId : false)) code = 'loaned_to';
      if (positive && input.mode === 'store' && item && item.location !== 'store' && code === null) {
        if (!entry.confirmConflict || !entry.note?.trim()) code = 'not_in_store'; else context.confirmedLocationConflict = true;
      }
      if (positive && input.mode === 'store' && bulk && (target.contextKitId !== null || target.loanLineId !== null)) code = 'not_in_store';
      if (code) { results.push({ code, targetId: target.id, context }); continue; }
      if (positive && !entry.recheck && !bulk && this.state.checks.some((c) => c.targetId === target!.id && !c.cancelledAt && ['found', 'presented'].includes(c.result))) { results.push({ code: 'already_checked', targetId: target.id }); continue; }
      const check: Inv.InventoryCheck = { id: this.next(), inventoryId: id, targetId: target.id, mode: input.mode, result: entry.result,
        condition: entry.condition ?? null, checkedQty: entry.checkedQty ?? null, note: entry.note?.trim() || null, by: 1, at: now(), cancelledAt: null, cancelledBy: null, context };
      this.state.checks.push(check); if (item) this.event(item.id, 'inventory_checked', { ...check }); results.push({ code: 'ok', targetId: target.id, check });
    }
    if (results.some((r) => r.code === 'ok')) header.version++;
    return { id, inventory: this.detail(id), results };
  }

  slot(id: number, slotId: number | null, input: Inv.InventorySlotInput | Inv.InventorySlotPatch): Inv.InventorySlotResponse {
    const header = this.open(id, input.version), current = slotId === null ? null : find(this.state.slots.filter((s) => s.inventoryId === id), slotId);
    const start = timestamp(input.startsAt ?? current?.startsAt), end = timestamp(input.endsAt ?? current?.endsAt), capacity = input.capacity ?? current?.capacity;
    if (Date.parse(end) <= Date.parse(start) || !Number.isInteger(capacity) || capacity! < 1 || capacity! > 2147483647) throw invalid('slot');
    if (current && this.occupancy(id, current.id) > capacity!) throw new ApiError(422, 'inventory_slot_full');
    const slot: Inv.InventorySlot = { id: current?.id ?? this.next(), inventoryId: id, startsAt: start, endsAt: end, capacity: capacity! };
    if (current) Object.assign(current, slot); else this.state.slots.push(slot);
    header.version++; return { id, inventory: this.detail(id), slot };
  }
  visit(id: number, visitId: number | null, input: Inv.InventoryVisitInput | Inv.InventoryVisitPatch): Inv.InventoryVisitResponse {
    const header = this.open(id, input.version), current = visitId === null ? null : find(this.state.visits.filter((v) => v.inventoryId === id), visitId);
    if (current && ['completed', 'cancelled'].includes(current.status)) throw new ApiError(409, 'inventory_visit_closed');
    if (current && 'personId' in input) throw invalid('personId');
    const personId = current?.personId ?? (input as Inv.InventoryVisitInput).personId;
    if (!this.state.targets.some((t) => t.inventoryId === id && t.holderPersonId === personId)) throw invalid('personId');
    const status = input.status ?? current?.status ?? 'booked', slotId = input.slotId === undefined ? current?.slotId ?? null : input.slotId;
    if (!['booked', 'in_progress', 'completed', 'cancelled'].includes(status)) throw invalid('status');
    if (slotId !== null) { const slot = find(this.state.slots.filter((s) => s.inventoryId === id), slotId); if (status !== 'cancelled' && this.occupancy(id, slotId, current?.id) >= slot.capacity) throw new ApiError(422, 'inventory_slot_full'); }
    if (['booked', 'in_progress'].includes(status) && this.state.visits.some((v) => v.id !== visitId && v.inventoryId === id && v.personId === personId && ['booked', 'in_progress'].includes(v.status))) throw new ApiError(422, 'inventory_visit_exists');
    const visit: Inv.InventoryVisit = { id: current?.id ?? this.next(), inventoryId: id, personId, slotId, status, completedAt: status === 'completed' ? now() : null };
    if (current) Object.assign(current, visit); else this.state.visits.push(visit);
    header.version++; return { id, inventory: this.detail(id), visit };
  }
  private occupancy(id: number, slot: number, except?: number): number { return this.state.visits.filter((v) => v.inventoryId === id && v.slotId === slot && v.id !== except && v.status !== 'cancelled').length; }

  freeze(unit: number, scope: Inv.InventoryScope): NewTarget[] {
    const meta = this.metadata;
    if (!meta) throw new ApiError(500, 'internal_error');
    if (!scope || typeof scope !== 'object' || Array.isArray(scope)) throw invalid('scope');
    for (const key of Object.keys(scope)) if (!['regionId', 'gender', 'partTypeId', 'variant', 'seriesId', 'groupId', 'affiliationUnitId'].includes(key)) throw invalid(key);
    for (const [field, rows] of [['regionId', meta.regions], ['partTypeId', meta.types], ['seriesId', meta.series], ['groupId', meta.groups.filter((g) => !g.archived)], ['affiliationUnitId', meta.units.filter((u) => !u.archived)]] as const) {
      if (scope[field] !== undefined && !rows.some((r) => r.id === scope[field])) throw invalid(field);
    }
    if (scope.gender !== undefined && !['male', 'female'].includes(scope.gender)) throw invalid('gender');
    if (scope.variant !== undefined) required(scope.variant, 100);
    const group = scope.groupId === undefined ? null : meta.groups.find((g) => g.id === scope.groupId)!;
    // The shared synthetic person registry has no unit affiliations; never invent memberships for a filter.
    const holderMatches = (holder: Inv.LoanHolder | null) => scope.affiliationUnitId === undefined && (!group || holder && 'personId' in holder && group.memberships.some((m) => m.personId === holder.personId && m.active));
    const classification = (seriesId: number | null, partTypeId: number | null, variant?: string | null): Classification => {
      const series = meta.series.find((s) => s.id === seriesId), type = meta.types.find((t) => t.id === (partTypeId ?? series?.partTypeId));
      return { seriesId, partTypeId: type?.id ?? null, regionId: series?.regionId ?? type?.regionId ?? null, gender: series?.gender ?? type?.gender ?? null, variant: variant ?? series?.variant ?? null };
    };
    const matches = (c: Classification) => (!scope.seriesId || c.seriesId === scope.seriesId) && (!scope.partTypeId || c.partTypeId === scope.partTypeId)
      && (!scope.gender || c.gender === scope.gender) && (!scope.regionId || c.regionId === scope.regionId || meta.regions.find((r) => r.id === c.regionId)?.parentId === scope.regionId)
      && (scope.variant === undefined || (c.variant ?? '').toLocaleLowerCase() === scope.variant.trim().toLocaleLowerCase());
    const kitSeries = meta.series.some((s) => s.id === scope.seriesId && s.kind === 'kit');
    const targets: NewTarget[] = [];
    const target = (kind: 'itemId' | 'kitId' | 'bulkStockId', id: number, holder: Inv.LoanHolder | null, qty: number, snapshot: Record<string, unknown>, kit: number | null = null, line: number | null = null): NewTarget => ({
      itemId: null, kitId: null, bulkStockId: null, [kind]: id, holderPersonId: holder && 'personId' in holder ? holder.personId! : null,
      holderUnitId: holder && 'unitId' in holder ? holder.unitId! : null, expectedQty: qty, contextKitId: kit, loanLineId: line, snapshot,
    });
    for (const item of this.state.items.filter((i) => i.unitId === unit && !i.retiredAt)) {
      const c = classification(item.seriesId, null, item.variant), kit = this.state.kits.find((k) => k.id === item.kitId);
      const selected = kitSeries && kit ? { ...classification(kit.seriesId, null), partTypeId: c.partTypeId } : c;
      if (!matches(selected) || !holderMatches(item.holder)) continue;
      const loan = this.state.loans.find((l) => l.lines.some((line) => line.itemId === item.id && !line.closedAt)), line = loan?.lines.find((l) => l.itemId === item.id && !l.closedAt);
      targets.push(target('itemId', item.id, loan?.holder ?? null, 1, { label: formatInventoryNumber(meta.series.find((s) => s.id === item.seriesId)?.name ?? 'Součástka', item.number),
        seriesId: item.seriesId, number: item.number, condition: item.condition, issuable: item.issuable, location: item.location, kitId: item.kitId,
        region: meta.regions.find((r) => r.id === c.regionId)?.name ?? null, gender: c.gender, loanId: loan?.id ?? null }, null, line?.id ?? null));
    }
    for (const kit of this.state.kits.filter((k) => k.unitId === unit && !k.retiredAt)) {
      if (!matches(classification(kit.seriesId, null)) || !holderMatches(kit.holder)) continue;
      targets.push(target('kitId', kit.id, kit.holder, 1, { label: formatInventoryNumber(meta.series.find((s) => s.id === kit.seriesId)?.name ?? 'Komplet', kit.number),
        seriesId: kit.seriesId, number: kit.number, compositionState: kit.compositionState, itemIds: this.state.items.filter((i) => i.kitId === kit.id && !i.retiredAt).map((i) => i.id), bulkLines: structuredClone(kit.bulkLines) }));
    }
    for (const stock of this.state.stocks.filter((s) => s.unitId === unit)) {
      const base = classification(null, stock.partTypeId, stock.variant), type = meta.types.find((t) => t.id === stock.partTypeId);
      const snapshot = (source: string) => ({ label: `${type?.name ?? 'Zásoba'} ${stock.variant ?? ''}`.trim(), partTypeId: stock.partTypeId, quantityTotal: stock.quantityTotal, region: meta.regions.find((r) => r.id === base.regionId)?.name ?? null, gender: base.gender, source });
      const bulkClassification = (kit: Inv.KitDetail | undefined): Classification => {
        if (!kit) return base; const c = classification(kit.seriesId, null);
        return kitSeries ? { ...c, partTypeId: base.partTypeId } : { ...base, regionId: base.regionId ?? c.regionId, gender: base.gender ?? c.gender };
      };
      const counts = new Map<number, { present: number; handed: number }>(); let reserved = 0;
      for (const kit of this.state.kits.filter((k) => k.unitId === unit)) { const line = kit.bulkLines.find((l) => l.bulkStockId === stock.id); if (line) counts.set(kit.id, { present: line.presentQty, handed: 0 }); }
      for (const loan of this.state.loans.filter((l) => l.unitId === unit)) for (const line of loan.lines.filter((l) => l.bulkStockId === stock.id && !l.closedAt)) {
        const qty = line.qty - line.returnedQty, kit = this.state.kits.find((k) => k.id === loan.kitId);
        if (loan.kitId !== null) { const count = counts.get(loan.kitId) ?? { present: 0, handed: 0 }; count.handed += qty; counts.set(loan.kitId, count); } else reserved += qty;
        if (matches(bulkClassification(kit)) && holderMatches(loan.holder)) targets.push(target('bulkStockId', stock.id, loan.holder, qty, snapshot('loan'), loan.kitId, line.id));
      }
      for (const [kitId, count] of counts) {
        reserved += Math.max(count.present, count.handed); const remaining = Math.max(0, count.present - count.handed);
        if (remaining && matches(bulkClassification(this.state.kits.find((k) => k.id === kitId))) && holderMatches(null)) targets.push(target('bulkStockId', stock.id, null, remaining, snapshot('kit'), kitId));
      }
      const free = stock.quantityTotal - reserved;
      if (free < 0) throw new ApiError(422, 'insufficient_stock');
      if ((free > 0 || reserved === 0) && !kitSeries && matches(base) && holderMatches(null)) targets.push(target('bulkStockId', stock.id, null, free, snapshot('free')));
    }
    return targets;
  }
}

export function inventoryPage<T>(rows: T[], query: Inv.PageQuery = {}): Inv.Page<T> {
  const { offset = 0, limit = 50 } = query;
  if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 200) throw invalid('pagination');
  return { items: rows.slice(offset, offset + limit), total: rows.length };
}
function now(): string { return new Date().toISOString(); }
function normalizedScope(scope: Inv.InventoryScope): Inv.InventoryScope { return { ...structuredClone(scope), ...(scope.variant !== undefined ? { variant: scope.variant.trim() } : {}) }; }
function invalid(field: string): ApiError { return new ApiError(422, 'validation_failed', { field, reason: 'invalid' }); }
function required(value: unknown, maximum: number): string { if (typeof value !== 'string' || !value.trim() || value.length > maximum) throw invalid('text'); return value.trim(); }
function find<T extends { id: number }>(rows: T[], id: number): T { const row = rows.find((r) => r.id === id); if (!row) throw new ApiError(404, 'not_found'); return row; }
function timestamp(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) throw invalid('timestamp');
  const date = value.slice(0, 10); if (new Date(date).toISOString().slice(0, 10) !== date) throw invalid('timestamp');
  return value;
}

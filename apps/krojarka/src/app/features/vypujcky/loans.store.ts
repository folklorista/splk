import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { BulkStock, CostumeItem, CostumeKit, CostumeLoan, KitDetail, LoanCreate, LoanExchangeInput, LoanMovement, LoanPatch, LoanQuery, LoanReturnInput, MovementQuery, Page, PartType, PersonCard, PersonInFund, Series, Unit } from '@splk/api-contracts';
import { FundContext } from '../../core/fund/fund-context';
import { errorMessage } from '../../core/auth/error-messages';
import { ApiError } from '../../data/api-error';
import { InventoryApi } from '../../data/inventory/inventory-api';
import { CatalogApi } from '../../data/catalog/catalog-api';
import { PeopleApi } from '../../data/people/people-api';
import { OrganizationApi } from '../../data/organization/organization-api';

@Injectable()
export class LoansStore {
  private readonly api = inject(InventoryApi);
  private readonly catalog = inject(CatalogApi);
  private readonly peopleApi = inject(PeopleApi);
  private readonly organization = inject(OrganizationApi);
  readonly fund = inject(FundContext).current;
  readonly canManage = computed(() => this.fund()?.canManage ?? false);
  readonly loans = signal<CostumeLoan[]>([]);
  readonly movements = signal<LoanMovement[]>([]);
  readonly items = signal<CostumeItem[]>([]);
  readonly stocks = signal<BulkStock[]>([]);
  readonly kits = signal<CostumeKit[]>([]);
  readonly series = signal<Series[]>([]);
  readonly partTypes = signal<PartType[]>([]);
  readonly people = signal<PersonInFund[]>([]);
  readonly units = signal<Unit[]>([]);
  readonly detail = signal<CostumeLoan | null>(null);
  readonly preview = signal<KitDetail | null>(null);
  readonly holderCard = signal<PersonCard | null>(null);
  readonly loading = signal(false);
  readonly detailLoading = signal(false);
  readonly previewLoading = signal(false);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  private generation = 0;
  private listRequest = 0;
  private detailRequest = 0;
  private previewRequest = 0;
  private personRequest = 0;
  private loanQuery: LoanQuery = { open: true };
  private movementQuery: MovementQuery = {};

  constructor() {
    effect(() => {
      const fund = this.fund();
      untracked(() => {
        this.generation++; this.listRequest++; this.detailRequest++; this.previewRequest++; this.personRequest++;
        this.loans.set([]); this.movements.set([]); this.items.set([]); this.stocks.set([]); this.kits.set([]); this.people.set([]); this.series.set([]); this.partTypes.set([]); this.units.set([]);
        this.detail.set(null); this.preview.set(null); this.holderCard.set(null); this.busy.set(false); this.error.set(null); this.detailLoading.set(false); this.previewLoading.set(false);
        if (fund) void this.reload(); else this.loading.set(false);
      });
    });
  }
  async reload(query?: LoanQuery, movementQuery?: MovementQuery): Promise<void> {
    if (query) this.loanQuery = query;
    if (movementQuery) this.movementQuery = movementQuery;
    const unit = this.fund()?.unitId, generation = this.generation, request = ++this.listRequest;
    if (!unit) return;
    this.loading.set(true); this.error.set(null);
    try {
      const [loans, movements, active, retired, stocks, kits, series, partTypes, people, units] = await Promise.all([
        this.all((offset) => this.api.loans(unit, { ...this.loanQuery, limit: 200, offset })),
        this.all((offset) => this.api.movements(unit, { ...this.movementQuery, limit: 200, offset })),
        this.all((offset) => this.api.items(unit, { limit: 200, offset })), this.all((offset) => this.api.items(unit, { retired: true, limit: 200, offset })),
        this.all((offset) => this.api.stocks(unit, { limit: 200, offset })), this.all((offset) => this.api.kits(unit, { limit: 200, offset })),
        firstValueFrom(this.catalog.series(unit)), firstValueFrom(this.catalog.partTypes(unit)), this.all((offset) => this.peopleApi.people({ fund: unit, limit: 200, offset })), firstValueFrom(this.organization.units()),
      ]);
      if (!this.current(unit, generation) || request !== this.listRequest) return;
      this.loans.set(loans); this.movements.set(movements); this.items.set([...active, ...retired]); this.stocks.set(stocks); this.kits.set(kits); this.series.set(series); this.partTypes.set(partTypes); this.people.set(people); this.units.set(units);
    } catch (error) { if (this.current(unit, generation) && request === this.listRequest) this.error.set(errorMessage(error)); }
    finally { if (this.current(unit, generation) && request === this.listRequest) this.loading.set(false); }
  }
  async openLoan(id: number): Promise<void> {
    const unit = this.fund()?.unitId, generation = this.generation, request = ++this.detailRequest;
    this.detail.set(null); this.detailLoading.set(true); this.error.set(null);
    if (!unit) { this.detailLoading.set(false); return; }
    try {
      const loan = await firstValueFrom(this.api.loan(id));
      if (this.current(unit, generation) && request === this.detailRequest) {
        if (loan.unitId !== unit) throw new ApiError(404, 'not_found');
        this.detail.set(loan);
      }
    } catch (error) { if (this.current(unit, generation) && request === this.detailRequest) this.error.set(errorMessage(error)); }
    finally { if (this.current(unit, generation) && request === this.detailRequest) this.detailLoading.set(false); }
  }
  async openKit(id: number): Promise<void> {
    const unit = this.fund()?.unitId, generation = this.generation, request = ++this.previewRequest;
    this.preview.set(null); this.previewLoading.set(true); this.error.set(null);
    if (!unit) { this.previewLoading.set(false); return; }
    try {
      const kit = await firstValueFrom(this.api.kit(id));
      if (this.current(unit, generation) && request === this.previewRequest) { if (kit.unitId !== unit) throw new ApiError(404, 'not_found'); this.preview.set(kit); }
    } catch (error) { if (this.current(unit, generation) && request === this.previewRequest) this.error.set(errorMessage(error)); }
    finally { if (this.current(unit, generation) && request === this.previewRequest) this.previewLoading.set(false); }
  }
  async selectPerson(id: number): Promise<void> {
    const unit = this.fund()?.unitId, generation = this.generation, request = ++this.personRequest;
    this.holderCard.set(null);
    if (!unit || !id) return;
    try { const card = await firstValueFrom(this.peopleApi.card(unit, id)); if (this.current(unit, generation) && request === this.personRequest) this.holderCard.set(card); }
    catch (error) { if (this.current(unit, generation) && request === this.personRequest) this.error.set(errorMessage(error)); }
  }
  issue(input: LoanCreate) { return this.write((unit) => this.api.issue(unit, input)); }
  returnLoan(id: number, input: LoanReturnInput) { return this.write(() => this.api.returnLoan(id, input)); }
  exchange(id: number, input: LoanExchangeInput) { return this.write(() => this.api.exchange(id, input)); }
  update(id: number, input: LoanPatch) { return this.write(() => this.api.updateLoan(id, input)); }
  itemLabel(id: number | null): string { const i = this.items().find((i) => i.id === id); return i ? `${this.series().find((s) => s.id === i.seriesId)?.name ?? 'Součástka'} ${i.number ?? '(bez čísla)'}${i.size ? ' · ' + i.size : ''}` : `Součástka #${id}`; }
  kitLabel(id: number | null): string { const k = this.kits().find((k) => k.id === id); return k ? `${this.series().find((s) => s.id === k.seriesId)?.name ?? 'Komplet'} ${k.number ?? '(bez čísla)'}` : `Komplet #${id}`; }
  stockLabel(id: number | null): string { const s = this.stocks().find((s) => s.id === id); return s ? `${this.partTypes().find((t) => t.id === s.partTypeId)?.name ?? 'Zásoba #' + s.id}${s.variant ? ' · ' + s.variant : ''}` : `Zásoba #${id}`; }
  holderLabel(holder: CostumeLoan['holder']): string { if ('personId' in holder) { const p = this.people().find((p) => p.id === holder.personId); return p ? `${p.firstName} ${p.lastName}${p.nickname ? ' („' + p.nickname + '“)' : ''}` : `Osoba #${holder.personId}`; } return this.units().find((u) => u.id === holder.unitId)?.name ?? `Složka #${holder.unitId}`; }
  private current(unit: number, generation: number) { return this.fund()?.unitId === unit && this.generation === generation; }
  private async all<T>(read: (offset: number) => Observable<Page<T>>): Promise<T[]> { const rows: T[] = []; while (true) { const page = await firstValueFrom(read(rows.length)); rows.push(...page.items); if (rows.length >= page.total) return rows; if (!page.items.length) throw new ApiError(500, 'internal_error'); } }
  private async write<T>(read: (unit: number) => Observable<T>): Promise<T> {
    const unit = this.fund()?.unitId, generation = this.generation;
    if (!unit || !this.canManage()) throw new ApiError(403, 'forbidden');
    if (this.busy()) throw new ApiError(422, 'validation_failed', { reason: 'not_allowed' });
    this.busy.set(true);
    try { const result = await firstValueFrom(read(unit)); if (!this.current(unit, generation)) throw new ApiError(404, 'not_found'); await this.reload(); if (!this.current(unit, generation)) throw new ApiError(404, 'not_found'); return result; }
    finally { if (this.current(unit, generation)) this.busy.set(false); }
  }
}

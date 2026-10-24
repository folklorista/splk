import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { CostumeLoan, PaperMigrationFinding, PaperMigrationRequest, PaperMigrationResult, PersonCard, Series } from '@splk/api-contracts';
import { FundContext } from '../../core/fund/fund-context';
import { errorMessage } from '../../core/auth/error-messages';
import { ApiError } from '../../data/api-error';
import { PeopleApi } from '../../data/people/people-api';
import { CatalogApi } from '../../data/catalog/catalog-api';
import { InventoryApi } from '../../data/inventory/inventory-api';

@Injectable()
export class PaperMigrationStore {
  readonly fund = inject(FundContext).current;
  private readonly people = inject(PeopleApi);
  private readonly catalog = inject(CatalogApi);
  private readonly inventory = inject(InventoryApi);
  readonly personId = signal<number | null>(null);
  readonly key = computed(() => `${this.fund()?.unitId}:${this.personId()}`);
  readonly canManage = computed(() => this.fund()?.canManage ?? false);
  readonly card = signal<PersonCard | null>(null);
  readonly series = signal<Series[]>([]);
  readonly loans = signal<CostumeLoan[]>([]);
  readonly findings = signal<PaperMigrationFinding[]>([]);
  readonly results = signal<PaperMigrationResult['results']>([]);
  readonly busy = signal(false);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  private activeKey = '';
  private generation = 0;
  private request = 0;
  constructor() {
    effect(() => { this.key(); untracked(() => { this.activeKey = this.key(); this.generation++; this.request++; this.card.set(null); this.series.set([]); this.loans.set([]); this.findings.set([]); this.results.set([]); this.busy.set(false); this.loading.set(false); this.error.set(''); this.notice.set(''); void this.load(); }); });
  }
  async load(): Promise<void> {
    const unit = this.fund()?.unitId, person = this.personId(), generation = this.generation, request = ++this.request;
    if (!unit || !person) return;
    this.loading.set(true); this.error.set('');
    try {
      const [card, series] = await Promise.all([firstValueFrom(this.people.card(unit, person)), firstValueFrom(this.catalog.series(unit))]);
      const findings: PaperMigrationFinding[] = [], loans: CostumeLoan[] = [];
      for (;;) { const page = await firstValueFrom(this.people.paperFindings(unit, person, { limit: 200, offset: findings.length })); if (!page.items.length && findings.length < page.total) throw new ApiError(500, 'internal_error'); findings.push(...page.items); if (findings.length >= page.total) break; }
      for (;;) { const page = await firstValueFrom(this.inventory.loans(unit, { person, open: true, limit: 200, offset: loans.length })); if (!page.items.length && loans.length < page.total) throw new ApiError(500, 'internal_error'); loans.push(...page.items); if (loans.length >= page.total) break; }
      if (this.current(generation) && request === this.request) { if (card.person.id !== person || findings.some((f) => f.unitId !== unit || f.personId !== person) || loans.some((l) => l.unitId !== unit)) throw new ApiError(404, 'not_found'); this.card.set(card); this.series.set(series.filter((s) => s.kind === 'part')); this.findings.set(findings); this.loans.set(loans); }
    } catch (error) { if (this.current(generation) && request === this.request) this.error.set(errorMessage(error)); }
    finally { if (this.current(generation) && request === this.request) this.loading.set(false); }
  }
  start(originalChecked: boolean, note: string): Promise<boolean> { return this.profile('migrating', originalChecked, note); }
  finish(confirmed: boolean, originalChecked: boolean, note: string): Promise<boolean> {
    if (!confirmed || !originalChecked && !note.trim()) { this.error.set('Potvrďte převzetí evidence a porovnání originálu, nebo zapište důvod jeho nedostupnosti.'); return Promise.resolve(false); }
    return this.profile('digital', originalChecked, note);
  }
  async migrate(input: PaperMigrationRequest): Promise<boolean> {
    return this.write(async (unit, person, generation) => { const result = await firstValueFrom(this.people.migratePaper(unit, person, input)); if (this.current(generation)) this.results.set(result.results); });
  }
  private profile(paperState: 'migrating' | 'digital', originalChecked: boolean, note: string) {
    return this.write(async (unit, person) => { await firstValueFrom(this.people.profile(unit, person, { paperState, originalChecked, note })); });
  }
  private current(generation: number) { return this.generation === generation && this.key() === this.activeKey; }
  private async write(work: (unit: number, person: number, generation: number) => Promise<void>): Promise<boolean> {
    const unit = this.fund()?.unitId, person = this.personId(), generation = this.generation;
    if (!unit || !person || !this.canManage() || this.busy()) return false;
    this.busy.set(true); this.error.set(''); this.notice.set('');
    try { await work(unit, person, generation); if (!this.current(generation)) return false; await this.load(); if (!this.current(generation)) return false; this.notice.set('Evidence je uložená. Fyzické předání ani ověření součástí tím nevzniklo.'); return true; }
    catch (error) { if (this.current(generation)) this.error.set(errorMessage(error)); return false; }
    finally { if (this.current(generation)) this.busy.set(false); }
  }
}

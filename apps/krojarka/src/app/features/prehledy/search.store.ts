import { effect, inject, Injectable, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { SearchResult } from '@splk/api-contracts';
import { FundContext } from '../../core/fund/fund-context';
import { errorMessage } from '../../core/auth/error-messages';
import { ApiError } from '../../data/api-error';
import { ReportsApi } from '../../data/reports/reports-api';
@Injectable()
export class SearchStore {
  private readonly api = inject(ReportsApi);
  private readonly funds = inject(FundContext);
  readonly fund = this.funds.current;
  readonly rows = signal<SearchResult[]>([]);
  readonly total = signal(0);
  readonly term = signal('');
  readonly allFunds = signal(false);
  readonly loading = signal(false);
  readonly error = signal('');
  private request = 0;
  constructor() { effect(() => { this.fund(); this.allFunds(); untracked(() => { this.request++; this.rows.set([]); this.total.set(0); this.term.set(''); this.loading.set(false); this.error.set(''); }); }); }
  async search(term: string, more = false): Promise<void> {
    const unit = this.fund()?.unitId, all = this.allFunds(); if (!unit || more && this.loading()) return;
    const request = ++this.request, offset = more ? this.rows().length : 0;
    const q = more ? this.term() : term.trim(); if (!q) { this.loading.set(false); this.error.set('Zadejte jméno nebo označení součástky.'); return; }
    if (!more) { this.rows.set([]); this.total.set(0); this.term.set(q); }
    this.loading.set(true); this.error.set('');
    try { const page = await firstValueFrom(this.api.search({ q, ...(all ? {} : { fund: unit }), offset, limit: 50 }));
      if (request === this.request && this.fund()?.unitId === unit && this.allFunds() === all) {
        if (page.items.some((r) => r.unitId !== null && (!this.funds.funds().some((f) => f.unitId === r.unitId) || !all && r.unitId !== unit))) throw new ApiError(404, 'not_found');
        if (!page.items.length && offset < page.total) throw new ApiError(500, 'internal_error');
        this.rows.update((rows) => more ? [...rows, ...page.items] : page.items); this.total.set(page.total);
      }
    } catch (error) { if (request === this.request && this.fund()?.unitId === unit) this.error.set(errorMessage(error)); }
    finally { if (request === this.request && this.fund()?.unitId === unit) this.loading.set(false); }
  }
  select(result: SearchResult): void { if (result.unitId !== null && this.funds.funds().some((f) => f.unitId === result.unitId)) this.funds.select(result.unitId); }
  fundName(id: number | null) { return id === null ? 'Společná identita' : this.funds.funds().find((f) => f.unitId === id)?.name ?? ''; }
  link(result: SearchResult): (string | number)[] { return result.kind === 'person' ? ['/lide', result.id] : ['/soucastky', result.kind === 'item' ? 'kusy' : 'komplety', result.id]; }
}

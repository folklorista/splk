import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { AttachmentOwnerType, Page } from '@splk/api-contracts';
import { FundContext } from '../../core/fund/fund-context';
import { errorMessage } from '../../core/auth/error-messages';
import { CatalogApi } from '../../data/catalog/catalog-api';
import { InventoryApi } from '../../data/inventory/inventory-api';
import { PeopleApi } from '../../data/people/people-api';
import { ApiError } from '../../data/api-error';

/** Human-readable owner choices; components never need to ask users for database identifiers. */
@Injectable()
export class AttachmentOwnersStore {
  private readonly fund = inject(FundContext).current;
  private readonly people = inject(PeopleApi);
  private readonly catalog = inject(CatalogApi);
  private readonly inventory = inject(InventoryApi);
  readonly options = signal<{ id: number; label: string }[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  private request = 0;

  async load(type: AttachmentOwnerType): Promise<void> {
    const fund = this.fund(), request = ++this.request; this.options.set([]); this.error.set('');
    if (!fund) return;
    this.loading.set(true);
    try {
      let options: { id: number; label: string }[] = [];
      if (type === 'archive') options = [{ id: fund.unitId, label: `Dokumenty fondu ${fund.name}` }];
      else if (type === 'person') options = (await this.all((offset) => this.people.people({ fund: fund.unitId, offset, limit: 200 }))).map((p) => ({ id: p.id, label: `${p.firstName} ${p.lastName}${p.nickname ? ` (${p.nickname})` : ''}` }));
      else if (type === 'series') options = (await firstValueFrom(this.catalog.series(fund.unitId))).map((s) => ({ id: s.id, label: s.name }));
      else if (type === 'item' || type === 'kit') {
        const series = new Map((await firstValueFrom(this.catalog.series(fund.unitId))).map((s) => [s.id, s.name]));
        const rows = type === 'item'
          ? [...await this.all((offset) => this.inventory.items(fund.unitId, { offset, limit: 200 })), ...await this.all((offset) => this.inventory.items(fund.unitId, { retired: true, offset, limit: 200 }))]
          : await this.all((offset) => this.inventory.kits(fund.unitId, { offset, limit: 200 }));
        options = rows.map((r) => ({ id: r.id, label: `${series.get(r.seriesId) ?? 'Řada'} ${r.number ?? '(bez čísla)'}${r.retiredAt ? ' · vyřazeno' : ''}` }));
      } else {
        const inventories = await this.all((offset) => this.inventory.inventories(fund.unitId, { offset, limit: 200 }));
        for (const inventory of inventories) {
          const checks = await this.all((offset) => this.inventory.inventoryCollection(inventory.id, 'checks', { offset, limit: 200 }));
          options.push(...checks.map((c) => ({ id: c.id, label: `${inventory.name} · ${new Date(c.at).toLocaleString('cs-CZ')}${c.cancelledAt ? ' · zrušená kontrola' : ''}` })));
        }
      }
      if (request === this.request && this.fund()?.unitId === fund.unitId) this.options.set(options.sort((a, b) => a.label.localeCompare(b.label, 'cs')));
    } catch (error) { if (request === this.request && this.fund()?.unitId === fund.unitId) this.error.set(errorMessage(error)); }
    finally { if (request === this.request) this.loading.set(false); }
  }
  private async all<T>(read: (offset: number) => Observable<Page<T>>): Promise<T[]> {
    const rows: T[] = []; let total = 0;
    do { const page = await firstValueFrom(read(rows.length)); total = page.total; if (!page.items.length && rows.length < total) throw new ApiError(500, 'internal_error'); rows.push(...page.items); } while (rows.length < total);
    return rows;
  }
}

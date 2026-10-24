import { DatePipe } from '@angular/common';
import { Component, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { CostInput, CostLinkInput, CostQuery } from '@splk/api-contracts';
import { formatCostAmount, normalizeCostAmount } from '@splk/domain';
import { CostsStore } from './costs.store';
@Component({ selector: 'app-costs-page', imports: [FormsModule, DatePipe, RouterLink], providers: [CostsStore], templateUrl: './costs-page.html', styles: [`
  :host{display:block;min-width:0}.cost-tools{display:flex;flex-wrap:wrap;gap:.8rem;align-items:end}.cost-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,22rem),1fr));gap:1rem}.cost-fields{display:flex;flex-wrap:wrap;gap:1rem;align-items:end;border:0;padding:0;min-width:0}.cost-fields .field{min-width:0;flex:1 1 15rem}.cost-summary{display:flex;flex-wrap:wrap;gap:1rem}.cost-amount{font-size:1.3rem;font-weight:600}.cost-card{overflow-wrap:anywhere}dt{font-weight:600}dd{margin:0 0 .6rem}.cost-links{padding-left:1.2rem}
` ] })
export class CostsPage {
  readonly store = inject(CostsStore);
  readonly money = formatCostAmount;
  readonly formError = signal('');
  unitFilter = 0; from = ''; to = ''; currencyFilter = ''; search = '';
  spentOn = ''; amount = ''; currency = 'CZK'; supplier = ''; documentRef = ''; description = ''; purpose = '';
  links: CostLinkInput[] = []; target = ''; quantity = 1;
  constructor() {
    effect(() => { const query = this.store.query(); untracked(() => { this.unitFilter = query.unitId ?? 0; this.from = query.from ?? ''; this.to = query.to ?? ''; this.currencyFilter = query.currency ?? ''; this.search = query.q ?? ''; }); });
    effect(() => { const editor = this.store.editor(); untracked(() => {
      this.formError.set(''); const cost = editor?.cost; const date = new Date(); this.spentOn = cost?.spentOn ?? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      this.amount = cost?.amount ?? ''; this.currency = cost?.currency ?? 'CZK'; this.supplier = cost?.supplier ?? ''; this.documentRef = cost?.documentRef ?? ''; this.description = cost?.description ?? ''; this.purpose = cost?.purpose ?? '';
      this.links = cost?.links.map(({ kind, targetId, qty }) => ({ kind, targetId, qty })) ?? []; this.target = ''; this.quantity = 1;
    }); });
  }
  apply(): void { const query: CostQuery = {}; if (this.unitFilter) query.unitId = this.unitFilter; if (this.from) query.from = this.from; if (this.to) query.to = this.to; if (this.currencyFilter.trim()) query.currency = this.currencyFilter.trim().toUpperCase(); if (this.search.trim()) query.q = this.search.trim(); this.store.query.set(query); }
  page(direction: number): void { this.store.query.update((q) => ({ ...q, offset: Math.max(0, (q.offset ?? 0) + direction * 50) })); }
  bulk(): boolean { return this.store.targets().find((o) => `${o.kind}:${o.targetId}` === this.target)?.kind === 'bulk_stock'; }
  addLink(): void {
    const option = this.store.targets().find((o) => `${o.kind}:${o.targetId}` === this.target); if (!option) return;
    const qty = option.kind === 'bulk_stock' ? this.quantity : 1;
    if (!Number.isInteger(qty) || qty < 1 || qty > 2147483647 || this.links.length >= 200 || this.links.some((l) => l.kind === option.kind && l.targetId === option.targetId)) { this.formError.set('Každou součástku přidejte jednou a zadejte kladný celý počet.'); return; }
    this.links = [...this.links, { kind: option.kind, targetId: option.targetId, qty }]; this.target = ''; this.quantity = 1; this.formError.set('');
  }
  linkLabel(link: CostLinkInput): string { return this.store.targets().find((o) => o.kind === link.kind && o.targetId === link.targetId)?.label ?? this.store.editor()?.cost?.links.find((l) => l.kind === link.kind && l.targetId === link.targetId)?.object.label ?? 'Součástka'; }
  async save(): Promise<void> {
    this.formError.set(''); let amount: string;
    try { amount = normalizeCostAmount(this.amount.trim().replace(',', '.')); } catch { this.formError.set('Zadejte částku bez oddělovačů tisíců, nejvýše se 4 desetinnými místy. Dobropis či vratka může mít záporné znaménko.'); return; }
    const currency = this.currency.trim().toUpperCase(); if (!/^[A-Z]{3}$/u.test(currency) || !this.description.trim() || !this.spentOn) { this.formError.set('Vyplňte datum, třípísmenný kód měny a popis.'); return; }
    const input: CostInput = { spentOn: this.spentOn, amount, currency, supplier: this.supplier.trim() || null, documentRef: this.documentRef.trim() || null, description: this.description.trim(), purpose: this.purpose.trim() || null, links: structuredClone(this.links) };
    await this.store.save(input);
  }
}

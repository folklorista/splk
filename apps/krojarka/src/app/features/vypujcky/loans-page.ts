import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FundHeader } from '../nastaveni/fund-header';
import { LoansStore } from './loans.store';

@Component({ selector: 'app-loans-page', imports: [DatePipe, FormsModule, RouterLink, FundHeader], template: `
  <h1>Výpůjčky</h1><app-fund-header />
  <p>Skladové pohyby od nejnovějších. Evidují skutečná předání, vrácení, výměny a ztráty.</p>
  @if (store.canManage()) { <a class="button" routerLink="vydat">Vydat součástky nebo komplet</a> }
  @if (store.error()) { <p class="error" role="alert">{{ store.error() }}</p> }
  @if (store.loading()) { <p role="status">Načítám…</p> }
  <section class="card"><h2>Přehled výpůjček</h2>
    <form (ngSubmit)="filter()" class="filters">
      <label>Stav <select name="state" [(ngModel)]="state"><option value="open">Otevřené</option><option value="overdue">Po termínu</option><option value="closed">Uzavřené</option><option value="all">Všechny</option></select></label>
      <label>Držitel <select name="person" [(ngModel)]="person"><option [ngValue]="0">Všichni</option>@for (p of store.people(); track p.id) { <option [ngValue]="p.id">{{ p.firstName }} {{ p.lastName }}</option> }</select></label>
      <label><input type="checkbox" name="external" [(ngModel)]="external" /> Jen externisté</label>
      <button type="submit" [disabled]="store.loading()">Použít filtr</button>
    </form>
    @for (loan of store.loans(); track loan.id) {
      <article class="entry"><a [routerLink]="[loan.id]">{{ store.holderLabel(loan.holder) }} · {{ loan.origin === 'paper_migration' ? 'převzato z papíru' : 'výdej' }} #{{ loan.id }}</a>
        <span>{{ loan.origin === 'paper_migration' ? 'Digitalizováno' : 'Vydáno' }} {{ (loan.issuedAt ?? loan.migratedAt) | date:'d. M. y HH:mm' }} · {{ loan.kitId ? store.kitLabel(loan.kitId) : 'Jednotlivé součástky' }}</span>
        <span>{{ remaining(loan) }} nevráceno · termín {{ loan.dueAt ? (loan.dueAt | date:'d. M. y HH:mm') : 'dlouhodobě' }}</span>
        @if (loan.note) { <span>{{ loan.note }}</span> }
      </article>
    } @empty { @if (!store.loading()) { <p>Tomuto filtru neodpovídají žádné výpůjčky.</p> } }
  </section>
  <section class="card"><h2>Skladové pohyby</h2>
    <form (ngSubmit)="filterMovements()" class="filters">
      <label>Od <input type="datetime-local" name="from" [(ngModel)]="from" /></label><label>Do <input type="datetime-local" name="to" [(ngModel)]="to" /></label>
      <label>Součástka <select name="item" [(ngModel)]="item"><option [ngValue]="0">Všechny</option>@for (i of store.items(); track i.id) { <option [ngValue]="i.id">{{ store.itemLabel(i.id) }}</option> }</select></label>
      <label>Komplet <select name="kit" [(ngModel)]="kit"><option [ngValue]="0">Všechny</option>@for (k of store.kits(); track k.id) { <option [ngValue]="k.id">{{ store.kitLabel(k.id) }}</option> }</select></label>
      <button [disabled]="store.loading()">Použít filtr pohybů</button>
    </form>
    @for (m of store.movements(); track m.type + ':' + m.id) {
      <article class="entry"><a [routerLink]="[m.loanId]">{{ labels[m.type] }} · {{ store.holderLabel(m.holder) }}</a>
        <span>{{ m.at | date:'d. M. y HH:mm' }} · {{ m.itemId ? store.itemLabel(m.itemId) : store.stockLabel(m.bulkStockId) }}</span>
        <span>{{ m.qty }} {{ m.type === 'paper_migration' ? 'převzato z papírové evidence' : m.type === 'issued' ? 'předáno' : 'převzato' }}@if (m.lostQty) { · {{ m.lostQty }} ztraceno }</span>
        @if (m.note) { <span>{{ m.note }}</span> }
      </article>
    } @empty { @if (!store.loading()) { <p>Zatím nejsou evidované žádné pohyby.</p> } }
  </section>
`, styles: [`.filters { display:flex; flex-wrap:wrap; gap:1rem; align-items:end } .entry { display:grid; gap:.3rem; padding:.8rem 0; border-bottom:1px solid #ddd }`] })
export class LoansPage {
  readonly store = inject(LoansStore);
  private readonly route = inject(ActivatedRoute);
  constructor() { const person = Number(this.route.snapshot.queryParamMap.get('person')), kit = Number(this.route.snapshot.queryParamMap.get('kit')); if (person > 0 || kit > 0) { this.person = person || 0; this.kit = kit || 0; this.state = 'all'; const query = { ...(person > 0 ? { person } : {}), ...(kit > 0 ? { kit } : {}) }; void this.store.reload(query, query); } }
  state = 'open'; person = 0; external = false; item = 0; kit = 0; from = ''; to = '';
  readonly labels = { issued: 'Výdej', paper_migration: 'Převzato z papíru', returned: 'Vrácení', exchanged: 'Výměna', settled: 'Ztráta' };
  remaining(loan: ReturnType<LoansStore['loans']>[number]) { return loan.lines.filter((l) => !l.closedAt).reduce((sum, l) => sum + l.qty - l.returnedQty, 0); }
  filter() { void this.store.reload({ ...(this.state === 'open' ? { open: true } : this.state === 'closed' ? { open: false } : this.state === 'overdue' ? { overdue: true } : {}), ...(this.person ? { person: this.person } : {}), ...(this.external ? { holderType: 'external' as const } : {}) }); }
  filterMovements() { void this.store.reload(undefined, { ...(this.from ? { from: new Date(this.from).toISOString() } : {}), ...(this.to ? { to: new Date(this.to).toISOString() } : {}), ...(this.item ? { item: this.item } : {}), ...(this.kit ? { kit: this.kit } : {}), ...(this.person ? { person: this.person } : {}) }); }
}

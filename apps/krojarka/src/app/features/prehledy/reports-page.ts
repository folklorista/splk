import { DatePipe } from '@angular/common';
import { Component, effect, inject, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import type { ReportKind, ReportQuery } from '@splk/api-contracts';
import { FundHeader } from '../nastaveni/fund-header';
import { ReportsStore } from './reports.store';
@Component({ selector: 'app-reports-page', imports: [FormsModule, DatePipe, FundHeader, RouterLink], providers: [ReportsStore], templateUrl: './reports-page.html', styles: [`
  .report-scroll{overflow:auto}table{border-collapse:collapse;width:100%;font-size:.9rem}th,td{border:1px solid #aaa;padding:.4rem;text-align:left;vertical-align:top;overflow-wrap:anywhere} .report-controls{display:flex;flex-wrap:wrap;gap:.8rem;align-items:end}
  @media print { .report-controls,.report-error,app-fund-header{display:none}.card{border:0;box-shadow:none;padding:0}.report-scroll{overflow:visible}thead{display:table-header-group}tr{break-inside:avoid}th,td{font-size:9pt} }
` ] })
export class ReportsPage {
  readonly store = inject(ReportsStore);
  readonly labels: Record<ReportKind, string> = { items: 'Součástky podle evidence', series: 'Soupis řady', person: 'Krojová karta osoby', item: 'Kus a jeho historie', kit: 'Složení kompletu', inventory: 'Inventurní soupis a nesrovnalosti', loans: 'Výpůjčky', 'work-orders': 'Pracovní úkoly' };
  readonly kinds = Object.keys(this.labels) as ReportKind[];
  selected = 0; condition = ''; location = ''; orderStatus: ReportQuery['status'] = 'active'; retired = ''; acquiredFrom = ''; acquiredTo = ''; open = ''; overdue = false; external = false;
  constructor() { effect(() => { this.store.kind(); this.store.fund(); untracked(() => { this.selected = 0; this.condition = ''; this.location = ''; this.orderStatus = 'active'; this.retired = ''; this.acquiredFrom = ''; this.acquiredTo = ''; this.open = ''; this.overdue = false; this.external = false; }); }); }
  pieceFilters(): boolean { return this.store.kind() === 'items' || this.store.kind() === 'series' && this.store.choices().find((c) => c.id === this.selected)?.kind !== 'kit'; }
  load(): void {
    const query: ReportQuery = {};
    if (this.store.kind() === 'work-orders') query.status = this.orderStatus;
    if (this.pieceFilters()) { if (this.location) query.location = this.location as ReportQuery['location']; if (this.condition) query.condition = this.condition as ReportQuery['condition']; if (this.retired) query.retired = this.retired === 'true'; if (this.acquiredFrom) query.acquiredFrom = this.acquiredFrom; if (this.acquiredTo) query.acquiredTo = this.acquiredTo; }
    if (['loans', 'person'].includes(this.store.kind())) { if (this.open) query.open = this.open === 'true'; if (this.overdue) query.overdue = true; if (this.external) query.holderType = 'external'; }
    void this.store.load(this.selected || undefined, query);
  }
}

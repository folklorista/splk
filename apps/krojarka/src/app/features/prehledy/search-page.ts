import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { FundHeader } from '../nastaveni/fund-header';
import { SearchStore } from './search.store';
@Component({ selector: 'app-search-page', imports: [FormsModule, RouterLink, FundHeader], providers: [SearchStore], template: `
<h1>Hledat</h1><app-fund-header />
<form class="card form-row" (ngSubmit)="store.search(query)"><label class="field">Jméno, přezdívka nebo řada a číslo<input name="q" [(ngModel)]="query" maxlength="200" placeholder="kopanická košile 03"></label><label><input type="checkbox" name="all" [ngModel]="store.allFunds()" (ngModelChange)="store.allFunds.set($event)"> Všechny přístupné fondy</label><button class="button">Hledat</button></form>
@if (store.error()) { <p role="alert">{{ store.error() }}</p> } @if (store.loading()) { <p role="status">Hledám…</p> }
@if (store.term()) { <p>Výsledky pro „{{ store.term() }}“: {{ store.total() }}. Jména osob jsou společná; součástky a komplety jen z povolených fondů.</p> }
<ul class="inventory-list">@for (row of store.rows(); track row.kind + ':' + row.id) { <li><a [routerLink]="store.link(row)" (click)="store.select(row)">{{ row.label }}</a><span>{{ row.kind === 'person' ? 'Osoba' : row.kind === 'item' ? 'Součástka' : 'Komplet' }} · {{ store.fundName(row.unitId) }}{{ row.retired ? ' · vyřazeno' : '' }}</span></li> } @empty { @if (store.term() && !store.loading()) { <li>Žádné odpovídající záznamy.</li> } }</ul>
@if (store.rows().length < store.total()) { <button type="button" [disabled]="store.loading()" (click)="store.search(store.term(), true)">Další výsledky</button> }
` })
export class SearchPage { readonly store = inject(SearchStore); query = ''; }

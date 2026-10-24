import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FundHeader } from '../nastaveni/fund-header';
import { PeopleStore } from './people.store';

@Component({ selector: 'app-cards-page', imports: [RouterLink, FundHeader], providers: [PeopleStore], template: `
  <h1>Krojové karty</h1><app-fund-header />
  <section class="card"><h2>Lidé s otevřenými výpůjčkami tohoto fondu</h2>
    <p><a routerLink="/lide">Všichni lidé včetně papírové evidence</a> · <a routerLink="/vypujcky">Výpůjčky a pohyby</a></p>
    @if (store.error()) { <p class="error" role="alert">{{ store.error() }}</p> }
    @if (store.loading()) { <p role="status">Načítám…</p> }
    <ul class="inventory-list">@for (p of store.people(); track p.id) { <li><a [routerLink]="['/lide', p.id]">{{ store.name(p) }}</a></li> } @empty { @if (!store.loading()) { <li>Ve vybraném fondu nemá nikdo otevřenou digitálně evidovanou výpůjčku.</li> } }</ul>
  </section>
` })
export class CardsPage { readonly store = inject(PeopleStore); constructor() { this.store.onlyWithLoans.set(true); } }

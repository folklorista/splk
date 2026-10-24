import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FundHeader } from '../nastaveni/fund-header';

@Component({ selector: 'app-cards-page', imports: [RouterLink, FundHeader], template: `
  <h1>Krojové karty</h1><app-fund-header />
  <section class="card"><h2>Lidé s digitálně evidovanými výpůjčkami</h2>
    <p>Výdeje a vrácení dosud nejsou zavedené. Papírové zápůjčky se sem nepřepisují automaticky.</p>
    <p>Osobní údaje, stav evidence a poznámku ve fondu lze připravit na kartě konkrétní osoby v <a routerLink="/lide">Lidech</a>.</p>
  </section>
` })
export class CardsPage {}

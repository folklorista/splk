import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FundHeader } from '../nastaveni/fund-header';
import { InventoriesStore } from './inventories.store';

@Component({ selector: 'app-inventories-layout', imports: [RouterOutlet, FundHeader], providers: [InventoriesStore], template: `
  <h1>Inventury</h1><app-fund-header />
  @if (store.error()) { <p class="notice notice-danger" role="alert">{{ store.error() }}</p> }
  @if (store.loading()) { <p role="status">Načítám inventury a evidenci…</p> }
  <router-outlet />
` })
export class InventoriesLayout { protected readonly store = inject(InventoriesStore); }

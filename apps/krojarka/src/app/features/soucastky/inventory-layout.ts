import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FundHeader } from '../nastaveni/fund-header';
import { InventoryStore } from './inventory.store';
import { InventoryOperationStore } from '../inventury/inventory-operation.store';

@Component({
  selector: 'app-inventory-layout', imports: [RouterOutlet, FundHeader], providers: [InventoryStore, InventoryOperationStore],
  template: `
    <h1>Součástky</h1><app-fund-header />
    <p class="muted">Evidence podle řad. Určené složení kompletu ani údaj o umístění nenahrazují fyzickou kontrolu.</p>
    @if (store.error()) { <p class="notice notice-danger" role="alert">{{ store.error() }} <button type="button" class="link-button" (click)="store.reload()">Obnovit seznam</button></p> }
    @if (store.loading()) { <p role="status">Načítám evidenci…</p> }
    <router-outlet />
  `,
})
export class InventoryLayout { protected readonly store = inject(InventoryStore); }

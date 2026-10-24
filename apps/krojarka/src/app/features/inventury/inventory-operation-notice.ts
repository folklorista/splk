import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { InventoryOperationStore } from './inventory-operation.store';

@Component({ selector: 'app-inventory-operation-notice', imports: [RouterLink], template: `
  @if (context.requested()) {
    <section class="notice" aria-label="Kontext inventury">
      @if (context.loading()) { <p role="status">Načítám kontext inventury…</p> }
      @if (context.inventory(); as inventory) { <p>Inventura: <a [routerLink]="['/inventury', inventory.id]">{{ inventory.name }}</a>.</p> }
      <p>Nové předání, převzetí a nový pracovní úkol se uloží k této inventuře. Fyzické ověření se zapisuje samostatně v inventuře.</p>
      @if (context.error()) { <p class="notice-danger" role="alert">{{ context.error() }}</p> }
      <button type="button" class="button" (click)="context.reload()" [disabled]="context.loading()">Obnovit kontext</button>
      <a class="button" routerLink="." [queryParams]="{ inventoryId: null }" queryParamsHandling="merge">Pokračovat mimo inventuru</a>
    </section>
  }
` })
export class InventoryOperationNotice { protected readonly context = inject(InventoryOperationStore); }

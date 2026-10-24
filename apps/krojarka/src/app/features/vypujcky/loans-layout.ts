import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LoansStore } from './loans.store';
import { InventoryOperationStore } from '../inventury/inventory-operation.store';

@Component({ selector: 'app-loans-layout', imports: [RouterOutlet], providers: [LoansStore, InventoryOperationStore], template: '<router-outlet />' })
export class LoansLayout {}

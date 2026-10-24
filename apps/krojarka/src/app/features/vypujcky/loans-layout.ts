import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LoansStore } from './loans.store';

@Component({ selector: 'app-loans-layout', imports: [RouterOutlet], providers: [LoansStore], template: '<router-outlet />' })
export class LoansLayout {}

import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FundHeader } from '../nastaveni/fund-header';
import { PeopleStore } from './people.store';

@Component({ selector: 'app-people-layout', imports: [RouterOutlet, FundHeader], providers: [PeopleStore], template: `
  <h1>Lidé</h1><app-fund-header />
  @if (store.error()) { <p class="notice notice-danger" role="alert">{{ store.error() }} <button type="button" class="link-button" (click)="store.load()">Obnovit seznam</button></p> }
  @if (store.loading()) { <p role="status">Načítám osoby…</p> }
  <router-outlet />
` })
export class PeopleLayout { protected readonly store = inject(PeopleStore); }

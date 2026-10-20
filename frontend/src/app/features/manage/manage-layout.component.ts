import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

// Správa souboru (dřív Administrace) – obrazovky pro pověření Správa souboru.
// Nedává přístup k obsahu soukromých skupin; běžná práce s obsahem se dělá přímo ve skupině.
@Component({
  selector: 'app-manage-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="page">
      <h1 class="page__title">Správa</h1>
      <nav class="group-tabs" aria-label="Správa souboru">
        <a routerLink="/app/manage/members" routerLinkActive="group-tabs__link--active" class="group-tabs__link">Členové</a>
        <a routerLink="/app/manage/groups" routerLinkActive="group-tabs__link--active" class="group-tabs__link">Skupiny</a>
        <a routerLink="/app/manage/config" routerLinkActive="group-tabs__link--active" class="group-tabs__link">Konfigurace</a>
        <a routerLink="/app/manage/history" routerLinkActive="group-tabs__link--active" class="group-tabs__link">Historie</a>
      </nav>
      <router-outlet />
    </div>
  `,
})
export class ManageLayoutComponent {}

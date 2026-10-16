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
      <nav class="manage-tabs" aria-label="Správa souboru">
        <a routerLink="/app/manage/members" routerLinkActive="manage-tabs__link--active" class="manage-tabs__link">Členové</a>
        <a routerLink="/app/manage/groups" routerLinkActive="manage-tabs__link--active" class="manage-tabs__link">Skupiny</a>
        <a routerLink="/app/manage/config" routerLinkActive="manage-tabs__link--active" class="manage-tabs__link">Konfigurace</a>
        <a routerLink="/app/manage/history" routerLinkActive="manage-tabs__link--active" class="manage-tabs__link">Historie</a>
      </nav>
      <router-outlet />
    </div>
  `,
  styles: [`
    .manage-tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--color-border); margin-bottom: var(--spacing-md); overflow-x: auto; }
    .manage-tabs__link { padding: 8px 12px; font-size: var(--font-size-sm); font-weight: 600; color: var(--color-text-muted); border-bottom: 2px solid transparent; white-space: nowrap; }
    .manage-tabs__link:hover { color: var(--color-text); }
    .manage-tabs__link--active { color: var(--color-primary); border-bottom-color: var(--color-primary); }
  `],
})
export class ManageLayoutComponent {}

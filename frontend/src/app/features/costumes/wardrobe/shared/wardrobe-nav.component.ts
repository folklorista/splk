import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

// Záložky Správy krojů – samostatná sekce, oddělená od osobních „Mých krojů“
@Component({
  selector: 'app-wardrobe-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="costumes-nav no-print" aria-label="Správa krojů">
      @for (tab of tabs; track tab.path) {
        <a [routerLink]="tab.path" routerLinkActive="costumes-nav__link--active" class="costumes-nav__link">{{ tab.label }}</a>
      }
    </nav>
  `,
})
export class WardrobeNavComponent {
  readonly tabs = [
    { path: '/app/wardrobe/stock', label: 'Součástky' },
    { path: '/app/wardrobe/cards', label: 'Krojové karty' },
    { path: '/app/wardrobe/loans', label: 'Výpůjčky' },
    { path: '/app/wardrobe/inventories', label: 'Inventury' },
    { path: '/app/wardrobe/settings', label: 'Nastavení' },
  ];
}

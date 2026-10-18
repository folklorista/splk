import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

// Záložky Krojárny – samostatná sekce, oddělená od osobních „Mých krojů“
@Component({
  selector: 'app-wardrobe-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="costumes-nav no-print" aria-label="Krojárna">
      @for (tab of tabs; track tab.path) {
        <a [routerLink]="tab.path" routerLinkActive="costumes-nav__link--active" class="costumes-nav__link">{{ tab.label }}</a>
      }
    </nav>
  `,
})
export class WardrobeNavComponent {
  readonly tabs = [
    { path: '/app/wardrobe/stock', label: 'Sklad' },
    { path: '/app/wardrobe/cards', label: 'Krojové karty' },
    { path: '/app/wardrobe/loans', label: 'Výpůjčky' },
    { path: '/app/wardrobe/inventories', label: 'Inventury' },
    { path: '/app/wardrobe/settings', label: 'Nastavení' },
  ];
}

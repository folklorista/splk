import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { AccessService } from '../../../core/access/access.service';

// Záložky krojového skladu – běžný člen vidí jen „Moje kroje“, záložky se mu nezobrazí
@Component({
  selector: 'app-costumes-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    @if (visible()) {
      <nav class="costumes-nav no-print" aria-label="Krojový sklad">
        <a routerLink="/app/costumes" routerLinkActive="costumes-nav__link--active" [routerLinkActiveOptions]="{ exact: true }" class="costumes-nav__link">Přehled</a>
        <a routerLink="/app/costumes/items" routerLinkActive="costumes-nav__link--active" class="costumes-nav__link">Součásti</a>
        <a routerLink="/app/costumes/kits" routerLinkActive="costumes-nav__link--active" class="costumes-nav__link">Komplety</a>
        <a routerLink="/app/costumes/loans" routerLinkActive="costumes-nav__link--active" class="costumes-nav__link">Zápůjčky</a>
        <a routerLink="/app/costumes/people" routerLinkActive="costumes-nav__link--active" class="costumes-nav__link">Lidé</a>
        <a routerLink="/app/costumes/inventories" routerLinkActive="costumes-nav__link--active" class="costumes-nav__link">Inventury</a>
      </nav>
    }
  `,
})
export class CostumesNavComponent {
  private readonly accessService = inject(AccessService);
  readonly visible = this.accessService.canViewCostumeStock;

  constructor(private auth: AuthService) {}
}

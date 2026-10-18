import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NavigationService } from '../../core/layout/navigation.service';
import { IconComponent } from '../../shared/icon/icon.component';
import { Place } from '../../core/layout/bottom-bar';

// Stránka „Více“ (docs/10 kap. 6.2): místa, která se nevešla do spodní lišty, ostatní dostupná místa
// a osobní odkazy. Nastavení a Profil jsou navíc vždy v hlavičce.
@Component({
  selector: 'app-more',
  standalone: true,
  imports: [RouterLink, IconComponent],
  template: `
    <div class="page">
      <h1 class="page__title">Více</h1>
      @if (overflow().length) {
        <h2 class="more__heading">Z vaší lišty</h2>
        <div class="more__grid">
          @for (place of overflow(); track place.key) {
            <a class="more__tile" [routerLink]="place.path">
              <app-icon [name]="place.icon" [size]="22" />
              <span class="more__label">{{ place.label }}</span>
              @if (place.badge) { <span class="more__badge">{{ place.badge }}</span> }
            </a>
          }
        </div>
      }
      @if (others().length) {
        <h2 class="more__heading">Další místa</h2>
        <div class="more__grid">
          @for (place of others(); track place.key) {
            <a class="more__tile" [routerLink]="place.path">
              <app-icon [name]="place.icon" [size]="22" />
              <span class="more__label">{{ place.label }}</span>
              @if (place.badge) { <span class="more__badge">{{ place.badge }}</span> }
            </a>
          }
        </div>
      }
      <h2 class="more__heading">Osobní</h2>
      <div class="more__grid">
        <a class="more__tile" routerLink="/app/profile"><app-icon name="user" [size]="22" /><span class="more__label">Můj profil</span></a>
        <a class="more__tile" routerLink="/app/settings"><app-icon name="settings" [size]="22" /><span class="more__label">Nastavení</span></a>
        <a class="more__tile" routerLink="/app/changelog"><app-icon name="star" [size]="22" /><span class="more__label">Novinky</span></a>
      </div>
      <a class="more__edit" routerLink="/app/settings" fragment="spodni-lista">Upravit spodní lištu →</a>
    </div>
  `,
  styles: [`
    .more__heading { font-size: var(--font-size-xs); font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-text-muted); margin: var(--spacing-lg) 0 var(--spacing-sm); }
    .more__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: var(--spacing-sm); }
    .more__tile { position: relative; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: var(--spacing-md) var(--spacing-sm); border: 1px solid var(--color-border); border-radius: 10px; background: var(--color-surface); color: var(--color-text); text-decoration: none; text-align: center; }
    .more__tile:hover { border-color: var(--color-primary); color: var(--color-primary); }
    .more__label { font-size: var(--font-size-sm); }
    .more__badge { position: absolute; top: 6px; right: 6px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; background: var(--color-primary); color: #fff; font-size: 11px; line-height: 18px; }
    .more__edit { display: inline-block; margin-top: var(--spacing-lg); font-size: var(--font-size-sm); }
  `],
})
export class MoreComponent {
  private navigation = inject(NavigationService);
  readonly overflow = computed(() => this.navigation.resolvedBar().overflow);
  // Místa mimo lištu i mimo „Z vaší lišty“
  readonly others = computed<Place[]>(() => {
    const { bar, overflow } = this.navigation.resolvedBar();
    const shown = new Set([...bar, ...overflow].map((p) => p.key));
    return this.navigation.orderedPlaces().filter((p) => !shown.has(p.key));
  });
}

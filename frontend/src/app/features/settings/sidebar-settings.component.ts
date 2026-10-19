import { Component, computed, inject } from '@angular/core';
import { NavigationService } from '../../core/layout/navigation.service';
import { SettingsService } from '../../core/settings/settings.service';
import { Place } from '../../core/layout/bottom-bar';
import { SIDEBAR_SECTION_LABELS, moveInSidebar, sectionPlaces, toggleHiddenInSidebar } from '../../core/layout/sidebar-menu';
import { IconComponent } from '../../shared/icon/icon.component';

// Nastavení → Boční menu (desktop): pořadí a skrytí položek jen uvnitř sekcí Moje skupiny a Agendy.
// Nezávislé na spodní liště. Skryté položky zůstávají v menu pod „Další“ (skupiny i v rozcestníku Skupiny).
@Component({
  selector: 'app-sidebar-settings',
  standalone: true,
  imports: [IconComponent],
  template: `
    <section class="settings__section bb" id="bocni-menu">
      <div class="bb__header">
        <h2 class="settings__title">Boční menu</h2>
        <button type="button" class="cs-btn" [disabled]="isDefault()" (click)="reset()">Obnovit výchozí</button>
      </div>
      <p class="settings__hint bb__intro">Na počítači. Pořadí lze měnit jen uvnitř sekcí Moje skupiny a Agendy. Skryté položky najdete v menu pod „Další“, skupiny i v rozcestníku Skupiny. Menu sbalíte na ikony tlačítkem v jeho hlavičce.</p>

      <ul class="bb__list">
        @for (place of fixedMain(); track place.key) {
          <li class="bb__row bb__row--locked"><app-icon [name]="place.icon" [size]="18" /><span class="bb__label">{{ place.label }}</span><span class="settings__hint">pevné</span></li>
        }
      </ul>

      @for (section of sections(); track section.key) {
        <h3 class="bb__subtitle">{{ section.label }}</h3>
        <ul class="bb__list">
          @for (place of section.places; track place.key; let i = $index; let last = $last) {
            <li class="bb__row" [class.bb__row--hidden]="isHidden(place)">
              <app-icon [name]="place.icon" [size]="18" />
              <span class="bb__label">{{ place.label }}@if (isHidden(place)) { <span class="settings__hint"> – pod „Další“</span> }</span>
              <span class="bb__actions">
                <button type="button" class="bb__btn" [disabled]="i === 0" (click)="move(place.key, -1)" [attr.aria-label]="'Posunout výš: ' + place.label">↑</button>
                <button type="button" class="bb__btn" [disabled]="last" (click)="move(place.key, 1)" [attr.aria-label]="'Posunout níž: ' + place.label">↓</button>
                <button type="button" class="bb__btn" (click)="toggleHidden(place.key)" [attr.aria-pressed]="isHidden(place)" [attr.aria-label]="(isHidden(place) ? 'Zobrazit v menu: ' : 'Skrýt z menu: ') + place.label">{{ isHidden(place) ? 'Zobrazit' : 'Skrýt' }}</button>
              </span>
            </li>
          }
        </ul>
      }

      @if (fixedEnsemble().length) {
        <h3 class="bb__subtitle">{{ ensembleLabel }}</h3>
        <ul class="bb__list">
          @for (place of fixedEnsemble(); track place.key) {
            <li class="bb__row bb__row--locked"><app-icon [name]="place.icon" [size]="18" /><span class="bb__label">{{ place.label }}</span><span class="settings__hint">pevné</span></li>
          }
        </ul>
      }
    </section>
  `,
  styles: [`
    .bb__header { display: flex; align-items: center; justify-content: space-between; gap: var(--spacing-sm); }
    .bb__intro { margin-bottom: var(--spacing-sm); }
    .bb__list { list-style: none; padding: 0; margin: 0 0 var(--spacing-sm); display: flex; flex-direction: column; gap: 4px; }
    .bb__row { display: flex; align-items: center; gap: var(--spacing-sm); padding: 6px var(--spacing-sm); border: 1px solid var(--color-border); border-radius: 6px; }
    .bb__row--locked { background: var(--color-surface-alt); }
    .bb__row--hidden { color: var(--color-text-muted); border-style: dashed; }
    .bb__label { flex: 1; min-width: 0; }
    .bb__actions { display: flex; gap: 4px; }
    .bb__btn { min-width: 32px; min-height: 32px; padding: 0 8px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); color: var(--color-text); cursor: pointer; }
    .bb__btn:disabled { opacity: 0.4; cursor: default; }
    .bb__subtitle { font-size: var(--font-size-sm); font-weight: 600; margin: var(--spacing-md) 0 var(--spacing-xs); }
  `],
})
export class SidebarSettingsComponent {
  private navigation = inject(NavigationService);
  private settings = inject(SettingsService);

  readonly ensembleLabel = SIDEBAR_SECTION_LABELS.ensemble;
  private config = computed(() => this.settings.settings().sidebarMenu);
  readonly isDefault = computed(() => this.config() === null);

  readonly fixedMain = computed<Pick<Place, 'key' | 'label' | 'icon'>[]>(() => [
    { key: 'dashboard', label: 'Přehled', icon: 'home' },
    ...sectionPlaces(this.navigation.places(), null, 'main'),
  ]);
  readonly fixedEnsemble = computed(() => sectionPlaces(this.navigation.places(), null, 'ensemble'));
  readonly sections = computed(() =>
    (['groups', 'agendas'] as const)
      .map((key) => ({ key, label: SIDEBAR_SECTION_LABELS[key], places: sectionPlaces(this.navigation.places(), this.config(), key) }))
      .filter((s) => s.places.length),
  );

  isHidden(place: Place): boolean {
    return this.config()?.hidden.includes(place.key) ?? false;
  }

  move(key: string, delta: -1 | 1): void {
    this.settings.update({ sidebarMenu: moveInSidebar(this.navigation.places(), this.config(), key, delta) });
  }

  toggleHidden(key: string): void {
    this.settings.update({ sidebarMenu: toggleHiddenInSidebar(this.navigation.places(), this.config(), key) });
  }

  reset(): void {
    this.settings.update({ sidebarMenu: null });
  }
}

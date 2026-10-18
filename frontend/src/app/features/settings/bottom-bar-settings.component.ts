import { Component, computed, inject } from '@angular/core';
import { NavigationService } from '../../core/layout/navigation.service';
import { SettingsService } from '../../core/settings/settings.service';
import { BAR_SLOTS, defaultBarKeys, moveKey, resolveBar } from '../../core/layout/bottom-bar';
import { IconComponent } from '../../shared/icon/icon.component';

// Nastavení → Spodní lišta (docs/10 kap. 6.2): výběr a pořadí míst za Přehledem.
// Řazení šipkami (přístupné bez tažení); čára ukazuje, co se schová pod „Více“.
@Component({
  selector: 'app-bottom-bar-settings',
  standalone: true,
  imports: [IconComponent],
  template: `
    <section class="settings__section bb" id="spodni-lista">
      <div class="bb__header">
        <h2 class="settings__title">Spodní lišta</h2>
        <button type="button" class="cs-btn" [disabled]="isAuto()" (click)="reset()">Obnovit výchozí</button>
      </div>
      <p class="settings__hint">Na mobilu. Přehled je vždy první, za ním až 4 místa. Vyberete-li víc, poslední se schovají pod „Více“. {{ isAuto() ? 'Teď platí automatický návrh podle vašich skupin a pověření.' : '' }}</p>
      <p class="bb__preview" aria-label="Náhled lišty">{{ preview() }}</p>

      <ul class="bb__list">
        <li class="bb__row bb__row--locked"><app-icon name="home" [size]="18" /><span class="bb__label">Přehled</span><span class="settings__hint">vždy první</span></li>
        @for (place of chosen(); track place.key; let i = $index; let last = $last) {
          @if (overflowFrom() === i) { <li class="bb__divider">od sem dál se zobrazí pod „Více“</li> }
          <li class="bb__row">
            <app-icon [name]="place.icon" [size]="18" />
            <span class="bb__label">{{ place.label }}</span>
            <span class="bb__actions">
              <button type="button" class="bb__btn" [disabled]="i === 0" (click)="move(place.key, -1)" [attr.aria-label]="'Posunout výš: ' + place.label">↑</button>
              <button type="button" class="bb__btn" [disabled]="last" (click)="move(place.key, 1)" [attr.aria-label]="'Posunout níž: ' + place.label">↓</button>
              <button type="button" class="bb__btn" (click)="remove(place.key)" [attr.aria-label]="'Odebrat z lišty: ' + place.label">Odebrat</button>
            </span>
          </li>
        }
      </ul>

      @if (available().length) {
        <h3 class="bb__subtitle">Další dostupná místa</h3>
        <ul class="bb__list">
          @for (place of available(); track place.key) {
            <li class="bb__row">
              <app-icon [name]="place.icon" [size]="18" />
              <span class="bb__label">{{ place.label }}@if (place.key === 'groups') { <span class="settings__hint"> – všechny skupiny v jedné položce</span> }</span>
              <button type="button" class="bb__btn" (click)="add(place.key)">Přidat</button>
            </li>
          }
        </ul>
      }
    </section>
  `,
  styles: [`
    .bb__header { display: flex; align-items: center; justify-content: space-between; gap: var(--spacing-sm); }
    .bb__preview { font-size: var(--font-size-sm); padding: var(--spacing-xs) var(--spacing-sm); border: 1px dashed var(--color-border); border-radius: 6px; margin: var(--spacing-sm) 0; }
    .bb__list { list-style: none; padding: 0; margin: 0 0 var(--spacing-sm); display: flex; flex-direction: column; gap: 4px; }
    .bb__row { display: flex; align-items: center; gap: var(--spacing-sm); padding: 6px var(--spacing-sm); border: 1px solid var(--color-border); border-radius: 6px; }
    .bb__row--locked { background: var(--color-surface-alt); }
    .bb__label { flex: 1; min-width: 0; }
    .bb__actions { display: flex; gap: 4px; }
    .bb__btn { min-width: 32px; min-height: 32px; padding: 0 8px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); color: var(--color-text); cursor: pointer; }
    .bb__btn:disabled { opacity: 0.4; cursor: default; }
    .bb__divider { font-size: var(--font-size-xs); color: var(--color-text-muted); text-align: center; border-top: 1px dashed var(--color-border); padding-top: 4px; }
    .bb__subtitle { font-size: var(--font-size-sm); font-weight: 600; margin: var(--spacing-md) 0 var(--spacing-xs); }
  `],
})
export class BottomBarSettingsComponent {
  private navigation = inject(NavigationService);
  private settings = inject(SettingsService);

  readonly isAuto = computed(() => this.settings.settings().bottomBar === null);
  private keys = computed(() => {
    const places = this.navigation.places();
    const available = new Set(places.map((p) => p.key));
    return (this.settings.settings().bottomBar ?? defaultBarKeys(places)).filter((k) => available.has(k));
  });
  readonly chosen = computed(() => this.keys().map((k) => this.navigation.places().find((p) => p.key === k)!));
  readonly available = computed(() => this.navigation.places().filter((p) => !this.keys().includes(p.key)));
  // Index, od kterého se místa schovají pod „Více“ (−1 = vše se vejde)
  readonly overflowFrom = computed(() => (this.keys().length > BAR_SLOTS ? BAR_SLOTS - 1 : -1));
  readonly preview = computed(() => {
    const { bar, overflow } = resolveBar(this.navigation.places(), this.keys());
    return ['Přehled', ...bar.map((p) => p.label), ...(overflow.length ? ['Více'] : [])].join(' · ');
  });

  private save(keys: string[]): void {
    this.settings.update({ bottomBar: keys });
  }

  move(key: string, delta: -1 | 1): void {
    this.save(moveKey(this.keys(), key, delta));
  }

  remove(key: string): void {
    this.save(this.keys().filter((k) => k !== key));
  }

  add(key: string): void {
    this.save([...this.keys(), key]);
  }

  reset(): void {
    this.settings.update({ bottomBar: null });
  }
}

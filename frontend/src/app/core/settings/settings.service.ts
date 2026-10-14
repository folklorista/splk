import { Injectable, effect, signal } from '@angular/core';

export type ThemeSetting = 'light' | 'dark' | 'auto';
export type FontSizeSetting = 'normal' | 'larger' | 'largest';
export type EventsViewSetting = 'list' | 'calendar';

export interface AppSettings {
  theme: ThemeSetting;
  fontSize: FontSizeSetting;
  eventsView: EventsViewSetting;
  // null = podle systému (prefers-reduced-motion)
  reduceMotion: boolean | null;
}

export const SETTINGS_STORAGE_KEY = 'splk.settings';

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'auto',
  fontSize: 'normal',
  eventsView: 'list',
  reduceMotion: null,
};

function readStoredSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

const media = (query: string): MediaQueryList | null =>
  typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query) : null;

// Nastavení „jak se mi aplikace chová“ – uložené jen v tomto zařízení (ne demo data, reset je nesmaže).
// Projeví se jako atributy na <html>: data-theme, data-font-size, data-reduce-motion.
@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly _settings = signal<AppSettings>(readStoredSettings());
  readonly settings = this._settings.asReadonly();

  private readonly darkQuery = media('(prefers-color-scheme: dark)');
  private readonly motionQuery = media('(prefers-reduced-motion: reduce)');
  private readonly systemDark = signal(this.darkQuery?.matches ?? false);
  readonly systemReducedMotion = signal(this.motionQuery?.matches ?? false);

  constructor() {
    this.darkQuery?.addEventListener('change', (e) => this.systemDark.set(e.matches));
    this.motionQuery?.addEventListener('change', (e) => this.systemReducedMotion.set(e.matches));
    effect(() => this.apply(document.documentElement));
  }

  update(changes: Partial<AppSettings>): void {
    this._settings.update((current) => ({ ...current, ...changes }));
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this._settings()));
    } catch {
      // úložiště nedostupné – nastavení platí do zavření stránky
    }
  }

  resolvedTheme(): 'light' | 'dark' {
    const theme = this._settings().theme;
    return theme === 'auto' ? (this.systemDark() ? 'dark' : 'light') : theme;
  }

  resolvedReduceMotion(): boolean {
    return this._settings().reduceMotion ?? this.systemReducedMotion();
  }

  private apply(root: HTMLElement): void {
    root.dataset['theme'] = this.resolvedTheme();
    root.dataset['fontSize'] = this._settings().fontSize;
    root.dataset['reduceMotion'] = String(this.resolvedReduceMotion());
  }
}

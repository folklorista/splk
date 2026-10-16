import { Injectable, signal } from '@angular/core';
import { DEFAULT_ENSEMBLE_SETTINGS, EnsembleSettings } from '../../core/models/ensemble-settings.model';
import { loadDemoData, saveDemoData } from '../../core/data/demo-storage';

const seed = (): EnsembleSettings => structuredClone(DEFAULT_ENSEMBLE_SETTINGS);

// Konfigurace souboru (Správa → Konfigurace) – na rozdíl od osobního Nastavení platí pro všechny
@Injectable({ providedIn: 'root' })
export class EnsembleSettingsService {
  private readonly _settings = signal<EnsembleSettings>({ ...seed(), ...loadDemoData('ensemble-settings', seed) });
  readonly settings = this._settings.asReadonly();

  save(settings: EnsembleSettings): void {
    this._settings.set(settings);
    saveDemoData('ensemble-settings', settings);
  }

  resetCache(): void {
    this._settings.set(seed());
  }
}

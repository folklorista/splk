import { Injectable, signal } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs/operators';

const CHECK_INTERVAL_MS = 15 * 60 * 1000;

// Service worker servíruje aplikaci z cache – novou verzi z webu stáhne na pozadí
// a tady se uživateli nabídne, aby ji načetl
@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  readonly updateReady = signal(false);

  constructor(private swUpdate: SwUpdate) {
    if (!swUpdate.isEnabled) return;

    swUpdate.versionUpdates
      .pipe(filter((event): event is VersionReadyEvent => event.type === 'VERSION_READY'))
      .subscribe(() => this.updateReady.set(true));

    // Otevřená PWA nemusí být dlouho znovu načtená – o nové verzi se jinak nedozví
    setInterval(() => this.check(), CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.check();
    });
  }

  async applyUpdate(): Promise<void> {
    await this.swUpdate.activateUpdate();
    this.reload();
  }

  protected reload(): void {
    window.location.reload();
  }

  private check(): void {
    this.swUpdate.checkForUpdate().catch(() => {
      // offline nebo nedostupný server – zkusí se příště
    });
  }
}

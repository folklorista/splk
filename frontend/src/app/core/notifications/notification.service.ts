import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  readonly isSupported = typeof Notification !== 'undefined';
  readonly permission = signal<NotificationPermission>(this.isSupported ? Notification.permission : 'denied');

  requestPermission(): void {
    if (!this.isSupported) return;
    Notification.requestPermission().then((result) => this.permission.set(result));
  }

  notify(title: string, body: string): void {
    if (!this.isSupported || this.permission() !== 'granted') return;

    // Přes service worker fungují notifikace spolehlivěji na mobilu (nainstalovaná PWA);
    // bez registrace (např. lokální vývoj) spadneme na obyčejný Notification konstruktor.
    navigator.serviceWorker?.getRegistration().then((registration) => {
      const options: NotificationOptions = { body, icon: 'icons/icon-192x192.png' };
      if (registration) {
        registration.showNotification(title, options);
      } else {
        new Notification(title, options);
      }
    });
  }
}

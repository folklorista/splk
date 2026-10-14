import { Component, inject } from '@angular/core';
import { AppSettings, SettingsService } from '../../core/settings/settings.service';
import { NotificationService } from '../../core/notifications/notification.service';

interface Option<T> {
  value: T;
  label: string;
}

// Nastavení = jak se mi aplikace chová (v tomto zařízení); Profil = údaje o mně
@Component({
  selector: 'app-settings',
  standalone: true,
  templateUrl: './settings.component.html',
})
export class SettingsComponent {
  readonly settingsService = inject(SettingsService);
  private readonly notificationService = inject(NotificationService);

  readonly settings = this.settingsService.settings;
  readonly notificationPermission = this.notificationService.permission;
  readonly notificationsSupported = this.notificationService.isSupported;

  readonly themeOptions: Option<AppSettings['theme']>[] = [
    { value: 'auto', label: 'Podle systému' },
    { value: 'light', label: 'Světlý' },
    { value: 'dark', label: 'Tmavý' },
  ];
  readonly fontSizeOptions: Option<AppSettings['fontSize']>[] = [
    { value: 'normal', label: 'Normální' },
    { value: 'larger', label: 'Větší' },
    { value: 'largest', label: 'Největší' },
  ];
  readonly eventsViewOptions: Option<AppSettings['eventsView']>[] = [
    { value: 'list', label: 'Seznam' },
    { value: 'calendar', label: 'Kalendář' },
  ];

  update(changes: Partial<AppSettings>): void {
    this.settingsService.update(changes);
  }

  enableNotifications(): void {
    this.notificationService.requestPermission();
  }
}

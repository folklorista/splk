import { Component, inject } from '@angular/core';
import { AppSettings, SettingsService } from '../../core/settings/settings.service';
import { NotificationService } from '../../core/notifications/notification.service';
import { GroupNotificationsService } from '../../core/notifications/group-notifications.service';
import { GROUP_NOTIFY_LABELS, GroupNotifyMode } from '../../core/notifications/group-notifications';
import { AccessService } from '../../core/access/access.service';
import { BottomBarSettingsComponent } from './bottom-bar-settings.component';
import { SidebarSettingsComponent } from './sidebar-settings.component';
import { CalendarExportComponent } from './calendar-export.component';
import { AvatarSettingsComponent } from './avatar-settings.component';

interface Option<T> {
  value: T;
  label: string;
}

// Nastavení = jak se mi aplikace chová (v tomto zařízení); Profil = údaje o mně
@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [BottomBarSettingsComponent, SidebarSettingsComponent, CalendarExportComponent, AvatarSettingsComponent],
  templateUrl: './settings.component.html',
})
export class SettingsComponent {
  readonly settingsService = inject(SettingsService);
  private readonly notificationService = inject(NotificationService);
  private readonly groupNotify = inject(GroupNotificationsService);
  private readonly access = inject(AccessService);
  readonly myGroups = this.access.myGroups;
  readonly notifyOptions = Object.entries(GROUP_NOTIFY_LABELS) as [GroupNotifyMode, string][];

  notifyMode(groupId: number): GroupNotifyMode {
    return this.groupNotify.modeFor(this.access.memberId(), groupId);
  }

  setNotifyMode(groupId: number, mode: GroupNotifyMode): void {
    const memberId = this.access.memberId();
    if (memberId) this.groupNotify.setMode(memberId, groupId, mode);
  }

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

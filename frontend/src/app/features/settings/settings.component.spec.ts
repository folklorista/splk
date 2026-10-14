import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { SettingsComponent } from './settings.component';
import { SettingsService } from '../../core/settings/settings.service';
import { NotificationService } from '../../core/notifications/notification.service';

describe('SettingsComponent', () => {
  it('změny předává službě nastavení', () => {
    TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [{ provide: NotificationService, useValue: { permission: signal('default'), isSupported: true, requestPermission: () => {} } }],
    });
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();
    const service = TestBed.inject(SettingsService);

    fixture.componentInstance.update({ eventsView: 'calendar' });

    expect(service.settings().eventsView).toBe('calendar');
  });
});

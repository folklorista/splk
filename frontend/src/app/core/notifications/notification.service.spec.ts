import { TestBed } from '@angular/core/testing';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NotificationService);
  });

  it('notify nic neudělá bez povolení', () => {
    service.permission.set('default');
    const getRegistrationSpy = spyOn(navigator.serviceWorker, 'getRegistration');

    service.notify('Titulek', 'Text');

    expect(getRegistrationSpy).not.toHaveBeenCalled();
  });

  it('notify si vyžádá registraci service workeru, když je povoleno', () => {
    service.permission.set('granted');
    const getRegistrationSpy = spyOn(navigator.serviceWorker, 'getRegistration').and.returnValue(Promise.resolve(undefined));

    service.notify('Titulek', 'Text');

    expect(getRegistrationSpy).toHaveBeenCalled();
  });

  it('requestPermission zavolá Notification.requestPermission a uloží výsledek', async () => {
    spyOn(Notification, 'requestPermission').and.returnValue(Promise.resolve('granted'));

    service.requestPermission();
    await Promise.resolve();

    expect(service.permission()).toBe('granted');
  });
});

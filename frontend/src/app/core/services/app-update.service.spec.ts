import { TestBed } from '@angular/core/testing';
import { SwUpdate, VersionEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { AppUpdateService } from './app-update.service';

describe('AppUpdateService', () => {
  let versionUpdates: Subject<VersionEvent>;
  let swUpdate: jasmine.SpyObj<SwUpdate>;

  function create(isEnabled: boolean): AppUpdateService {
    versionUpdates = new Subject<VersionEvent>();
    swUpdate = jasmine.createSpyObj('SwUpdate', ['activateUpdate', 'checkForUpdate'], {
      isEnabled,
      versionUpdates: versionUpdates.asObservable(),
    });
    swUpdate.activateUpdate.and.resolveTo(true);
    swUpdate.checkForUpdate.and.resolveTo(false);
    TestBed.configureTestingModule({ providers: [{ provide: SwUpdate, useValue: swUpdate }] });
    return TestBed.inject(AppUpdateService);
  }

  it('po stažení nové verze nabídne aktualizaci', () => {
    const service = create(true);
    versionUpdates.next({ type: 'VERSION_DETECTED', version: { hash: 'b' } });
    expect(service.updateReady()).toBeFalse();

    versionUpdates.next({ type: 'VERSION_READY', currentVersion: { hash: 'a' }, latestVersion: { hash: 'b' } });
    expect(service.updateReady()).toBeTrue();
  });

  it('aktualizace aktivuje novou verzi a znovu načte stránku', async () => {
    const service = create(true);
    const reload = spyOn<any>(service, 'reload');

    await service.applyUpdate();

    expect(swUpdate.activateUpdate).toHaveBeenCalled();
    expect(reload).toHaveBeenCalled();
  });

  it('bez service workeru (vývoj) nic nehlídá', () => {
    const service = create(false);
    versionUpdates.next({ type: 'VERSION_READY', currentVersion: { hash: 'a' }, latestVersion: { hash: 'b' } });
    expect(service.updateReady()).toBeFalse();
  });
});

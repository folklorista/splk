import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { AvailabilityService } from './availability.service';
import { AccessService } from '../../core/access/access.service';
import { AccessSubject } from '../../core/access/access.utils';
import { AccessDeniedError, RuleViolationError } from '../../core/access/mandate-rules';
import { clearDemoData } from '../../core/data/demo-storage';
import { testMandate } from '../../testing/access.testing';
import { overlapsRange, unavailableDuring, upcomingUnavailability } from './unavailability.utils';

describe('AvailabilityService', () => {
  let service: AvailabilityService;
  let subject: AccessSubject;
  const member = (memberId: number, mandates = [] as AccessSubject['mandates']): AccessSubject => ({ memberId, groupIds: [2], isExternal: false, mandates });
  const event = { id: 1, targetGroupIds: [], startsAt: '2026-11-10T18:00:00', endsAt: '2026-11-10T20:00:00' };

  beforeEach(() => {
    clearDemoData();
    subject = member(50);
    TestBed.configureTestingModule({
      providers: [{ provide: AccessService, useValue: { memberId: () => subject.memberId, subject: () => subject } }],
    });
    service = TestBed.inject(AvailabilityService);
  });

  afterEach(() => clearDemoData());

  it('člen přidá a smaže vlastní nedostupnost; neplatné období odmítne', async () => {
    const item = await firstValueFrom(service.add({ from: '2026-11-05', to: '2026-11-15', note: ' dovolená ' }));
    expect(item.memberId).toBe(50);
    expect(item.note).toBe('dovolená');
    expect(service.mine().map((u) => u.id)).toContain(item.id);
    await expectAsync(firstValueFrom(service.add({ from: '2026-11-15', to: '2026-11-05' }))).toBeRejectedWithError(RuleViolationError);

    subject = member(51);
    await expectAsync(firstValueFrom(service.remove(item.id))).toBeRejectedWithError(AccessDeniedError);
    subject = member(50);
    await firstValueFrom(service.remove(item.id));
    expect(service.mine().some((u) => u.id === item.id)).toBeFalse();
  });

  it('u akce vidí nedostupnost jen pověřený organizátor, ne běžný člen', async () => {
    await firstValueFrom(service.add({ from: '2026-11-05', to: '2026-11-15' }));
    subject = member(51);
    expect(service.forEvent(event).length).toBe(0);
    subject = member(51, [testMandate(51, 'events')]);
    expect(service.forEvent(event).some((u) => u.memberId === 50)).toBeTrue();
    expect(service.forPlanning(event.startsAt, event.endsAt, [50]).length).toBe(1);
    expect(service.forPlanning(event.startsAt, event.endsAt, [99]).length).toBe(0);
  });

  it('překryv se počítá po dnech včetně krajních dní; proběhlé se v profilu nezobrazí', () => {
    const item = { from: '2026-11-10', to: '2026-11-12' };
    expect(overlapsRange(item, '2026-11-12T18:00:00', '2026-11-12T20:00:00')).toBeTrue();
    expect(overlapsRange(item, '2026-11-13T18:00:00', '2026-11-13T20:00:00')).toBeFalse();
    expect(overlapsRange(item, '2026-11-08T10:00:00', '2026-11-10T10:00:00')).toBeTrue();
    const rows = [{ id: 1, ensembleId: 1, memberId: 1, createdAt: '', createdById: 1, ...item }];
    expect(unavailableDuring(rows, '2026-11-11T00:00:00', '2026-11-11T23:00:00', [2]).length).toBe(0);
    expect(upcomingUnavailability(rows, '2026-11-13T00:00:00Z').length).toBe(0);
    expect(upcomingUnavailability(rows, '2026-11-12T00:00:00Z').length).toBe(1);
  });
});

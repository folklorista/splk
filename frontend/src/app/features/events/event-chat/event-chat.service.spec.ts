import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { EventChatService, isEventChatEnabled } from './event-chat.service';
import { AccessService } from '../../../core/access/access.service';
import { AccessDeniedError } from '../../../core/access/mandate-rules';
import { clearDemoData } from '../../../core/data/demo-storage';
import { createTestAccess, testMember } from '../../../testing/access.testing';
import { AppEvent } from '../models/event.model';

describe('EventChatService', () => {
  const event: AppEvent = { id: 1, ensembleId: 1, title: 'Hody', type: 'performance', startsAt: '2099-01-01T10:00:00', endsAt: '2099-01-01T12:00:00', location: '', targetGroupIds: [2] };
  let env: ReturnType<typeof createTestAccess>;

  function create(memberGroups: number[]): EventChatService {
    clearDemoData();
    env = createTestAccess(testMember({ id: 7, groupIds: memberGroups }));
    TestBed.configureTestingModule({ providers: [{ provide: AccessService, useValue: env.access }] });
    return TestBed.inject(EventChatService);
  }

  afterEach(() => clearDemoData());

  it('chat je povolený, pokud není výslovně vypnutý a termín není vynechaný', () => {
    expect(isEventChatEnabled(event)).toBeTrue();
    expect(isEventChatEnabled({ ...event, chatEnabled: false })).toBeFalse();
    expect(isEventChatEnabled({ ...event, skippedReason: 'Svátek' })).toBeFalse();
  });

  it('oslovený člen píše a vidí zprávy; vlastní zprávu smaže', async () => {
    const service = create([2]);
    const message = await firstValueFrom(service.send(event, 'Kdo veze kroje?', []));
    expect(service.messagesFor(event).map((m) => m.id)).toEqual([message.id]);
    await firstValueFrom(service.remove(event, message.id));
    expect(service.messagesFor(event)[0].deletedAt).toBeTruthy();
  });

  it('kdo akci nevidí, nepíše ani nečte', async () => {
    const service = create([9]);
    expect(service.canWrite(event)).toBeFalse();
    await expectAsync(firstValueFrom(service.send(event, 'Ahoj', []))).toBeRejectedWithError(AccessDeniedError);
    expect(service.messagesFor(event)).toEqual([]);
  });
});

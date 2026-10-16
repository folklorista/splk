import { TestBed } from '@angular/core/testing';
import { ChatService } from './chat.service';
import { AccessService } from '../../core/access/access.service';
import { AccessDeniedError, RuleViolationError } from '../../core/access/mandate-rules';
import { createTestAccess, testMandate, testMember } from '../../testing/access.testing';
import { ChatMessage } from './models/chat-message.model';
import { MOCK_GROUPS } from '../../core/data/mock-groups';
import { GroupsService } from '../groups/groups.service';

describe('ChatService', () => {
  const HOLKY = 5;
  let env: ReturnType<typeof createTestAccess>;
  let service: ChatService;

  function send(body = 'Ahoj', groupId = HOLKY): { value?: ChatMessage; error?: unknown } {
    const result: { value?: ChatMessage; error?: unknown } = {};
    service.send(groupId, body, []).subscribe({ next: (v) => (result.value = v), error: (e) => (result.error = e) });
    return result;
  }

  beforeEach(() => {
    env = createTestAccess(testMember({ id: 1, groupIds: [HOLKY] }), { members: [testMember({ id: 1, groupIds: [HOLKY] }), testMember({ id: 2, userId: 2, groupIds: [HOLKY] })] });
    TestBed.configureTestingModule({
      providers: [
        { provide: AccessService, useValue: env.access },
        { provide: GroupsService, useValue: { findGroup: (id: number) => env.groups().find((g) => g.id === id) } },
      ],
    });
    service = TestBed.inject(ChatService);
    service.resetCache();
  });

  it('člen pošle zprávu a chat se mu tím označí jako přečtený', () => {
    const { value } = send('  Je tu někdo?  ');
    expect(value?.body).toBe('Je tu někdo?');
    expect(value?.authorId).toBe(1);
    expect(service.lastReadAt(HOLKY)).toBeTruthy();
  });

  it('nečlen do chatu nenapíše a zprávy nečte', () => {
    expect(send('x', 4).error).toEqual(jasmine.any(AccessDeniedError));
    expect(service.messagesFor(4)).toEqual([]);
  });

  it('prázdnou zprávu ani zprávu do skupiny s vypnutým chatem nepošle', () => {
    expect(send('   ').error).toEqual(jasmine.any(RuleViolationError));
    env.groups.set(MOCK_GROUPS.map((g) => (g.id === HOLKY ? { ...g, chatEnabled: false } : g)));
    expect(send('Ahoj').error).toEqual(jasmine.any(RuleViolationError));
  });

  it('cizí zprávu smaže jen správce skupiny, obsah zmizí a zůstane stopa', () => {
    const message = send('Moje').value!;
    env.user.set({ id: 2, name: '', email: '' });
    let error: unknown;
    service.remove(message.id).subscribe({ error: (e) => (error = e) });
    expect(error).toEqual(jasmine.any(AccessDeniedError));

    env.mandates.set([testMandate(2, 'group-deputy', { groupId: HOLKY })]);
    service.remove(message.id).subscribe();
    const removed = service.messages().find((m) => m.id === message.id)!;
    expect(removed.deletedAt).toBeTruthy();
    expect(removed.body).toBe('');
    expect(removed.deletedById).toBe(2);
  });

  it('upravit zprávu smí jen autor', () => {
    const message = send('Původní').value!;
    env.user.set({ id: 2, name: '', email: '' });
    let error: unknown;
    service.edit(message.id, 'Přepsáno', []).subscribe({ error: (e) => (error = e) });
    expect(error).toEqual(jasmine.any(AccessDeniedError));
  });
});

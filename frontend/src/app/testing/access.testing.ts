import { signal } from '@angular/core';
import { AccessService } from '../core/access/access.service';
import { AuthService } from '../core/auth/auth.service';
import { DEFAULT_ENSEMBLE_SETTINGS, EnsembleSettings } from '../core/models/ensemble-settings.model';
import { Group } from '../core/models/group.model';
import { Mandate, MandateKind } from '../core/models/mandate.model';
import { Member } from '../core/models/member.model';
import { MOCK_GROUPS } from '../core/data/mock-groups';
import { EnsembleSettingsService } from '../features/ensemble/ensemble-settings.service';
import { GroupsService } from '../features/groups/groups.service';
import { MandatesService } from '../features/mandates/mandates.service';
import { MembersService } from '../features/members/members.service';

// Pomůcky pro testy, které potřebují vyhodnocovat přístupy přihlášeného člena

export function testMember(overrides: Partial<Member> = {}): Member {
  return {
    id: 1,
    ensembleId: 1,
    userId: 1,
    firstName: 'Jana',
    lastName: 'Nováková',
    nickname: 'Jana',
    groupIds: [],
    isActive: true,
    createdAt: '2020-01-01',
    ...overrides,
  };
}

let mandateId = 1000;
export function testMandate(memberId: number, kind: MandateKind, scope: { groupId?: number; eventId?: number } = {}): Mandate {
  return { id: mandateId++, memberId, kind, ...scope, grantedAt: '2026-01-01T00:00:00' };
}

export interface TestAccessOptions {
  mandates?: Mandate[];
  groups?: Group[];
  members?: Member[];
  settings?: Partial<EnsembleSettings>;
}

// Skutečný AccessService nad zadanými daty (bez úložiště); signály lze v testu měnit
export function createTestAccess(member: Member | null, options: TestAccessOptions = {}) {
  const members = signal<Member[]>(options.members ?? (member ? [member] : []));
  const mandates = signal<Mandate[]>(options.mandates ?? []);
  const groups = signal<Group[]>(options.groups ?? MOCK_GROUPS);
  const settings = signal<EnsembleSettings>({ ...DEFAULT_ENSEMBLE_SETTINGS, ...options.settings });
  const user = signal(member ? { id: member.userId, name: member.nickname, email: member.email ?? '' } : null);
  const access = new AccessService(
    { currentUser: user } as unknown as AuthService,
    { members } as unknown as MembersService,
    { groups } as unknown as GroupsService,
    { mandates } as unknown as MandatesService,
    { settings } as unknown as EnsembleSettingsService,
  );
  return { access, members, mandates, groups, settings, user };
}

export function provideTestAccess(member: Member | null, options: TestAccessOptions = {}) {
  return { provide: AccessService, useValue: createTestAccess(member, options).access };
}

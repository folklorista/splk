import { Injectable, computed } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { Group } from '../models/group.model';
import { Member } from '../models/member.model';
import { MembersService } from '../../features/members/members.service';
import { GroupsService } from '../../features/groups/groups.service';
import { MandatesService } from '../../features/mandates/mandates.service';
import { EnsembleSettingsService } from '../../features/ensemble/ensemble-settings.service';
import * as access from './access.utils';

// Přístupy přihlášeného uživatele, vyhodnocené živě nad aktuálním členstvím a pověřeními.
// Komponenty a guardy se ptají sem; pravidla samotná jsou čisté funkce v access.utils.
@Injectable({ providedIn: 'root' })
export class AccessService {
  readonly currentMember = computed<Member | null>(() => {
    const user = this.auth.currentUser();
    return user ? this.membersService.members().find((m) => m.userId === user.id) ?? null : null;
  });

  readonly subject = computed<access.AccessSubject | null>(() => {
    const member = this.currentMember();
    return member ? access.toAccessSubject(member, this.mandatesService.mandates()) : null;
  });

  readonly memberId = computed(() => this.currentMember()?.id ?? null);
  readonly isEnsembleAdmin = computed(() => access.isEnsembleAdmin(this.subject()));
  readonly canManageCostumes = computed(() => access.canManageCostumes(this.subject()));
  readonly canViewCostumeStock = computed(() => access.canViewCostumeStock(this.subject()));
  readonly canViewAttendanceReport = computed(() => access.canViewAttendanceReport(this.subject()));
  readonly canCreateEvents = computed(() => access.canCreateEvents(this.subject()));
  readonly canCreateGroup = computed(() => access.canCreateGroup(this.subject(), this.ensemble.settings()));
  readonly modules = computed(() => this.ensemble.settings().modules);

  // Skupiny, jejichž obsah (chat, nástěnku) smí číst – do menu jen ty, kde je členem
  readonly myGroups = computed<Group[]>(() => {
    const s = this.subject();
    return this.groupsService.groups().filter((g) => access.isGroupMember(s, g.id));
  });

  // Skupiny, které smí spravovat (hlavní správce, spolusprávce)
  readonly managedGroups = computed<Group[]>(() => {
    const s = this.subject();
    return this.groupsService.groups().filter((g) => access.isGroupManager(s, g.id));
  });

  constructor(
    private auth: AuthService,
    private membersService: MembersService,
    private groupsService: GroupsService,
    private mandatesService: MandatesService,
    private ensemble: EnsembleSettingsService,
  ) {}

  groupBySlug(slug: string): Group | undefined {
    return this.groupsService.groups().find((g) => g.slug === slug);
  }

  can<T extends unknown[]>(check: (s: access.AccessSubject | null, ...args: T) => boolean, ...args: T): boolean {
    return check(this.subject(), ...args);
  }
}

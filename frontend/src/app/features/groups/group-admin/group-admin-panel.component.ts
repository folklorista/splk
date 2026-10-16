import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AccessService } from '../../../core/access/access.service';
import * as access from '../../../core/access/access.utils';
import { GROUP_VISIBILITY_LABELS, Group, GroupTab, GroupVisibility } from '../../../core/models/group.model';
import { Member } from '../../../core/models/member.model';
import { getFullName } from '../../../core/utils/member.utils';
import { GROUP_ICON_OPTIONS, IconComponent, IconName } from '../../../shared/icon/icon.component';
import { ActionFeedback } from '../../../shared/ui/form-ui';
import { MembersService } from '../../members/members.service';
import { MandatesService } from '../../mandates/mandates.service';
import { GroupsService } from '../groups.service';
import { JoinRequestsService } from '../join-requests.service';
import { MembershipService } from '../membership.service';
import { JOIN_STATUS_LABELS, JoinRequest, isPendingJoinRequest } from '../models/join-request.model';
import { AuditService } from '../../audit/audit.service';
import { AuditTextContext, auditText } from '../../audit/audit-text';
import { EventsService } from '../../events/events.service';
import { toSignal } from '@angular/core/rxjs-interop';

interface MemberRow {
  member: Member;
  role: access.GroupRole | null;
  isMember: boolean;
}

// Správa jedné skupiny: nastavení, členové a jejich role, přidávání a pozvánky, čekající žádosti, historie.
// Používá ji Správa → Skupiny i záložka Správa přímo ve skupině; co kdo smí, určují pověření.
// Panel neukazuje obsah skupiny (chat, příspěvky) – správa metadat ho neodemyká.
@Component({
  selector: 'app-group-admin-panel',
  standalone: true,
  imports: [DatePipe, RouterLink, IconComponent],
  template: `
    @if (group(); as g) {
      <div class="ga">
        @if (feedback.error()) {
          <p class="cs-error" role="alert">{{ feedback.error() }}</p>
        }
        @if (feedback.success()) {
          <p class="cs-success" role="status">{{ feedback.success() }}</p>
        }

        @if (canEditMetadata() || canEditCommunication()) {
          <details class="cs-panel" [open]="openSettings()">
            <summary>Nastavení skupiny</summary>
            <form class="cs-panel__body cs-form" (submit)="$event.preventDefault(); saveSettings(g)">
              @if (canEditMetadata()) {
                <div class="cs-form__row">
                  <label class="cs-field">
                    <span>Název *</span>
                    <input type="text" required [value]="draft().name" (input)="patch({ name: $any($event.target).value })" />
                  </label>
                  <label class="cs-field">
                    <span>Slug (adresa) *</span>
                    <input type="text" required pattern="[a-z0-9-]+" [value]="draft().slug" (input)="patch({ slug: $any($event.target).value })" />
                  </label>
                </div>
                <label class="cs-field">
                  <span>Popis</span>
                  <input type="text" [value]="draft().description ?? ''" (input)="patch({ description: $any($event.target).value })" />
                </label>
                <div class="cs-field">
                  <span class="cs-field__label">Ikona</span>
                  <div class="ga__icons">
                    @for (icon of iconOptions; track icon) {
                      <button type="button" class="ga__icon" [class.ga__icon--active]="draft().icon === icon" [attr.aria-label]="icon" [attr.aria-pressed]="draft().icon === icon" (click)="patch({ icon })">
                        <app-icon [name]="icon" [size]="18" />
                      </button>
                    }
                  </div>
                </div>
                <label class="cs-field">
                  <span>Viditelnost</span>
                  <select (change)="patch({ visibility: $any($event.target).value })">
                    @for (v of visibilityOptions; track v[0]) {
                      <option [value]="v[0]" [selected]="(draft().visibility ?? 'private') === v[0]">{{ v[1] }}</option>
                    }
                  </select>
                  <span class="cs-hint">{{ visibilityHint(draft().visibility ?? 'private') }}</span>
                </label>
              }
              @if (canEditCommunication()) {
                <div class="cs-form__row">
                  <label class="cs-field cs-field--inline">
                    <input type="checkbox" [checked]="draft().chatEnabled !== false" (change)="patch({ chatEnabled: $any($event.target).checked })" />
                    Chat
                  </label>
                  <label class="cs-field cs-field--inline">
                    <input type="checkbox" [checked]="draft().boardEnabled !== false" (change)="patch({ boardEnabled: $any($event.target).checked })" />
                    Nástěnka
                  </label>
                  @if (draft().chatEnabled !== false && draft().boardEnabled !== false) {
                    <label class="cs-field">
                      <span>Výchozí záložka</span>
                      <select (change)="patch({ defaultTab: $any($event.target).value })">
                        <option value="chat" [selected]="draft().defaultTab === 'chat'">Chat</option>
                        <option value="board" [selected]="(draft().defaultTab ?? 'board') === 'board'">Nástěnka</option>
                      </select>
                    </label>
                  }
                </div>
                @if (draft().chatEnabled === false && draft().boardEnabled === false) {
                  <p class="cs-hint">Bez chatu i nástěnky je skupina jen organizační (cílení akcí, pověření).</p>
                }
              }
              <div class="cs-form__actions">
                <button type="submit" class="cs-btn cs-btn--primary" [disabled]="feedback.busy() || !draft().name.trim() || !draft().slug.trim()">Uložit nastavení</button>
              </div>
            </form>
          </details>
        }

        <section class="ga__section">
          <h2 class="ga__title">Hlavní správce</h2>
          @if (owners().length) {
            <p>
              @for (owner of owners(); track owner.member.id) {
                <strong>{{ owner.member.nickname }}</strong>
                @if (!owner.isMember) { <span class="badge">nečlen – jen technická správa, obsah nečte</span> }
                @if (owner.temporary) { <span class="badge">přechodně</span> }
              }
            </p>
          } @else {
            <p class="cs-error">Skupina nemá hlavního správce.</p>
          }
          @if (canAssignManagers()) {
            <label class="cs-field ga__inline">
              <span>Předat hlavní správu</span>
              <select (change)="transferOwnership(g.id, $any($event.target))">
                <option value="">Vyberte osobu…</option>
                @for (person of ownerCandidates(); track person.id) {
                  <option [value]="person.id">{{ person.nickname }}{{ person.groupIds.includes(g.id) ? '' : ' (nečlen)' }}</option>
                }
              </select>
              <span class="cs-hint">Dosavadní hlavní správce se stane spolusprávcem. Nečlen dostane jen technickou správu bez přístupu k obsahu.</span>
            </label>
          }
        </section>

        <section class="ga__section">
          <h2 class="ga__title">Členové ({{ memberRows().length }})</h2>
          <ul class="ga__members">
            @for (row of memberRows(); track row.member.id) {
              <li class="ga__member">
                <span class="ga__member-name">
                  @if (isEnsembleAdmin()) {
                    <a class="cs-link" [routerLink]="['/app/manage/members', row.member.id]">{{ row.member.nickname }}</a>
                    <span class="cs-muted">{{ fullName(row.member) }}</span>
                  } @else {
                    {{ row.member.nickname }}
                  }
                  @if (row.role === 'owner') { <span class="badge badge--pinned">hlavní správce</span> }
                  @if (row.role === 'deputy') { <span class="badge">spolusprávce</span> }
                </span>
                @if (canAssignManagers() && row.role !== 'owner') {
                  <select class="cs-input ga__role" [attr.aria-label]="'Role: ' + row.member.nickname" (change)="setRole(g.id, row.member.id, $any($event.target).value)">
                    <option value="member" [selected]="row.role === null">Člen</option>
                    <option value="deputy" [selected]="row.role === 'deputy'">Spolusprávce</option>
                  </select>
                }
                @if (canRemove(row)) {
                  <button type="button" class="cs-btn" (click)="remove(g, row.member)">Odebrat</button>
                }
              </li>
            }
          </ul>
        </section>

        @if (canManageMembership()) {
          <section class="ga__section">
            <h2 class="ga__title">Přidat nebo pozvat</h2>
            <div class="cs-form__row">
              <label class="cs-field">
                <span>Osoba</span>
                <select (change)="candidateId.set(+$any($event.target).value || null)">
                  <option value="" [selected]="candidateId() === null">Vyberte…</option>
                  @for (person of addCandidates(); track person.id) {
                    <option [value]="person.id" [selected]="candidateId() === person.id">{{ person.nickname }}{{ person.isExternal ? ' (externista)' : '' }}</option>
                  }
                </select>
              </label>
              <div class="cs-form__actions">
                <button type="button" class="cs-btn" [disabled]="!candidateId()" (click)="invite(g.id)">Pozvat</button>
                <button type="button" class="cs-btn cs-btn--primary" [disabled]="!candidateId() || candidateId() === me()" (click)="add(g.id)">Přidat hned</button>
              </div>
            </div>
            <p class="cs-hint">
              Pozvaný se stane členem, až pozvánku přijme. Přidání hned se zapíše do historie a členové skupiny ho uvidí v chatu.
              @if (extraordinary()) { <strong>Skupinu nespravujete – zásah Správy souboru bude v historii zvýrazněný.</strong> }
            </p>
          </section>

          <section class="ga__section">
            <h2 class="ga__title">Čekající žádosti a pozvánky ({{ pending().length }})</h2>
            @if (!pending().length) {
              <p class="cs-muted">Nic nečeká.</p>
            }
            <ul class="ga__members">
              @for (request of pending(); track request.id) {
                <li class="ga__member">
                  <span class="ga__member-name">
                    <strong>{{ name(request.memberId) }}</strong>
                    <span class="cs-muted">{{ requestLabel(request) }} · {{ request.createdAt | date: 'd. M. HH:mm' }}</span>
                    @if (request.message) { <span class="cs-history__note">„{{ request.message }}“</span> }
                  </span>
                  @if (request.status === 'awaiting-manager') {
                    <button type="button" class="cs-btn cs-btn--primary" (click)="feedback.run(membership.approve(request.id), undefined, 'Schváleno')">Schválit</button>
                    <button type="button" class="cs-btn" (click)="feedback.run(membership.reject(request.id), undefined, 'Zamítnuto')">Zamítnout</button>
                  } @else {
                    <button type="button" class="cs-btn" (click)="feedback.run(membership.cancel(request.id), undefined, 'Zrušeno')">Zrušit pozvánku</button>
                  }
                </li>
              }
            </ul>
          </section>

          <details class="cs-panel">
            <summary>Historie skupiny</summary>
            <div class="cs-panel__body">
              @if (!history().length) {
                <p class="cs-muted">Zatím bez záznamů.</p>
              }
              <ul class="cs-history">
                @for (entry of history(); track entry.id) {
                  <li class="cs-history__item" [class.ga__extraordinary]="entry.extraordinary">
                    {{ text(entry) }}
                    <div class="cs-history__meta">{{ entry.at | date: 'd. M. yyyy HH:mm' }} · {{ name(entry.actorId) }}@if (entry.extraordinary) { · mimořádný zásah Správy souboru }</div>
                    @if (entry.note) { <div class="cs-history__note">Interní poznámka: {{ entry.note }}</div> }
                  </li>
                }
              </ul>
            </div>
          </details>
        }
      </div>
    }
  `,
  styles: [
    `
      .ga { display: flex; flex-direction: column; gap: var(--spacing-md); }
      .ga__section { display: flex; flex-direction: column; gap: var(--spacing-sm); }
      .ga__title { font-size: var(--font-size-xs); font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-text-muted); }
      .ga__members { list-style: none; display: flex; flex-direction: column; }
      .ga__member { display: flex; align-items: center; gap: var(--spacing-sm); padding: 6px 0; border-bottom: 1px solid var(--color-border); font-size: var(--font-size-sm); flex-wrap: wrap; }
      .ga__member-name { flex: 1; min-width: 160px; display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: center; }
      .ga__role { width: auto !important; }
      .ga__inline { max-width: 420px; }
      .ga__icons { display: flex; flex-wrap: wrap; gap: 4px; }
      .ga__icon { width: 36px; height: 36px; display: grid; place-items: center; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); color: var(--color-text); }
      .ga__icon--active { border-color: var(--color-primary); color: var(--color-primary); box-shadow: inset 0 0 0 1px var(--color-primary); }
      .ga__extraordinary { border-left-color: #f9a825; }
    `,
  ],
})
export class GroupAdminPanelComponent {
  readonly membership = inject(MembershipService);
  private accessService = inject(AccessService);
  private membersService = inject(MembersService);
  private groupsService = inject(GroupsService);
  private mandatesService = inject(MandatesService);
  private requestsService = inject(JoinRequestsService);
  private audit = inject(AuditService);
  private events = toSignal(inject(EventsService).getEvents(), { initialValue: [] });

  readonly groupId = input.required<number>();
  readonly openSettings = input(false);

  readonly feedback = new ActionFeedback();
  readonly iconOptions = GROUP_ICON_OPTIONS;
  readonly visibilityOptions = Object.entries(GROUP_VISIBILITY_LABELS) as [GroupVisibility, string][];
  readonly candidateId = signal<number | null>(null);
  readonly fullName = getFullName;

  readonly group = computed(() => this.groupsService.groups().find((g) => g.id === this.groupId()));
  // Rozpracované nastavení; po uložení (nebo změně jinde) se srovná s uloženou skupinou
  readonly draft = linkedSignal<Group>(() => ({ ...(this.group() ?? { id: 0, ensembleId: 1, name: '', slug: '' }) }));

  private subject = this.accessService.subject;
  readonly me = this.accessService.memberId;
  readonly isEnsembleAdmin = this.accessService.isEnsembleAdmin;
  readonly canEditMetadata = computed(() => access.canEditGroupMetadata(this.subject(), this.groupId()));
  readonly canEditCommunication = computed(() => access.canEditGroupCommunication(this.subject(), this.groupId()));
  readonly canManageMembership = computed(() => access.canManageGroupMembership(this.subject(), this.groupId()));
  readonly canAssignManagers = computed(() => access.canAssignGroupManagers(this.subject(), this.groupId()));
  readonly extraordinary = computed(() => this.isEnsembleAdmin() && !access.isGroupManager(this.subject(), this.groupId()));

  private groupMandates = computed(() => this.mandatesService.mandates().filter((m) => m.groupId === this.groupId()));

  private roleOf(memberId: number): access.GroupRole | null {
    const mandates = this.groupMandates().filter((m) => m.memberId === memberId);
    if (mandates.some((m) => m.kind === 'group-owner')) return 'owner';
    return mandates.some((m) => m.kind === 'group-deputy') ? 'deputy' : null;
  }

  readonly memberRows = computed<MemberRow[]>(() =>
    this.membersService
      .members()
      .filter((m) => m.isActive && m.groupIds.includes(this.groupId()))
      .map((member) => ({ member, role: this.roleOf(member.id), isMember: true }))
      .sort((a, b) => this.rank(a.role) - this.rank(b.role) || a.member.nickname.localeCompare(b.member.nickname, 'cs')),
  );

  readonly owners = computed(() =>
    this.groupMandates()
      .filter((m) => m.kind === 'group-owner')
      .map((m) => ({ mandate: m, member: this.membersService.findMember(m.memberId), temporary: !!m.temporary }))
      .filter((o): o is { mandate: typeof o.mandate; member: Member; temporary: boolean } => !!o.member)
      .map((o) => ({ ...o, isMember: o.member.groupIds.includes(this.groupId()) })),
  );

  readonly ownerCandidates = computed(() => {
    const owners = new Set(this.owners().map((o) => o.member.id));
    return this.membersService
      .members()
      .filter((m) => m.isActive && !m.isExternal && !owners.has(m.id))
      .sort((a, b) => Number(b.groupIds.includes(this.groupId())) - Number(a.groupIds.includes(this.groupId())) || a.nickname.localeCompare(b.nickname, 'cs'));
  });

  readonly addCandidates = computed(() =>
    this.membersService
      .members()
      .filter((m) => m.isActive && !m.groupIds.includes(this.groupId()))
      .sort((a, b) => a.nickname.localeCompare(b.nickname, 'cs')),
  );

  readonly pending = computed(() => this.requestsService.requests().filter((r) => r.groupId === this.groupId() && isPendingJoinRequest(r)));

  readonly history = computed(() =>
    this.audit
      .entries()
      .filter((e) => e.groupIds.includes(this.groupId()))
      .slice()
      .reverse(),
  );

  private textContext: AuditTextContext = {
    memberName: (id) => this.name(id),
    groupName: (id) => this.groupsService.findGroup(id ?? 0)?.name ?? 'skupina',
    eventTitle: (id) => this.events().find((e) => e.id === id)?.title ?? 'akce',
  };

  private rank(role: access.GroupRole | null): number {
    return role === 'owner' ? 0 : role === 'deputy' ? 1 : 2;
  }

  name(id: number | undefined): string {
    return this.membersService.members().find((m) => m.id === id)?.nickname ?? 'neznámá osoba';
  }

  text(entry: Parameters<typeof auditText>[0]): string {
    return auditText(entry, this.textContext);
  }

  requestLabel(request: JoinRequest): string {
    const kind = request.kind === 'request' ? 'žádost o vstup' : request.approvedById ? `pozval/a ${this.name(request.createdById)}` : `návrh od ${this.name(request.createdById)}`;
    return `${kind} · ${JOIN_STATUS_LABELS[request.status]}`;
  }

  visibilityHint(visibility: GroupVisibility): string {
    switch (visibility) {
      case 'open':
        return 'Obsah čtou všichni přihlášení členové souboru, psát mohou členové skupiny; vstoupit lze hned.';
      case 'hidden':
        return 'Nečlenové skupinu nevidí; vstup jen na pozvání.';
      default:
        return 'Skupinu lze najít a požádat o vstup; obsah čtou jen členové.';
    }
  }

  patch(change: Partial<Group>): void {
    this.draft.update((d) => ({ ...d, ...change }));
  }

  canRemove(row: MemberRow): boolean {
    if (!this.canManageMembership() || row.member.id === this.me()) return false;
    return row.role !== 'owner' || this.canAssignManagers();
  }

  saveSettings(group: Group): void {
    const d = this.draft();
    const patch = this.canEditMetadata()
      ? { name: d.name.trim(), slug: d.slug.trim(), icon: d.icon as IconName | undefined, description: d.description?.trim() || undefined, visibility: d.visibility }
      : {};
    const communication = this.canEditCommunication()
      ? { chatEnabled: d.chatEnabled !== false, boardEnabled: d.boardEnabled !== false, defaultTab: (d.defaultTab ?? 'board') as GroupTab }
      : {};
    this.feedback.run(this.membership.updateGroup(group.id, { ...patch, ...communication }), (g) => this.draft.set(g));
  }

  setRole(groupId: number, memberId: number, value: string): void {
    this.feedback.run(this.membership.setGroupRole(groupId, memberId, value === 'deputy' ? 'deputy' : null));
  }

  transferOwnership(groupId: number, select: HTMLSelectElement): void {
    const id = Number(select.value);
    select.value = '';
    if (!id || !confirm(`Předat hlavní správu skupiny osobě ${this.name(id)}?`)) return;
    this.feedback.run(this.membership.setGroupRole(groupId, id, 'owner'), undefined, 'Hlavní správa předána');
  }

  remove(group: Group, member: Member): void {
    const note = prompt(`Odebrat ${member.nickname} ze skupiny ${group.name}? Případný důvod zůstane jen v historii správy (nepovinné):`, '');
    if (note === null) return;
    this.feedback.run(this.membership.removeMember(group.id, member.id, note.trim() || undefined), undefined, 'Odebráno');
  }

  add(groupId: number): void {
    const id = this.candidateId();
    if (!id) return;
    this.feedback.run(this.membership.addMember(groupId, id), () => this.candidateId.set(null), 'Přidáno');
  }

  invite(groupId: number): void {
    const id = this.candidateId();
    if (!id) return;
    this.feedback.run(this.membership.invite(groupId, id), () => this.candidateId.set(null), 'Pozvánka odeslána');
  }
}

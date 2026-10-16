import { Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AccessService } from '../../../core/access/access.service';
import { canManageGroupMembership, canProposeMember, groupRole, isGroupMember, toAccessSubject } from '../../../core/access/access.utils';
import { Group } from '../../../core/models/group.model';
import { MembersService } from '../../members/members.service';
import { MandatesService } from '../../mandates/mandates.service';
import { MembershipService } from '../membership.service';
import { ActionFeedback } from '../../../shared/ui/form-ui';

// Záložka Členové: kdo ve skupině je a kdo ji spravuje (transparentně pro všechny členy),
// návrh nového člena (rozhodne správce, pak pozvaný) a odchod ze skupiny
@Component({
  selector: 'app-group-members',
  standalone: true,
  template: `
    @if (feedback.error()) { <p class="cs-error" role="alert">{{ feedback.error() }}</p> }
    @if (feedback.success()) { <p class="cs-success" role="status">{{ feedback.success() }}</p> }

    <ul class="gm">
      @for (row of rows(); track row.id) {
        <li class="gm__row">
          <span class="gm__name">{{ row.nickname }}</span>
          @if (row.role === 'owner') { <span class="badge badge--pinned">hlavní správce</span> }
          @if (row.role === 'deputy') { <span class="badge">spolusprávce</span> }
        </li>
      }
    </ul>
    @if (technicalOwners().length) {
      <p class="cs-hint">Technická správa bez přístupu k obsahu: {{ technicalOwners().join(', ') }}</p>
    }

    @if (canPropose() && !canManage()) {
      <div class="cs-form__row gm__propose">
        <label class="cs-field">
          <span>Navrhnout nového člena</span>
          <select (change)="candidateId.set(+$any($event.target).value || null)">
            <option value="" [selected]="candidateId() === null">Vyberte…</option>
            @for (person of candidates(); track person.id) {
              <option [value]="person.id" [selected]="candidateId() === person.id">{{ person.nickname }}</option>
            }
          </select>
        </label>
        <div class="cs-form__actions">
          <button type="button" class="cs-btn" [disabled]="!candidateId()" (click)="propose()">Navrhnout</button>
        </div>
      </div>
      <p class="cs-hint">Návrh posoudí správce skupiny; členem se navržený stane, až pozvánku přijme.</p>
    }

    @if (isMember()) {
      <div class="gm__leave">
        <button type="button" class="cs-btn cs-btn--danger" (click)="leave()">Opustit skupinu</button>
      </div>
    }
  `,
  styles: [
    `
      .gm { list-style: none; display: flex; flex-direction: column; margin-bottom: var(--spacing-md); }
      .gm__row { display: flex; align-items: center; gap: var(--spacing-sm); padding: 6px 0; border-bottom: 1px solid var(--color-border); font-size: var(--font-size-sm); }
      .gm__name { flex: 1; }
      .gm__propose { margin-top: var(--spacing-md); }
      .gm__leave { margin-top: var(--spacing-xl); }
    `,
  ],
})
export class GroupMembersComponent {
  readonly group = input.required<Group>();

  private access = inject(AccessService);
  private membersService = inject(MembersService);
  private mandatesService = inject(MandatesService);
  private membership = inject(MembershipService);
  private router = inject(Router);

  readonly feedback = new ActionFeedback();
  readonly candidateId = signal<number | null>(null);

  readonly isMember = computed(() => isGroupMember(this.access.subject(), this.group().id));
  readonly canManage = computed(() => canManageGroupMembership(this.access.subject(), this.group().id));
  readonly canPropose = computed(() => canProposeMember(this.access.subject(), this.group()));

  private roleOf(memberId: number) {
    const member = this.membersService.findMember(memberId);
    return member ? groupRole(toAccessSubject(member, this.mandatesService.mandates()), this.group().id) : null;
  }

  readonly rows = computed(() => {
    const rank = (r: string | null) => (r === 'owner' ? 0 : r === 'deputy' ? 1 : 2);
    return this.membersService
      .members()
      .filter((m) => m.isActive && m.groupIds.includes(this.group().id))
      .map((m) => ({ id: m.id, nickname: m.nickname, role: this.roleOf(m.id) }))
      .sort((a, b) => rank(a.role) - rank(b.role) || a.nickname.localeCompare(b.nickname, 'cs'));
  });

  readonly technicalOwners = computed(() =>
    this.mandatesService
      .mandates()
      .filter((m) => m.groupId === this.group().id && (m.kind === 'group-owner' || m.kind === 'group-deputy'))
      .map((m) => this.membersService.findMember(m.memberId))
      .filter((m) => !!m && !m.groupIds.includes(this.group().id))
      .map((m) => m!.nickname),
  );

  readonly candidates = computed(() =>
    this.membersService
      .members()
      .filter((m) => m.isActive && !m.groupIds.includes(this.group().id))
      .sort((a, b) => a.nickname.localeCompare(b.nickname, 'cs')),
  );

  propose(): void {
    const id = this.candidateId();
    if (!id) return;
    this.feedback.run(this.membership.invite(this.group().id, id), () => this.candidateId.set(null), 'Návrh odeslán správci');
  }

  leave(): void {
    if (!confirm(`Opravdu opustit skupinu ${this.group().name}? Přestanete vidět její chat a nástěnku.`)) return;
    this.feedback.run(this.membership.leaveGroup(this.group().id), () => this.router.navigate(['/app/boards']));
  }
}

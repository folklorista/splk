import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BoardsService } from './boards.service';
import { AccessService } from '../../core/access/access.service';
import { canJoinDirectly, canRequestToJoin, canSeeGroup, canReadGroupContent, isGroupMember } from '../../core/access/access.utils';
import { GROUP_VISIBILITY_LABELS, Group } from '../../core/models/group.model';
import { GroupsService } from '../groups/groups.service';
import { JoinRequestsService } from '../groups/join-requests.service';
import { MembershipService } from '../groups/membership.service';
import { MembersService } from '../members/members.service';
import { isPendingJoinRequest } from '../groups/models/join-request.model';
import { IconComponent } from '../../shared/icon/icon.component';
import { ActionFeedback } from '../../shared/ui/form-ui';

// Rozcestník skupin: moje skupiny, pozvánky a žádosti, ostatní skupiny, do kterých lze vstoupit.
// Skryté skupiny nečlenové nevidí; znát existenci skupiny neznamená číst její obsah.
@Component({
  selector: 'app-boards',
  standalone: true,
  imports: [RouterLink, IconComponent, DatePipe],
  template: `
    <div class="page">
      <div class="page__header">
        <h1 class="page__title">Skupiny</h1>
        @if (canCreate()) {
          <a class="btn-primary btn-primary--sm" [routerLink]="isAdmin() ? '/app/manage/groups/new' : '/app/groups/new'">+ Založit skupinu</a>
        }
      </div>

      @if (feedback.error()) { <p class="cs-error" role="alert">{{ feedback.error() }}</p> }
      @if (feedback.success()) { <p class="cs-success" role="status">{{ feedback.success() }}</p> }

      @if (invitations().length) {
        <h2 class="hub__heading">Pozvánky pro vás</h2>
        <ul class="item-list">
          @for (inv of invitations(); track inv.id) {
            <li class="item-list__item item-list__item--requires-action">
              <div class="item-list__row">
                <span class="item-list__title">{{ groupName(inv.groupId) }}</span>
                <div class="item-list__badges">
                  <button type="button" class="cs-btn cs-btn--primary" (click)="feedback.run(membership.acceptInvitation(inv.id), undefined, 'Vítejte ve skupině')">Přijmout</button>
                  <button type="button" class="cs-btn" (click)="feedback.run(membership.declineInvitation(inv.id), undefined, 'Pozvánka odmítnuta')">Odmítnout</button>
                </div>
              </div>
              <div class="item-list__meta">Pozval/a {{ memberName(inv.approvedById ?? inv.createdById) }} · {{ inv.createdAt | date: 'd. M. yyyy' }}</div>
            </li>
          }
        </ul>
      }

      @if (toDecide()) {
        <p class="hub__notice">Ve skupinách, které spravujete, čeká {{ toDecide() }} žádostí nebo návrhů – najdete je v záložce Správa skupiny.</p>
      }

      <h2 class="hub__heading">Moje skupiny</h2>
      @if (!mine().length) {
        <p class="state-note">Nejste členem žádné skupiny.</p>
      } @else {
        <ul class="item-list">
          @for (group of mine(); track group.id) {
            <li class="item-list__item item-list__item--link" [routerLink]="['/app/boards', group.slug]">
              <div class="item-list__row">
                <span class="item-list__title">
                  @if (group.icon) { <app-icon [name]="group.icon" [size]="16" /> }
                  {{ group.name }}
                </span>
                @if (badges().get(group.id); as count) {
                  <div class="item-list__badges"><span class="badge badge--requires-action">{{ count }} nové</span></div>
                }
              </div>
              @if (group.description) { <div class="item-list__meta">{{ group.description }}</div> }
            </li>
          }
        </ul>
      }

      @if (others().length) {
        <h2 class="hub__heading">Další skupiny</h2>
        <ul class="item-list">
          @for (group of others(); track group.id) {
            <li class="item-list__item">
              <div class="item-list__row">
                <span class="item-list__title">
                  @if (group.icon) { <app-icon [name]="group.icon" [size]="16" /> }
                  {{ group.name }}
                  <span class="badge">{{ visibilityLabel(group) }}</span>
                </span>
                <div class="item-list__badges">
                  @if (canRead(group)) {
                    <a class="cs-btn" [routerLink]="['/app/boards', group.slug]">Číst</a>
                  }
                  @if (canJoin(group)) {
                    <button type="button" class="cs-btn cs-btn--primary" (click)="feedback.run(membership.joinOpenGroup(group.id), undefined, 'Jste členem skupiny')">Vstoupit</button>
                  } @else if (myRequest(group.id)) {
                    <span class="badge">žádost čeká</span>
                    <button type="button" class="cs-btn" (click)="cancelRequest(group.id)">Zrušit žádost</button>
                  } @else if (canRequest(group)) {
                    <button type="button" class="cs-btn" (click)="request(group)">Požádat o vstup</button>
                  }
                </div>
              </div>
              @if (group.description) { <div class="item-list__meta">{{ group.description }}</div> }
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: [
    `
      .hub__heading { font-size: var(--font-size-xs); font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-text-muted); margin: var(--spacing-lg) 0 var(--spacing-sm); }
      .hub__notice { font-size: var(--font-size-sm); padding: var(--spacing-sm) var(--spacing-md); border-radius: 6px; border-left: 4px solid var(--color-primary); background: var(--color-surface-alt); }
    `,
  ],
})
export class BoardsComponent implements OnInit {
  private boardsService = inject(BoardsService);
  private access = inject(AccessService);
  private groupsService = inject(GroupsService);
  private requestsService = inject(JoinRequestsService);
  private membersService = inject(MembersService);
  readonly membership = inject(MembershipService);

  readonly feedback = new ActionFeedback();
  readonly badges = signal<Map<number, number>>(new Map());
  readonly canCreate = this.access.canCreateGroup;
  readonly isAdmin = this.access.isEnsembleAdmin;

  readonly mine = this.access.myGroups;
  readonly others = computed(() => {
    const s = this.access.subject();
    return this.groupsService.groups().filter((g) => !isGroupMember(s, g.id) && canSeeGroup(s, g) && (g.visibility ?? 'private') !== 'hidden');
  });

  private myPending = computed(() => this.requestsService.requests().filter((r) => isPendingJoinRequest(r) && r.memberId === this.access.memberId()));
  readonly invitations = computed(() => this.myPending().filter((r) => r.status === 'awaiting-member'));
  readonly toDecide = computed(() => {
    const managed = new Set(this.access.managedGroups().map((g) => g.id));
    return this.requestsService.requests().filter((r) => r.status === 'awaiting-manager' && managed.has(r.groupId)).length;
  });

  ngOnInit(): void {
    this.boardsService.getBoardBadges().subscribe((badges) => this.badges.set(badges));
  }

  myRequest(groupId: number) {
    return this.myPending().find((r) => r.groupId === groupId && r.kind === 'request');
  }

  cancelRequest(groupId: number): void {
    const request = this.myRequest(groupId);
    if (request) this.feedback.run(this.membership.cancel(request.id), undefined, 'Žádost zrušena');
  }

  canRead(group: Group): boolean {
    return canReadGroupContent(this.access.subject(), group);
  }

  canJoin(group: Group): boolean {
    return canJoinDirectly(this.access.subject(), group);
  }

  canRequest(group: Group): boolean {
    return canRequestToJoin(this.access.subject(), group);
  }

  request(group: Group): void {
    const message = prompt(`Žádost o vstup do skupiny ${group.name}. Vzkaz pro správce (nepovinné):`, '');
    if (message === null) return;
    this.feedback.run(this.membership.requestToJoin(group.id, message), undefined, 'Žádost odeslána správci skupiny');
  }

  visibilityLabel(group: Group): string {
    return GROUP_VISIBILITY_LABELS[group.visibility ?? 'private'];
  }

  groupName(id: number): string {
    return this.groupsService.findGroup(id)?.name ?? 'skupina';
  }

  memberName(id: number): string {
    return this.membersService.findMember(id)?.nickname ?? 'někdo';
  }
}

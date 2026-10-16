import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AccessService } from '../../core/access/access.service';
import { canReadGroupContent } from '../../core/access/access.utils';
import { GroupsService } from '../groups/groups.service';
import { MembersService } from '../members/members.service';
import { PostsService } from '../posts/posts.service';
import { CommentsService } from '../posts/comments.service';
import { ChatService } from '../chat/chat.service';
import { EventsService } from '../events/events.service';
import { SearchHitKind, searchContent } from './search.utils';

const KIND_LABELS: Record<SearchHitKind, string> = { post: 'Příspěvek', comment: 'Komentář', message: 'Chat', event: 'Akce' };

// Vyhledávání v obsahu, který smí přihlášený číst – s filtrem skupiny a období
@Component({
  selector: 'app-search',
  standalone: true,
  imports: [RouterLink, DatePipe],
  template: `
    <div class="page">
      <h1 class="page__title">Hledat</h1>
      <div class="cs-filters">
        <label class="cs-field">
          <span>Hledaný text</span>
          <input type="search" autofocus placeholder="např. kroje, sraz, Polsko" [value]="query()" (input)="query.set($any($event.target).value)" />
        </label>
        <label class="cs-field">
          <span>Skupina</span>
          <select (change)="groupId.set($any($event.target).value)">
            <option value="">Všechny moje</option>
            @for (group of groups(); track group.id) {
              <option [value]="group.id">{{ group.name }}</option>
            }
          </select>
        </label>
        <label class="cs-field"><span>Od</span><input type="date" [value]="from()" (input)="from.set($any($event.target).value)" /></label>
        <label class="cs-field"><span>Do</span><input type="date" [value]="to()" (input)="to.set($any($event.target).value)" /></label>
      </div>

      @if (query().trim().length < 2) {
        <p class="state-note">Napište aspoň dva znaky. Hledá se v příspěvcích, komentářích a chatu vašich skupin a v akcích, které vidíte.</p>
      } @else if (!hits().length) {
        <p class="state-note">Nic nenalezeno.</p>
      } @else {
        <p class="cs-muted">{{ hits().length }} výsledků</p>
        <ul class="item-list">
          @for (hit of hits(); track hit.kind + hit.id) {
            <li class="item-list__item item-list__item--link" [routerLink]="hit.link" [fragment]="hit.fragment" [queryParams]="hit.queryParams">
              <div class="item-list__row">
                <span class="item-list__title">{{ hit.title }}</span>
                <div class="item-list__badges"><span class="badge">{{ kindLabel(hit.kind) }}</span></div>
              </div>
              <div class="item-list__meta">{{ hit.at | date: 'd. M. yyyy HH:mm' }}@if (hit.groupId) { · {{ groupName(hit.groupId) }} }</div>
              <p class="item-list__body">{{ hit.snippet }}</p>
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class SearchComponent {
  private access = inject(AccessService);
  private groupsService = inject(GroupsService);
  private members = inject(MembersService);
  private chat = inject(ChatService);
  private posts = toSignal(inject(PostsService).getPosts(), { initialValue: [] });
  private comments = toSignal(inject(CommentsService).getAllComments(), { initialValue: [] });
  private events = toSignal(inject(EventsService).getEvents(), { initialValue: [] });

  readonly query = signal('');
  readonly groupId = signal('');
  readonly from = signal('');
  readonly to = signal('');

  readonly groups = computed(() => this.groupsService.groups().filter((g) => canReadGroupContent(this.access.subject(), g)));

  readonly hits = computed(() => {
    const subject = this.access.subject();
    const viewer = this.access.currentMember();
    if (!subject || !viewer) return [];
    return searchContent({
      query: this.query(),
      subject,
      viewer,
      groups: this.groupsService.groups(),
      posts: this.posts(),
      comments: this.comments(),
      messages: this.chat.messages(),
      events: this.access.modules().events ? this.events() : [],
      memberName: (id) => this.members.findMember(id)?.nickname ?? 'neznámý člen',
      groupId: this.groupId() ? Number(this.groupId()) : undefined,
      from: this.from() || undefined,
      to: this.to() || undefined,
    });
  });

  kindLabel(kind: SearchHitKind): string {
    return KIND_LABELS[kind];
  }

  groupName(id: number): string {
    return this.groupsService.findGroup(id)?.name ?? '';
  }
}

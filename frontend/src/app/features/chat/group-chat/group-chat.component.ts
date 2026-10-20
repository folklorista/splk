import { Component, DestroyRef, ElementRef, OnDestroy, OnInit, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { interval } from 'rxjs';
import { startWith, switchMap } from 'rxjs/operators';
import { Group } from '../../../core/models/group.model';
import { Member } from '../../../core/models/member.model';
import { AccessService } from '../../../core/access/access.service';
import { canModerateGroup, canPostInGroup } from '../../../core/access/access.utils';
import { ChatService } from '../chat.service';
import { ChatMessage } from '../models/chat-message.model';
import { TimelineItem, buildGroupTimeline } from '../utils/chat-timeline';
import { PostsService } from '../../posts/posts.service';
import { CommentsService } from '../../posts/comments.service';
import { PostComment } from '../../posts/models/comment.model';
import { plainText } from '../../posts/utils/mentions';
import { MembersService } from '../../members/members.service';
import { AuditService } from '../../audit/audit.service';
import { chatSystemText, AuditTextContext } from '../../audit/audit-text';
import { AuditEntry } from '../../audit/audit.model';
import { EventsService } from '../../events/events.service';
import { EnsembleSettingsService } from '../../ensemble/ensemble-settings.service';
import { MentionInputComponent, MentionSubmit } from '../../../shared/mention-input/mention-input.component';
import { errorMessage } from '../../../shared/ui/form-ui';

const REFRESH_MS = 2000;
const PREVIEW_LENGTH = 140;

// Chat skupiny: jedna časová osa se zprávami, aktivitou nástěnky a systémovými událostmi.
// Komentáře jen odkazuje (originál je pod příspěvkem) a odpověď z karty ukládá do diskuze příspěvku.
import { chatVisibility } from '../utils/chat-history';
import { RichTextComponent } from '../../../shared/rich-text/rich-text.component';
@Component({
  selector: 'app-group-chat',
  standalone: true,
  imports: [DatePipe, NgTemplateOutlet, RouterLink, MentionInputComponent, RichTextComponent],
  template: `
    <div class="chat">
      <div class="chat__log" #log role="log" aria-live="polite" aria-label="Chat skupiny" (scroll)="onScroll()">
        @if (!items().length) {
          <p class="state-note">Zatím tu nic není. Napište první zprávu.</p>
        }
        @for (item of items(); track trackItem(item); let i = $index) {
          @if (dayLabel(i); as day) {
            <div class="chat__day">{{ day }}</div>
          }
          @if (i === firstUnreadIndex()) {
            <div class="chat__new" role="separator">Nové</div>
          }
          @switch (item.kind) {
            @case ('message') {
              @let m = item.message;
              <div class="chat-msg" [class.chat-msg--own]="m.authorId === me()" [class.chat-msg--mention]="mentionsMe(m)">
                <div class="chat-msg__meta">
                  <strong>{{ name(m.authorId) }}</strong> · {{ m.createdAt | date: 'HH:mm' }}
                  @if (m.editedAt) { · upraveno }
                </div>
                @if (m.deletedAt) {
                  <p class="chat-msg__body chat-msg__body--deleted">Zpráva byla odstraněna{{ m.deletedById !== m.authorId ? ' moderátorem' : '' }}.</p>
                } @else {
                  <p class="chat-msg__body"><app-rich-text [body]="m.body" /></p>
                  @if (canDelete(m)) {
                    <button type="button" class="chat-msg__action" (click)="remove(m)">Smazat</button>
                  }
                }
              </div>
            }
            @case ('system') {
              <div class="chat-system">{{ item.at | date: 'HH:mm' }} · {{ systemText(item.entry) }}</div>
            }
            @case ('post') {
              <div class="chat-card">
                <div class="chat-card__meta">{{ item.at | date: 'HH:mm' }} · {{ name(item.post.authorId) }} · nový příspěvek na nástěnce</div>
                <a class="chat-card__title" [routerLink]="['/app/posts', item.post.id]">{{ item.post.title }}</a>
                <p class="chat-card__preview">{{ preview(item.post.body) }}</p>
              </div>
            }
            @case ('comment') {
              <div class="chat-card" [class.chat-card--new]="item.isNew">
                <div class="chat-card__meta">
                  {{ item.at | date: 'HH:mm' }} · {{ name(item.comment.authorId) }} · komentář v příspěvku
                  <a class="chat-card__link" [routerLink]="['/app/posts', item.post.id]">„{{ item.post.title }}“</a>
                </div>
                <p class="chat-card__preview"><app-rich-text [body]="item.comment.body" /></p>
                <ng-container *ngTemplateOutlet="cardActions; context: { $implicit: item.post.id, comment: item.comment }" />
              </div>
            }
            @case ('comment-group') {
              @let last = item.comments[item.comments.length - 1];
              <div class="chat-card chat-card--group" [class.chat-card--new]="item.newCount > 0">
                <div class="chat-card__meta">
                  💬 <a class="chat-card__link" [routerLink]="['/app/posts', item.post.id]">{{ item.post.title }}</a>
                </div>
                <div class="chat-card__title">
                  {{ commentsLabel(item.comments.length) }}
                  @if (item.newCount) { <span class="badge badge--requires-action">{{ item.newCount }} nových</span> }
                </div>
                <div class="chat-card__meta">poslední: {{ name(last.authorId) }} {{ last.createdAt | date: 'HH:mm' }}</div>
                <p class="chat-card__preview">„{{ preview(plain(last.body)) }}“</p>
                <ng-container *ngTemplateOutlet="cardActions; context: { $implicit: item.post.id, comment: item.comments[0], count: item.comments.length }" />
              </div>
            }
          }
        }
      </div>
      @if (hasNewBelow()) {
        <button type="button" class="chat__jump" (click)="jumpToLatest()">Nové zprávy ↓</button>
      }

      @if (error()) {
        <p class="cs-error" role="alert">{{ error() }}</p>
      }

      @if (canPost()) {
        <div class="chat__composer">
          <app-mention-input [candidates]="mentionable()" [events]="linkableEvents()" [sendOnEnter]="true" placeholder="Zpráva pro skupinu… (@ člen, # akce)" label="Zpráva do chatu" (submitted)="send($event)" />
        </div>
      } @else {
        <p class="cs-hint">Chat čtete jako nečlen otevřené skupiny – psát mohou jen členové.</p>
      }
    </div>

    <ng-template #cardActions let-postId let-comment="comment" let-count="count">
      <div class="chat-card__actions">
        <a class="chat-card__action" [routerLink]="['/app/posts', postId]" [fragment]="'comment-' + comment.id">
          {{ count ? 'Otevřít všech ' + count + ' komentářů' : 'Otevřít diskuzi' }}
        </a>
        @if (canPost()) {
          <button type="button" class="chat-card__action" (click)="replyTo.set(replyTo() === postId ? null : postId)">Odpovědět</button>
        }
      </div>
      @if (replyTo() === postId) {
        <div class="chat-card__reply">
          <app-mention-input [candidates]="mentionable()" [rows]="2" submitLabel="Do diskuze" placeholder="Odpověď se uloží pod příspěvek…" label="Odpověď do diskuze příspěvku" (submitted)="reply(postId, $event)" />
        </div>
      }
    </ng-template>
  `,
})
export class GroupChatComponent implements OnInit, OnDestroy {
  readonly group = input.required<Group>();

  private access = inject(AccessService);
  private chat = inject(ChatService);
  private postsService = inject(PostsService);
  private commentsService = inject(CommentsService);
  private membersService = inject(MembersService);
  private audit = inject(AuditService);
  private settings = inject(EnsembleSettingsService).settings;
  private events = toSignal(inject(EventsService).getEvents(), { initialValue: [] });
  private destroyRef = inject(DestroyRef);
  private log = viewChild<ElementRef<HTMLElement>>('log');

  private posts = toSignal(interval(REFRESH_MS).pipe(startWith(0), switchMap(() => this.postsService.getPosts())), { initialValue: [] });
  private comments = signal<PostComment[]>([]);

  readonly me = this.access.memberId;
  readonly linkableEvents = inject(EventsService).linkableEvents;
  readonly replyTo = signal<number | null>(null);
  readonly error = signal('');
  // Hranice „Nové“ se zafixuje při otevření chatu, ať během čtení neposkakuje
  private readAtOpen = signal<string | undefined>(undefined);

  readonly canPost = computed(() => canPostInGroup(this.access.subject(), this.group()));
  private canModerate = computed(() => canModerateGroup(this.access.subject(), this.group()));

  private isVisible = computed(() => chatVisibility(this.group(), this.access.currentMember() ?? undefined));

  readonly items = computed<TimelineItem[]>(() => {
    const viewerId = this.me();
    if (!viewerId) return [];
    return buildGroupTimeline({
      groupId: this.group().id,
      viewerId,
      messages: this.chat.messagesFor(this.group().id),
      posts: this.posts(),
      comments: this.comments(),
      audit: this.audit.entries(),
      grouping: this.settings().chatGrouping,
      isVisible: this.isVisible(),
    });
  });

  readonly firstUnreadIndex = computed(() => {
    const readAt = this.readAtOpen();
    if (!readAt) return -1;
    return this.items().findIndex((i) => i.kind === 'message' && i.message.authorId !== this.me() && i.at > readAt);
  });

  readonly mentionable = computed<Member[]>(() =>
    this.membersService.members().filter((m) => m.isActive && m.groupIds.includes(this.group().id) && m.id !== this.me()),
  );

  private textCtx: AuditTextContext = {
    memberName: (id) => this.name(id),
    groupName: () => this.group().name,
    eventTitle: (id) => this.events().find((e) => e.id === id)?.title ?? 'akce',
  };

  constructor() {
    // Časová osa se přepočítává i při pravidelném obnovení dat – posouvat jen při skutečně nové položce,
    // a jen když je čtenář u konce (nebo při prvním zobrazení). Jinak nabídnout „Nové zprávy ↓“.
    effect(() => {
      const count = this.items().length;
      untracked(() => {
        if (!count || count === this.lastCount) return;
        const first = this.lastCount === 0;
        this.lastCount = count;
        if (first || this.atBottom) {
          this.chat.markRead(this.group().id);
          queueMicrotask(() => this.scrollToBottom());
        } else {
          this.hasNewBelow.set(true);
        }
      });
    });
  }

  ngOnInit(): void {
    this.readAtOpen.set(this.chat.lastReadAt(this.group().id));
    this.commentsService.getAllComments().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((c) => this.comments.set(c));
  }

  ngOnDestroy(): void {
    this.chat.markRead(this.group().id);
  }

  private lastCount = 0;
  // Je čtenář u konce chatu? (tolerance pro zaokrouhlení a drobný posun)
  private atBottom = true;
  readonly hasNewBelow = signal(false);

  onScroll(): void {
    const el = this.log()?.nativeElement;
    if (!el) return;
    this.atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (this.atBottom && this.hasNewBelow()) {
      this.hasNewBelow.set(false);
      this.chat.markRead(this.group().id);
    }
  }

  jumpToLatest(): void {
    this.hasNewBelow.set(false);
    this.chat.markRead(this.group().id);
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    const el = this.log()?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
    this.atBottom = true;
  }

  trackItem(item: TimelineItem): string {
    switch (item.kind) {
      case 'message': return `m${item.message.id}`;
      case 'system': return `s${item.entry.id}`;
      case 'post': return `p${item.post.id}`;
      case 'comment': return `c${item.comment.id}`;
      case 'comment-group': return `g${item.comments[0].id}`;
    }
  }

  dayLabel(index: number): string | null {
    const items = this.items();
    const day = (iso: string) => new Date(iso).toDateString();
    if (index > 0 && day(items[index - 1].at) === day(items[index].at)) return null;
    const date = new Date(items[index].at);
    const today = new Date();
    const yesterday = new Date(Date.now() - 86_400_000);
    if (date.toDateString() === today.toDateString()) return 'Dnes';
    if (date.toDateString() === yesterday.toDateString()) return 'Včera';
    return date.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'numeric' });
  }

  name(id: number | undefined): string {
    return this.membersService.members().find((m) => m.id === id)?.nickname ?? 'neznámý člen';
  }

  // Text pro náhled: zmínky jako @Přezdívka, zkrácený
  plain(body: string): string {
    return plainText(body, (id) => this.name(id), (id) => this.events().find((e) => e.id === id)?.title);
  }

  preview(text: string): string {
    return text.length > PREVIEW_LENGTH ? `${text.slice(0, PREVIEW_LENGTH)}…` : text;
  }

  commentsLabel(count: number): string {
    if (count < 5) return `${count} komentáře`;
    return `${count} komentářů`;
  }

  systemText(entry: AuditEntry): string {
    return chatSystemText(entry, this.textCtx);
  }

  mentionsMe(message: ChatMessage): boolean {
    return !!this.me() && message.mentionedMemberIds.includes(this.me()!);
  }

  canDelete(message: ChatMessage): boolean {
    return message.authorId === this.me() || this.canModerate();
  }

  send(input: MentionSubmit): void {
    this.error.set('');
    // Po vlastní zprávě vždy na konec
    this.atBottom = true;
    this.chat.send(this.group().id, input.body, input.mentionedMemberIds).subscribe({ error: (e) => this.error.set(errorMessage(e)) });
  }

  // Odpověď z chatové karty je komentář téže diskuze, ne nová chatová zpráva (docs/08 kap. 8.3)
  reply(postId: number, input: MentionSubmit): void {
    const memberId = this.me();
    if (!memberId || !this.canPost()) return;
    this.commentsService.addComment(postId, memberId, input.body, input.mentionedMemberIds).subscribe(() => this.replyTo.set(null));
  }

  remove(message: ChatMessage): void {
    const own = message.authorId === this.me();
    if (!confirm(own ? 'Smazat zprávu?' : 'Smazat cizí zprávu jako moderátor?')) return;
    this.chat.remove(message.id).subscribe({ error: (e) => this.error.set(errorMessage(e)) });
  }
}

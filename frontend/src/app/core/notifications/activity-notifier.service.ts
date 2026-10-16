import { Injectable, Injector, effect, inject } from '@angular/core';
import { Subscription, interval } from 'rxjs';
import { startWith, switchMap } from 'rxjs/operators';
import { AccessService } from '../access/access.service';
import { canReadGroupContent } from '../access/access.utils';
import { NotificationService } from './notification.service';
import { GroupNotificationsService } from './group-notifications.service';
import { GroupActivity, shouldNotify } from './group-notifications';
import { ChatService } from '../../features/chat/chat.service';
import { PostsService } from '../../features/posts/posts.service';
import { CommentsService } from '../../features/posts/comments.service';
import { GroupsService } from '../../features/groups/groups.service';
import { MembersService } from '../../features/members/members.service';
import { isPostInChat } from '../../features/chat/utils/chat-timeline';

const POLL_MS = 5000;

// Upozornění na novou aktivitu ve skupinách (chat, příspěvky, komentáře) podle volby u skupiny.
// Bez serveru jen během běhu aplikace a jen pro aktivitu, která přibyla po spuštění (ne staré zprávy).
// Zmínky v komentářích hlásí MainLayoutComponent, tady se proto přeskakují.
@Injectable({ providedIn: 'root' })
export class ActivityNotifierService {
  private access = inject(AccessService);
  private notifications = inject(NotificationService);
  private prefs = inject(GroupNotificationsService);
  private chat = inject(ChatService);
  private posts = inject(PostsService);
  private comments = inject(CommentsService);
  private groups = inject(GroupsService);
  private members = inject(MembersService);
  private injector = inject(Injector);

  private started = false;
  private subscriptions: Subscription[] = [];
  private known = { messages: new Set<number>(), posts: new Set<number>(), comments: new Set<number>() };
  private primed = { messages: false, posts: false, comments: false };

  start(): void {
    if (this.started) return;
    this.started = true;

    effect(() => this.check('messages', this.chat.messages().filter((m) => !m.deletedAt), (m) => ({ kind: 'chat-message', groupId: m.groupId, authorId: m.authorId, mentionedMemberIds: m.mentionedMemberIds }), (m) => `${this.name(m.authorId)}: zpráva ve skupině ${this.groupName(m.groupId)}`), { injector: this.injector });

    this.subscriptions.push(
      interval(POLL_MS).pipe(startWith(0), switchMap(() => this.posts.getPosts())).subscribe((posts) =>
        this.check('posts', posts.filter((p) => isPostInChat(p, p.groupId)), (p) => ({ kind: 'post', groupId: p.groupId, authorId: p.authorId, mentionedMemberIds: [] }), (p) => `Nový příspěvek ve skupině ${this.groupName(p.groupId)}: ${p.title}`),
      ),
      this.comments.comments$.subscribe((comments) => {
        const me = this.access.memberId();
        this.check(
          'comments',
          comments.filter((c) => !c.mentionedMemberIds.includes(me ?? -1)),
          (c) => ({ kind: 'comment', groupId: this.posts.findPost(c.postId)?.groupId ?? 0, authorId: c.authorId, mentionedMemberIds: [] }),
          (c) => `${this.name(c.authorId)} komentoval/a příspěvek ${this.posts.findPost(c.postId)?.title ?? ''}`,
        );
      }),
    );
  }

  private check<T extends { id: number }>(kind: keyof ActivityNotifierService['known'], items: T[], activity: (item: T) => GroupActivity, text: (item: T) => string): void {
    const known = this.known[kind];
    const fresh = items.filter((i) => !known.has(i.id));
    fresh.forEach((i) => known.add(i.id));
    if (!this.primed[kind]) {
      this.primed[kind] = true;
      return;
    }
    const me = this.access.memberId();
    if (!me) return;
    for (const item of fresh) {
      const a = activity(item);
      const group = this.groups.findGroup(a.groupId);
      const canRead = !!group && canReadGroupContent(this.access.subject(), group);
      if (shouldNotify(a, me, canRead, this.prefs.modeFor(me, a.groupId))) {
        // Do upozornění nedáváme obsah soukromé zprávy, jen kdo a kde
        this.notifications.notify(group?.name ?? 'Skupina', text(item));
      }
    }
  }

  private name(id: number): string {
    return this.members.findMember(id)?.nickname ?? 'Někdo';
  }

  private groupName(id: number): string {
    return this.groups.findGroup(id)?.name ?? '';
  }

  stop(): void {
    this.subscriptions.forEach((s) => s.unsubscribe());
    this.subscriptions = [];
  }
}

import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, RouterOutlet } from '@angular/router';
import { Router } from '@angular/router';
import { BottomNavComponent } from '../bottom-nav/bottom-nav.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { IconComponent } from '../../../shared/icon/icon.component';
import { DemoBannerComponent } from '../demo-banner/demo-banner.component';
import { VersionLabelComponent } from '../../../shared/version-label/version-label.component';
import { AuthService } from '../../auth/auth.service';
import { MembersService } from '../../../features/members/members.service';
import { CommentsService } from '../../../features/posts/comments.service';
import { NotificationService } from '../../notifications/notification.service';
import { ActivityNotifierService } from '../../notifications/activity-notifier.service';
import { Member } from '../../models/member.model';
import { PostComment } from '../../../features/posts/models/comment.model';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, IconComponent, BottomNavComponent, SidebarComponent, DemoBannerComponent, VersionLabelComponent],
  templateUrl: './main-layout.component.html',
})
export class MainLayoutComponent implements OnInit {
  constructor(
    public auth: AuthService,
    private router: Router,
    private membersService: MembersService,
    private commentsService: CommentsService,
    private notificationService: NotificationService,
    private activityNotifier: ActivityNotifierService,
  ) {}

  private destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    const user = this.auth.currentUser();
    if (!user) return;

    this.membersService.getMembers().subscribe((members) => {
      const member = members.find((m) => m.userId === user.id);
      if (!member) return;

      this.watchForNewMentions(member.id, members);
      this.activityNotifier.start();
    });
  }

  // Notifikace se zobrazí jen pro zmínky, které se objeví AŽ během tohoto běhu appky
  // (žádoucí, jinak by po přihlášení naráz vypálily upozornění na všechny staré zmínky)
  private watchForNewMentions(memberId: number, members: Member[]): void {
    let knownUnseenIds: Set<number> | null = null;

    this.commentsService.comments$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((comments) => {
      const unseen = comments.filter(
        (c) => c.mentionedMemberIds.includes(memberId) && !c.seenByMemberIds.includes(memberId),
      );

      if (knownUnseenIds) {
        for (const comment of unseen) {
          if (!knownUnseenIds.has(comment.id)) {
            this.notifyMention(comment, members);
          }
        }
      }
      knownUnseenIds = new Set(unseen.map((c) => c.id));
    });
  }

  private notifyMention(comment: PostComment, members: Member[]): void {
    const authorName = members.find((m) => m.id === comment.authorId)?.nickname ?? 'Někdo';
    this.notificationService.notify('Nová zmínka', `${authorName} vás zmínil(a) v komentáři`);
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}

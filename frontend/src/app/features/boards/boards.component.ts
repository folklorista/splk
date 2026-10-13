import { Component, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { BoardsService } from './boards.service';
import { Group } from '../../core/models/group.model';
import { IconComponent } from '../../shared/icon/icon.component';

// Rozcestník nástěnek (hlavně pro spodní navigaci na mobilu, kde není místo na každou nástěnku zvlášť)
@Component({
  selector: 'app-boards',
  standalone: true,
  imports: [RouterLink, IconComponent],
  template: `
    <div class="page">
      <h1 class="page__title">Nástěnky</h1>

      @if (loading()) {
        <p class="state-note">Načítání…</p>
      } @else if (!boards().length) {
        <p class="state-note">Nejste členem žádné skupiny s nástěnkou.</p>
      } @else {
        <ul class="item-list">
          @for (board of boards(); track board.id) {
            <li class="item-list__item item-list__item--link" [routerLink]="['/app/boards', board.slug]">
              <div class="item-list__row">
                <span class="item-list__title">
                  @if (board.icon) {
                    <app-icon [name]="board.icon" [size]="16" />
                  }
                  {{ board.name }}
                </span>
                @if (badges().get(board.id); as count) {
                  <div class="item-list__badges">
                    <span class="badge badge--requires-action">{{ count }} nové</span>
                  </div>
                }
              </div>
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class BoardsComponent implements OnInit {
  boards = signal<Group[]>([]);
  badges = signal<Map<number, number>>(new Map());
  loading = signal(true);

  constructor(
    private boardsService: BoardsService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    forkJoin([this.boardsService.getMyBoards(), this.boardsService.getBoardBadges()]).subscribe(([boards, badges]) => {
      if (boards.length === 1) {
        this.router.navigate(['/app/boards', boards[0].slug], { replaceUrl: true });
        return;
      }
      this.boards.set(boards);
      this.badges.set(badges);
      this.loading.set(false);
    });
  }
}

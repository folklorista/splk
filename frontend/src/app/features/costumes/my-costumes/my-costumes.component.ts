import { Component, Input, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { CostumesService } from '../costumes.service';
import { MembersService } from '../../members/members.service';
import { AuthService } from '../../../core/auth/auth.service';
import { myCostumeRows } from '../utils/costume-logic';

// „Moje kroje“ – co má přihlášený člen podle oficiální evidence svěřeno. Jen ke čtení:
// změny zapisují krojárky.
@Component({
  selector: 'app-my-costumes',
  standalone: true,
  imports: [DatePipe],
  template: `
    @if (rows(); as list) {
      @if (list.length) {
        <ul class="item-list">
          @for (row of list; track row.key) {
            <li class="item-list__item">
              <div class="item-list__row">
                <span class="item-list__title">{{ row.label }}</span>
                <div class="item-list__badges">
                  @if (row.overdue) {
                    <span class="badge badge--requires-action">Po termínu</span>
                  }
                </div>
              </div>
              <div class="item-list__meta">
                @if (row.kit) { Komplet {{ row.kit }} · }
                od {{ row.issuedAt | date: 'd. M. yyyy' }}
                · {{ row.dueAt ? 'vrátit do ' + (row.dueAt | date: 'd. M. yyyy') : 'dlouhodobě' }}
              </div>
            </li>
          }
        </ul>
      } @else if (!compact) {
        <p class="state-note">Nemáte svěřené žádné kroje.</p>
      }
      @if (!compact) {
        <p class="state-note">Změnu nebo vrácení zapisuje krojárka. Pokud něco předáte jinému členovi bez jejího vědomí, odpovídáte za to dál vy.</p>
      }
    }
  `,
})
export class MyCostumesComponent {
  // Na přehledu bez vysvětlujících textů
  @Input() compact = false;

  private state = toSignal(inject(CostumesService).state$);
  private memberId = signal<number | null>(null);

  readonly rows = computed(() => {
    const state = this.state();
    const memberId = this.memberId();
    return state && memberId !== null ? myCostumeRows(state, memberId) : null;
  });

  constructor(membersService: MembersService, auth: AuthService) {
    const user = auth.currentUser();
    if (user) {
      membersService.getMemberByUserId(user.id).subscribe((member) => this.memberId.set(member?.id ?? null));
    }
  }
}

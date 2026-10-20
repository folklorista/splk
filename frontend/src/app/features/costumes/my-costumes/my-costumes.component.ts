import { Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { CostumesService } from '../costumes.service';
import { AccessService } from '../../../core/access/access.service';
import { myCostumeRows } from '../utils/costume-logic';
import { invitationsFor } from '../utils/inventory-logic';

// Kompaktní přehled zapůjčených kusů na nástěnce Přehled (celá karta je na stránce Moje kroje)
@Component({
  selector: 'app-my-costumes',
  standalone: true,
  imports: [DatePipe],
  template: `
    @if (invitations().length) {
      <p class="state-note"><strong>Inventura:</strong> {{ invitations().join(', ') }} – vyberte si termín v Mých krojích.</p>
    }
    @if (rows(); as list) {
      <ul class="item-list item-list--rows">
        @for (row of list; track row.loanId) {
          <li class="item-list__item">
            <div class="item-list__row">
              <span class="item-list__title">{{ row.part }} {{ row.number }}</span>
              @if (row.overdue) { <span class="badge badge--requires-action">Po termínu</span> }
            </div>
            <div class="item-list__meta">{{ row.series }} · {{ row.dueAt ? 'vrátit do ' + (row.dueAt | date: 'd. M. yyyy') : 'dlouhodobě' }}</div>
          </li>
        }
      </ul>
    }
  `,
})
export class MyCostumesComponent {
  private state = toSignal(inject(CostumesService).state$);
  private memberId = inject(AccessService).memberId;

  readonly rows = computed(() => {
    const state = this.state();
    const memberId = this.memberId();
    return state && memberId !== null ? myCostumeRows(state, memberId) : null;
  });

  readonly invitations = computed(() => {
    const state = this.state();
    const memberId = this.memberId();
    return state && memberId !== null ? invitationsFor(state, memberId).map((i) => i.name) : [];
  });
}

import { Component, computed, inject, signal } from '@angular/core';
import { AvailabilityService } from './availability.service';
import { formatRange, upcomingUnavailability } from './unavailability.utils';
import { ActionFeedback } from '../../shared/ui/form-ui';

// Profil → Moje nedostupnost: delší období, kdy nemůžu na zkoušky ani vystoupení (docs/10 kap. 4.11).
@Component({
  selector: 'app-my-unavailability',
  standalone: true,
  template: `
    <section class="mu">
      <h2 class="mu__title">Moje nedostupnost</h2>
      <p class="mu__hint">Delší období, kdy nemůžete na zkoušky ani vystoupení (dovolená, studium, nemoc). Organizátoři to uvidí u akcí v tomto termínu. Neomlouvá vás to automaticky – na jednotlivé akce dál odpovídáte. Poznámku vidíte jen vy a pověření organizátoři.</p>
      @if (feedback.error()) { <p class="cs-error" role="alert">{{ feedback.error() }}</p> }
      @if (items().length) {
        <ul class="mu__list">
          @for (item of items(); track item.id) {
            <li class="mu__item">
              <span><strong>{{ range(item) }}</strong>@if (item.note) { · {{ item.note }} }</span>
              <button type="button" class="cs-btn" (click)="remove(item.id)">Smazat</button>
            </li>
          }
        </ul>
      } @else {
        <p class="mu__empty">Žádná nedostupnost není zadaná.</p>
      }
      <form class="mu__form" (submit)="$event.preventDefault(); add()">
        <label class="cs-field"><span>Od</span><input type="date" required [value]="from()" (input)="from.set($any($event.target).value)" /></label>
        <label class="cs-field"><span>Do</span><input type="date" required [min]="from()" [value]="to()" (input)="to.set($any($event.target).value)" /></label>
        <label class="cs-field mu__note"><span>Poznámka (nepovinné)</span><input type="text" placeholder="např. dovolená" [value]="note()" (input)="note.set($any($event.target).value)" /></label>
        <button type="submit" class="cs-btn cs-btn--primary" [disabled]="feedback.busy() || !from() || !to()">Přidat</button>
      </form>
    </section>
  `,
  styles: [`
    .mu { margin-bottom: 2rem; }
    .mu__title { margin: 0 0 0.5rem; font-size: 1rem; font-weight: 600; }
    .mu__hint, .mu__empty { font-size: var(--font-size-sm); color: var(--color-text-muted); margin-bottom: var(--spacing-sm); }
    .mu__list { list-style: none; padding: 0; margin: 0 0 var(--spacing-md); display: flex; flex-direction: column; gap: var(--spacing-xs); }
    .mu__item { display: flex; justify-content: space-between; align-items: center; gap: var(--spacing-sm); padding: var(--spacing-xs) var(--spacing-sm); border: 1px solid var(--color-border); border-radius: 6px; }
    .mu__form { display: flex; flex-wrap: wrap; gap: var(--spacing-sm); align-items: flex-end; }
    .mu__note { flex: 1 1 200px; }
  `],
})
export class MyUnavailabilityComponent {
  private service = inject(AvailabilityService);
  readonly feedback = new ActionFeedback();
  readonly items = computed(() => upcomingUnavailability(this.service.mine()));
  readonly from = signal('');
  readonly to = signal('');
  readonly note = signal('');
  readonly range = formatRange;

  add(): void {
    this.feedback.run(this.service.add({ from: this.from(), to: this.to(), note: this.note() }), () => {
      this.from.set('');
      this.to.set('');
      this.note.set('');
    }, 'Nedostupnost uložena');
  }

  remove(id: number): void {
    this.feedback.run(this.service.remove(id), undefined, 'Smazáno');
  }
}

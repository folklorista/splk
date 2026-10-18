import { Component, computed, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HolidayRange, SeriesOccurrence, applyExceptions, generateSeriesDates, isoWeekday, MAX_SERIES_OCCURRENCES, nationwideSchoolHolidays } from '../utils/event-series';

const WEEKDAYS: [number, string][] = [[1, 'Po'], [2, 'Út'], [3, 'St'], [4, 'Čt'], [5, 'Pá'], [6, 'So'], [7, 'Ne']];

// Opakování akce (série nácviků, docs/07 kap. 17): pravidlo, předvyplněné výjimky a náhled termínů,
// ve kterém lze jednotlivé termíny ručně vynechat nebo vrátit a upravit důvod. Ukládá rodičovský formulář.
@Component({
  selector: 'app-series-planner',
  standalone: true,
  imports: [DatePipe],
  template: `
    <fieldset class="event-form__fieldset sp">
      <legend>Opakování</legend>
      <label class="cs-field cs-field--inline">
        <input type="checkbox" [checked]="enabled()" (change)="enabled.set($any($event.target).checked)" />
        Opakovaná série (např. pravidelné nácviky) – každý termín bude samostatná akce s vlastní účastí
      </label>
      @if (enabled()) {
        <div class="cs-form__row">
          <label class="cs-field">
            <span>Opakovat do *</span>
            <input type="date" required [min]="startDate()" [value]="until()" (input)="until.set($any($event.target).value)" />
          </label>
          <label class="cs-field">
            <span>Interval</span>
            <select (change)="interval.set(+$any($event.target).value)">
              <option value="1" [selected]="interval() === 1">každý týden</option>
              <option value="2" [selected]="interval() === 2">každý druhý týden</option>
            </select>
          </label>
        </div>
        <div class="sp__weekdays" role="group" aria-label="Dny v týdnu">
          @for (day of weekdays; track day[0]) {
            <label class="sp__day"><input type="checkbox" [checked]="activeWeekdays().includes(day[0])" (change)="toggleWeekday(day[0])" /> {{ day[1] }}</label>
          }
        </div>

        <h3 class="sp__subtitle">Výjimky (předvyplní se jednou, v náhledu je můžete upravit)</h3>
        <label class="cs-field cs-field--inline"><input type="checkbox" [checked]="publicHolidays()" (change)="publicHolidays.set($any($event.target).checked)" /> Státní svátky</label>
        <label class="cs-field cs-field--inline"><input type="checkbox" [checked]="schoolHolidays()" (change)="schoolHolidays.set($any($event.target).checked)" /> Vánoční a velikonoční prázdniny</label>
        @for (range of customRanges(); track $index; let i = $index) {
          <div class="sp__range">
            <input type="text" placeholder="např. Jarní prázdniny" [value]="range.label" (input)="patchRange(i, { label: $any($event.target).value })" aria-label="Název" />
            <input type="date" [value]="range.from" (input)="patchRange(i, { from: $any($event.target).value })" aria-label="Od" />
            <input type="date" [value]="range.to" (input)="patchRange(i, { to: $any($event.target).value })" aria-label="Do" />
            <button type="button" class="cs-btn" (click)="removeRange(i)">Odebrat</button>
          </div>
        }
        <button type="button" class="cs-btn sp__add" (click)="addRange()">+ Další prázdniny (podzimní, pololetní, jarní podle okresu)</button>
        <label class="cs-field cs-field--inline"><input type="checkbox" [checked]="wholeWeek()" (change)="wholeWeek.set($any($event.target).checked)" /> Vynechat celý týden, ve kterém jsou prázdniny</label>

        <h3 class="sp__subtitle">Náhled: {{ occurrences().length }} termínů, z toho {{ skippedCount() }} vynecháno</h3>
        @if (!occurrences().length) {
          <p class="cs-hint">Vyplňte datum začátku, „Opakovat do“ a aspoň jeden den v týdnu.</p>
        }
        @if (occurrences().length >= maxOccurrences) {
          <p class="cs-hint">Série je omezená na {{ maxOccurrences }} termínů.</p>
        }
        <ul class="sp__list">
          @for (o of occurrences(); track o.date) {
            <li class="sp__row" [class.sp__row--skipped]="o.skipReason">
              <span class="sp__date">{{ dayLabel(o.date) }} {{ o.date | date: 'd. M. yyyy' }}</span>
              @if (o.skipReason !== undefined) {
                <input class="sp__reason" type="text" [value]="o.skipReason" (input)="setReason(o.date, $any($event.target).value)" aria-label="Důvod vynechání" />
                <button type="button" class="cs-btn" (click)="restore(o.date)">Konat</button>
              } @else {
                <span class="sp__status">koná se</span>
                <button type="button" class="cs-btn" (click)="skip(o.date)">Vynechat</button>
              }
            </li>
          }
        </ul>
      }
    </fieldset>
  `,
  styles: [`
    .sp__weekdays { display: flex; flex-wrap: wrap; gap: var(--spacing-sm); }
    .sp__day { display: flex; align-items: center; gap: 4px; font-size: var(--font-size-sm); }
    .sp__subtitle { font-size: var(--font-size-sm); font-weight: 600; margin: var(--spacing-sm) 0 0; }
    .sp__range { display: flex; flex-wrap: wrap; gap: var(--spacing-xs); align-items: center; }
    .sp__range input[type='text'] { flex: 1 1 160px; }
    .sp__add { align-self: flex-start; }
    .sp__list { list-style: none; padding: 0; margin: 0; max-height: 320px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; }
    .sp__row { display: flex; align-items: center; gap: var(--spacing-sm); padding: 4px var(--spacing-xs); border-bottom: 1px solid var(--color-border); font-size: var(--font-size-sm); }
    .sp__row--skipped .sp__date { color: var(--color-text-muted); text-decoration: line-through; }
    .sp__date { min-width: 120px; }
    .sp__status { flex: 1; color: var(--color-text-muted); }
    .sp__reason { flex: 1; min-width: 0; }
  `],
})
export class SeriesPlannerComponent {
  // Začátek první akce z formuláře (datetime-local)
  readonly startsAt = input('');

  readonly weekdays = WEEKDAYS;
  readonly maxOccurrences = MAX_SERIES_OCCURRENCES;
  readonly enabled = signal(false);
  readonly until = signal('');
  readonly interval = signal(1);
  private chosenWeekdays = signal<number[] | null>(null);
  readonly publicHolidays = signal(true);
  readonly schoolHolidays = signal(true);
  readonly wholeWeek = signal(false);
  readonly customRanges = signal<HolidayRange[]>([]);
  // Ruční úpravy náhledu: datum → důvod (vynecháno) nebo null (koná se)
  private overrides = signal(new Map<string, string | null>());

  readonly startDate = computed(() => this.startsAt().slice(0, 10));
  // Bez ruční volby platí den v týdnu prvního termínu
  readonly activeWeekdays = computed(() => this.chosenWeekdays() ?? (this.startDate() ? [isoWeekday(this.startDate())] : []));

  readonly occurrences = computed<SeriesOccurrence[]>(() => {
    if (!this.enabled()) return [];
    const dates = generateSeriesDates({ from: this.startDate(), to: this.until(), weekdays: this.activeWeekdays(), intervalWeeks: this.interval() });
    if (!dates.length) return [];
    const years = dates.map((d) => Number(d.slice(0, 4)));
    const holidays = [...(this.schoolHolidays() ? nationwideSchoolHolidays(Math.min(...years), Math.max(...years)) : []), ...this.customRanges()];
    const prefilled = applyExceptions(dates, { publicHolidays: this.publicHolidays(), holidays, wholeWeek: this.wholeWeek() });
    return prefilled.map((o) => {
      if (!this.overrides().has(o.date)) return o;
      const reason = this.overrides().get(o.date);
      return reason === null ? { date: o.date } : { date: o.date, skipReason: reason };
    });
  });

  readonly skippedCount = computed(() => this.occurrences().filter((o) => o.skipReason !== undefined).length);

  dayLabel(date: string): string {
    return WEEKDAYS[isoWeekday(date) - 1][1];
  }

  toggleWeekday(day: number): void {
    const current = this.activeWeekdays();
    this.chosenWeekdays.set(current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort());
  }

  addRange(): void {
    this.customRanges.update((list) => [...list, { label: '', from: '', to: '' }]);
  }

  patchRange(index: number, change: Partial<HolidayRange>): void {
    this.customRanges.update((list) => list.map((r, i) => (i === index ? { ...r, ...change, label: (change.label ?? r.label) } : r)));
  }

  removeRange(index: number): void {
    this.customRanges.update((list) => list.filter((_, i) => i !== index));
  }

  skip(date: string): void {
    this.overrides.update((map) => new Map(map).set(date, 'Vynecháno'));
  }

  restore(date: string): void {
    this.overrides.update((map) => new Map(map).set(date, null));
  }

  setReason(date: string, reason: string): void {
    this.overrides.update((map) => new Map(map).set(date, reason));
  }
}

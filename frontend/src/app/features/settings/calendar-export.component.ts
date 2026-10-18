import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { SettingsService } from '../../core/settings/settings.service';
import { AccessService } from '../../core/access/access.service';
import { isEventAudience } from '../../core/access/access.utils';
import { EventsService } from '../events/events.service';
import { EnsembleSettingsService } from '../ensemble/ensemble-settings.service';
import { EventType } from '../events/models/event.model';
import { DEFAULT_ICS_TYPES, buildIcs, downloadIcs, selectIcsEvents } from '../events/utils/ics';

const TYPE_LABELS: [EventType, string][] = [
  ['rehearsal', 'Zkoušky a nácviky'],
  ['performance', 'Vystoupení'],
  ['camp', 'Soustředění'],
  ['meeting', 'Schůzky'],
  ['other', 'Ostatní'],
];

// Nastavení → Kalendář: jednorázový export mých akcí do .ics (docs/07 kap. 17).
// Průběžný odběr (URL s tokenem) přibude s backendem.
@Component({
  selector: 'app-calendar-export',
  standalone: true,
  template: `
    <section class="settings__section">
      <h2 class="settings__title">Kalendář</h2>
      <p class="settings__hint">Stáhněte si své akce do kalendáře v telefonu nebo počítači (.ics). Soubor je jednorázový – po změnách akcí ho stáhněte znovu. Průběžný odběr přibude později.</p>
      @for (option of typeOptions; track option[0]) {
        <label class="settings__row settings__row--check">
          <input type="checkbox" [checked]="types().includes(option[0])" (change)="toggleType(option[0])" />
          <span>{{ option[1] }}</span>
        </label>
      }
      <label class="settings__row settings__row--check">
        <input type="checkbox" [checked]="skippedAsNotice()" (change)="setSkipped($any($event.target).checked)" />
        <span>Vynechané termíny pravidelných nácviků jako „NENÍ {{ ensembleName() }} – důvod“</span>
      </label>
      <button type="button" class="cs-btn cs-btn--primary" [disabled]="!count()" (click)="download()">Stáhnout .ics ({{ count() }} akcí)</button>
    </section>
  `,
})
export class CalendarExportComponent {
  private settings = inject(SettingsService);
  private access = inject(AccessService);
  private ensemble = inject(EnsembleSettingsService).settings;
  private events = toSignal(inject(EventsService).getEvents(), { initialValue: [] });

  readonly typeOptions = TYPE_LABELS;
  readonly types = computed(() => (this.settings.settings().calendarExport?.types as EventType[] | undefined) ?? DEFAULT_ICS_TYPES);
  readonly skippedAsNotice = computed(() => this.settings.settings().calendarExport?.skippedAsNotice ?? false);
  readonly ensembleName = computed(() => this.ensemble().name.toUpperCase());

  // Moje akce od posledních 30 dní dál
  private myEvents = computed(() => {
    const member = this.access.currentMember();
    if (!member) return [];
    const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return this.events().filter((e) => isEventAudience(member, e) && Date.parse(e.endsAt) >= since);
  });
  readonly count = computed(() => selectIcsEvents(this.myEvents(), { types: this.types(), skippedAsNotice: this.skippedAsNotice() }).length);

  toggleType(type: EventType): void {
    const types = this.types().includes(type) ? this.types().filter((t) => t !== type) : [...this.types(), type];
    this.settings.update({ calendarExport: { types, skippedAsNotice: this.skippedAsNotice() } });
  }

  setSkipped(value: boolean): void {
    this.settings.update({ calendarExport: { types: this.types(), skippedAsNotice: value } });
  }

  download(): void {
    const content = buildIcs(this.myEvents(), { types: this.types(), skippedAsNotice: this.skippedAsNotice(), ensembleName: this.ensemble().name });
    downloadIcs(content, 'akce.ics');
  }
}

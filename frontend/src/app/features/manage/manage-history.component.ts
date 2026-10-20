import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { AuditService } from '../audit/audit.service';
import { AuditTextContext, auditText } from '../audit/audit-text';
import { AuditEntry } from '../audit/audit.model';
import { MembersService } from '../members/members.service';
import { GroupsService } from '../groups/groups.service';
import { EventsService } from '../events/events.service';

type HistoryFilter = 'all' | 'membership' | 'mandates' | 'groups' | 'people' | 'extraordinary';

const FILTERS: Record<HistoryFilter, (e: AuditEntry) => boolean> = {
  all: () => true,
  membership: (e) => e.action.startsWith('member-') || e.action.startsWith('request-') || e.action.startsWith('invitation-') || e.action === 'proposal-created',
  mandates: (e) => e.action.startsWith('mandate-'),
  groups: (e) => e.action.startsWith('group-') || e.action === 'settings-updated',
  people: (e) => e.action.startsWith('person-'),
  extraordinary: (e) => !!e.extraordinary,
};

// Správa → Historie: kdo, kdy a co změnil v osobách, skupinách, členství a pověřeních.
// Moderace obsahu a změny akcí jsou v historii jednotlivých skupin – Správa souboru nečte obsah.
@Component({
  selector: 'app-manage-history',
  standalone: true,
  imports: [DatePipe],
  template: `
    <div class="cs-toolbar">
      <select class="cs-input mh__filter" aria-label="Filtr" (change)="filter.set($any($event.target).value)">
        <option value="all">Vše</option>
        <option value="membership">Členství, žádosti, pozvánky</option>
        <option value="mandates">Pověření</option>
        <option value="groups">Skupiny a konfigurace</option>
        <option value="people">Osoby</option>
        <option value="extraordinary">Mimořádné zásahy</option>
      </select>
    </div>
    @if (!entries().length) {
      <p class="state-note">Zatím žádné záznamy. Historie se začne plnit první změnou.</p>
    }
    <ul class="cs-history">
      @for (entry of entries(); track entry.id) {
        <li class="cs-history__item" [class.mh__extraordinary]="entry.extraordinary">
          {{ text(entry) }}
          <div class="cs-history__meta">{{ entry.at | date: 'd. M. yyyy HH:mm' }} · {{ name(entry.actorId) }}@if (entry.extraordinary) { · mimořádný zásah }</div>
          @if (entry.note) { <div class="cs-history__note">Interní poznámka: {{ entry.note }}</div> }
        </li>
      }
    </ul>
  `,
  styles: [`.mh__filter { width: auto; } .mh__extraordinary { border-left-color: var(--status-warn-border); }`],
})
export class ManageHistoryComponent {
  private audit = inject(AuditService);
  private membersService = inject(MembersService);
  private groupsService = inject(GroupsService);
  private events = toSignal(inject(EventsService).getEvents(), { initialValue: [] });

  readonly filter = signal<HistoryFilter>('all');
  readonly entries = computed(() =>
    this.audit
      .entries()
      .filter((e) => !e.action.startsWith('post-') && !e.action.startsWith('event-'))
      .filter(FILTERS[this.filter()])
      .slice()
      .reverse(),
  );

  private ctx: AuditTextContext = {
    memberName: (id) => this.name(id),
    groupName: (id) => this.groupsService.findGroup(id ?? 0)?.name ?? 'smazaná skupina',
    eventTitle: (id) => this.events().find((e) => e.id === id)?.title ?? 'akce',
  };

  name(id: number | undefined): string {
    return this.membersService.members().find((m) => m.id === id)?.nickname ?? 'neznámá osoba';
  }

  text(entry: AuditEntry): string {
    return auditText(entry, this.ctx);
  }
}

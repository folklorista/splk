import { Component, inject, linkedSignal } from '@angular/core';
import { EnsembleSettingsService } from '../ensemble/ensemble-settings.service';
import { AuditService } from '../audit/audit.service';
import { AccessService } from '../../core/access/access.service';
import { EnsembleSettings, GroupCreationPolicy } from '../../core/models/ensemble-settings.model';
import { CHAT_HISTORY_LABELS, ChatHistoryMode, GroupTab, GroupVisibility } from '../../core/models/group.model';
import { ActionFeedback } from '../../shared/ui/form-ui';
import { of } from 'rxjs';

// Správa → Konfigurace: nastavení celého souboru (moduly, zakládání skupin, výchozí volby).
// Osobní vzhled a notifikace jsou v Nastavení, ne tady.
@Component({
  selector: 'app-manage-config',
  standalone: true,
  template: `
    <form class="cs-form mc" (submit)="$event.preventDefault(); save()">
      <label class="cs-field">
        <span>Název souboru</span>
        <input type="text" [value]="draft().name" (input)="patch({ name: $any($event.target).value })" />
      </label>

      <fieldset class="mc__fieldset">
        <legend>Moduly</legend>
        <label class="cs-field cs-field--inline">
          <input type="checkbox" [checked]="draft().modules.events" (change)="patchModules({ events: $any($event.target).checked })" />
          Akce a docházka
        </label>
        <label class="cs-field cs-field--inline">
          <input type="checkbox" [checked]="draft().modules.costumes" (change)="patchModules({ costumes: $any($event.target).checked })" />
          Kroje a správa krojů
        </label>
        <p class="cs-hint">Vypnutý modul zmizí z menu všem; data zůstanou. Skupiny a členství patří do jádra a vypnout nejdou.</p>
      </fieldset>

      <fieldset class="mc__fieldset">
        <legend>Kdo zakládá skupiny</legend>
        @for (option of creationOptions; track option[0]) {
          <label class="cs-field cs-field--inline">
            <input type="radio" name="groupCreation" [checked]="draft().groupCreation === option[0]" (change)="patch({ groupCreation: option[0] })" />
            {{ option[1] }}
          </label>
        }
        <p class="cs-hint">Kdo skupinu založí, stane se jejím hlavním správcem. Režim „člen navrhne, správce schválí“ přijde později.</p>
      </fieldset>

      <fieldset class="mc__fieldset">
        <legend>Výchozí nastavení nové skupiny</legend>
        <div class="cs-form__row">
          <label class="cs-field">
            <span>Viditelnost</span>
            <select (change)="patchDefaults({ visibility: $any($event.target).value })">
              @for (v of visibilityOptions; track v[0]) {
                <option [value]="v[0]" [selected]="draft().newGroupDefaults.visibility === v[0]">{{ v[1] }}</option>
              }
            </select>
          </label>
          <label class="cs-field">
            <span>Výchozí záložka</span>
            <select (change)="patchDefaults({ defaultTab: $any($event.target).value })">
              <option value="chat" [selected]="draft().newGroupDefaults.defaultTab === 'chat'">Chat</option>
              <option value="board" [selected]="draft().newGroupDefaults.defaultTab === 'board'">Nástěnka</option>
            </select>
          </label>
        </div>
        <label class="cs-field cs-field--inline">
          <input type="checkbox" [checked]="draft().newGroupDefaults.chatEnabled" (change)="patchDefaults({ chatEnabled: $any($event.target).checked })" /> Chat
        </label>
        <label class="cs-field cs-field--inline">
          <input type="checkbox" [checked]="draft().newGroupDefaults.boardEnabled" (change)="patchDefaults({ boardEnabled: $any($event.target).checked })" /> Nástěnka
        </label>
        <label class="cs-field">
          <span>Historie chatu pro nové členy</span>
          <select (change)="patchDefaults({ chatHistory: $any($event.target).value })">
            @for (option of chatHistoryOptions; track option[0]) {
              <option [value]="option[0]" [selected]="(draft().newGroupDefaults.chatHistory ?? 'open') === option[0]">{{ option[1] }}</option>
            }
          </select>
        </label>
        <p class="cs-hint">Chat a nástěnku jednotlivé skupiny zapíná a vypíná její správce – nezaměňovat s vypnutím modulu.</p>
      </fieldset>

      <fieldset class="mc__fieldset">
        <legend>Seskupování komentářů v chatu</legend>
        <div class="cs-form__row">
          <label class="cs-field">
            <span>Od počtu komentářů</span>
            <input type="number" min="2" max="20" [value]="draft().chatGrouping.minComments" (input)="patchGrouping({ minComments: +$any($event.target).value })" />
          </label>
          <label class="cs-field">
            <span>Max. pauza mezi nimi (min)</span>
            <input type="number" min="1" max="240" [value]="draft().chatGrouping.windowMinutes" (input)="patchGrouping({ windowMinutes: +$any($event.target).value })" />
          </label>
        </div>
        <p class="cs-hint">Víc komentářů pod jedním příspěvkem v rychlém sledu se v chatu ukáže jako jedna souhrnná karta. Celá diskuze zůstává pod příspěvkem.</p>
      </fieldset>

      @if (feedback.success()) { <p class="cs-success" role="status">{{ feedback.success() }}</p> }
      <div class="cs-form__actions">
        <button type="submit" class="cs-btn cs-btn--primary">Uložit konfiguraci</button>
      </div>
    </form>
  `,
  styles: [
    `
      .mc { max-width: 640px; }
      .mc__fieldset { border: 1px solid var(--color-border); border-radius: 8px; padding: var(--spacing-sm) var(--spacing-md) var(--spacing-md); display: flex; flex-direction: column; gap: var(--spacing-sm); }
      .mc__fieldset legend { font-size: var(--font-size-sm); font-weight: 600; padding: 0 4px; }
    `,
  ],
})
export class ManageConfigComponent {
  private settingsService = inject(EnsembleSettingsService);
  private audit = inject(AuditService);
  private access = inject(AccessService);

  readonly feedback = new ActionFeedback();
  readonly draft = linkedSignal<EnsembleSettings>(() => structuredClone(this.settingsService.settings()));
  readonly creationOptions: [GroupCreationPolicy, string][] = [
    ['admins', 'Jen Správa souboru (výchozí pro Vonici)'],
    ['members', 'Všichni aktivní členové'],
  ];
  readonly chatHistoryOptions = Object.entries(CHAT_HISTORY_LABELS) as [ChatHistoryMode, string][];
  readonly visibilityOptions: [GroupVisibility, string][] = [
    ['private', 'Soukromá'],
    ['open', 'Otevřená'],
    ['hidden', 'Skrytá'],
  ];

  patch(change: Partial<EnsembleSettings>): void {
    this.draft.update((d) => ({ ...d, ...change }));
  }

  patchModules(change: Partial<EnsembleSettings['modules']>): void {
    this.draft.update((d) => ({ ...d, modules: { ...d.modules, ...change } }));
  }

  patchDefaults(change: Partial<{ visibility: GroupVisibility; defaultTab: GroupTab; chatEnabled: boolean; boardEnabled: boolean; chatHistory: ChatHistoryMode }>): void {
    this.draft.update((d) => ({ ...d, newGroupDefaults: { ...d.newGroupDefaults, ...change } }));
  }

  patchGrouping(change: Partial<EnsembleSettings['chatGrouping']>): void {
    this.draft.update((d) => ({ ...d, chatGrouping: { ...d.chatGrouping, ...change } }));
  }

  save(): void {
    if (!this.access.isEnsembleAdmin()) return;
    const d = this.draft();
    const grouping = { minComments: Math.max(2, d.chatGrouping.minComments || 3), windowMinutes: Math.max(1, d.chatGrouping.windowMinutes || 10) };
    this.settingsService.save({ ...d, name: d.name.trim() || 'Soubor', chatGrouping: grouping });
    this.audit.record({ action: 'settings-updated', actorId: this.access.memberId() ?? 0, groupIds: [] });
    this.feedback.run(of(null));
  }
}

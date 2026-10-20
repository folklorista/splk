import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MembersService } from '../members/members.service';
import { MandatesService } from '../mandates/mandates.service';
import { GroupsService } from '../groups/groups.service';
import { MembershipService, PersonInput } from '../groups/membership.service';
import { EventsService } from '../events/events.service';
import { AccessService } from '../../core/access/access.service';
import { accessOverview, groupRole, toAccessSubject } from '../../core/access/access.utils';
import { MANDATE_LABELS, Mandate, MandateKind, SCOPED_MANDATE_KINDS } from '../../core/models/mandate.model';
import { Member } from '../../core/models/member.model';
import { ActionFeedback } from '../../shared/ui/form-ui';

const GRANTABLE: MandateKind[] = ['ensemble-admin', 'events', 'attendance', 'costumes', 'costumes-view'];

const EMPTY_PERSON: PersonInput = { firstName: '', lastName: '', nickname: '', email: '', phone: '', functionTitle: '', isExternal: false };

// Správa → Členové → detail osoby: údaje, stav členství, skupiny, pověření a náhled skutečných přístupů.
// Změny členství se okamžitě promítnou i do detailu skupiny (sdílený živý stav).
import { CostumesService } from '../costumes/costumes.service';
import { defaultCostumeOf } from '../costumes/utils/costume-logic';
import { ConfirmOptions, ConfirmService } from '../../shared/dialog/confirm.service';
import { PersonDeletionService } from './person-deletion.service';
// Dotaz před ukončením / obnovením – externista není člen, proto „vyřadit z evidence“
export function personActiveQuestion(member: Pick<Member, 'nickname' | 'isExternal'>, active: boolean): ConfirmOptions {
  if (member.isExternal) {
    return active
      ? { title: `Vrátit ${member.nickname} do evidence externistů?`, confirmLabel: 'Vrátit do evidence' }
      : {
          title: `Vyřadit externistu ${member.nickname} z evidence?`,
          message: 'Zmizí z nabídek a přijde o případné skupiny a pověření. Historie i zápůjčky zůstanou.',
          confirmLabel: 'Vyřadit',
          danger: true,
        };
  }
  return active
    ? { title: `Obnovit aktivní členství – ${member.nickname}?`, confirmLabel: 'Obnovit členství' }
    : {
        title: `Ukončit aktivní členství – ${member.nickname}?`,
        message: 'Osoba se odhlásí ze všech skupin a přijde o pověření.',
        confirmLabel: 'Ukončit členství',
        danger: true,
      };
}

@Component({
  selector: 'app-manage-person',
  standalone: true,
  imports: [RouterLink, DatePipe],
  template: `
    <a class="back-link" routerLink="/app/manage/members">← Členové</a>

    @if (personId && !member()) {
      <p class="state-note">Osoba nebyla nalezena.</p>
    } @else {
      <div class="mp">
        <h2 class="mp__title">
          {{ personId ? member()!.nickname : 'Nová osoba' }}
          @if (member()?.isActive === false) { <span class="badge">bývalý člen</span> }
          @if (member()?.isExternal) { <span class="badge">externista</span> }
        </h2>

        @if (feedback.error()) { <p class="cs-error" role="alert">{{ feedback.error() }}</p> }
        @if (feedback.success()) { <p class="cs-success" role="status">{{ feedback.success() }}</p> }

        <details class="cs-panel" [open]="!personId">
          <summary>Osobní údaje</summary>
          <form class="cs-panel__body cs-form" (submit)="$event.preventDefault(); savePerson()">
            <div class="cs-form__row">
              <label class="cs-field"><span>Jméno *</span><input type="text" required [value]="draft().firstName" (input)="patch({ firstName: $any($event.target).value })" /></label>
              <label class="cs-field"><span>Příjmení</span><input type="text" [value]="draft().lastName" (input)="patch({ lastName: $any($event.target).value })" /></label>
              <label class="cs-field"><span>Přezdívka *</span><input type="text" required [value]="draft().nickname" (input)="patch({ nickname: $any($event.target).value })" /></label>
            </div>
            <div class="cs-form__row">
              <label class="cs-field"><span>E-mail</span><input type="email" [value]="draft().email ?? ''" (input)="patch({ email: $any($event.target).value })" /></label>
              <label class="cs-field"><span>Telefon</span><input type="tel" [value]="draft().phone ?? ''" (input)="patch({ phone: $any($event.target).value })" /></label>
            </div>
            <label class="cs-field">
              <span>Souborová funkce</span>
              <input type="text" placeholder="např. kronikářka, ekonomka" [value]="draft().functionTitle ?? ''" (input)="patch({ functionTitle: $any($event.target).value })" />
              <span class="cs-hint">Jen informativní – sama nic neopravňuje. Oprávnění dávají pověření níže.</span>
            </label>
            <label class="cs-field cs-field--inline">
              <input type="checkbox" [checked]="draft().isExternal" (change)="patch({ isExternal: $any($event.target).checked })" />
              Externista (není členem souboru – vidí jen akce, kam je pozván)
            </label>
            <div class="cs-form__actions">
              <button type="submit" class="cs-btn cs-btn--primary" [disabled]="feedback.busy() || !draft().firstName.trim() || !draft().nickname.trim()">
                {{ personId ? 'Uložit údaje' : 'Založit osobu' }}
              </button>
            </div>
          </form>
        </details>

        @if (member(); as m) {
          @if (costumeGenders().length) {
            <section class="mp__section">
              <h3 class="mp__heading">Kroje</h3>
              <label class="cs-field mp__costume">
                <span>Výchozí kroj</span>
                <select (change)="setDefaultCostume(m, $any($event.target).value)">
                  <option value="" [selected]="!defaultCostume()">neurčeno – nabízet vše</option>
                  @for (g of costumeGenders(); track g.id) { <option [value]="g.id" [selected]="g.id === defaultCostume()">{{ g.label }}</option> }
                </select>
                <span class="cs-hint">Krojařce se při vydávání nejdřív nabízejí kusy tohoto kroje. Jen preference, ne omezení.</span>
              </label>
            </section>
          }
          <section class="mp__section">
            <h3 class="mp__heading">Skupiny</h3>
            <ul class="mp__list">
              @for (row of groupRows(); track row.group.id) {
                <li class="mp__row">
                  <a class="cs-link mp__grow" [routerLink]="['/app/manage/groups', row.group.id]">{{ row.group.name }}</a>
                  @if (row.role === 'owner') { <span class="badge badge--pinned">hlavní správce</span> }
                  @if (row.role === 'deputy') { <span class="badge">spolusprávce</span> }
                  @if (!row.isMember) { <span class="badge">nečlen – jen technická správa</span> }
                  @if (row.isMember) {
                    <button type="button" class="cs-btn" (click)="removeFromGroup(m, row.group.id, row.group.name)">Odebrat</button>
                  }
                </li>
              } @empty {
                <li class="cs-muted">Bez skupiny.</li>
              }
            </ul>
            @if (m.isActive) {
              <label class="cs-field mp__inline">
                <span>Přidat do skupiny</span>
                <select (change)="addToGroup(m, $any($event.target))">
                  <option value="">Vyberte skupinu…</option>
                  @for (group of otherGroups(); track group.id) {
                    <option [value]="group.id">{{ group.name }}</option>
                  }
                </select>
                @if (m.id === me()) {
                  <span class="cs-hint">Sami sebe do skupiny nepřidáte – požádejte jejího správce (ochrana soukromí skupin).</span>
                }
              </label>
            }
          </section>

          <section class="mp__section">
            <h3 class="mp__heading">Pověření</h3>
            <ul class="mp__list">
              @for (mandate of mandates(); track mandate.id) {
                <li class="mp__row">
                  <span class="mp__grow">
                    <strong>{{ label(mandate.kind) }}</strong> <span class="cs-muted">{{ scopeLabel(mandate) }}</span>
                    @if (mandate.temporary) { <span class="badge">přechodně</span> }
                    <span class="cs-hint"> · od {{ mandate.grantedAt | date: 'd. M. yyyy' }}</span>
                  </span>
                  <button type="button" class="cs-btn" (click)="revoke(mandate)">Odebrat</button>
                </li>
              } @empty {
                <li class="cs-muted">Žádné pověření.</li>
              }
            </ul>
            @if (m.isActive) {
              <div class="cs-form__row">
                <label class="cs-field">
                  <span>Přidělit pověření</span>
                  <select (change)="grantKind.set($any($event.target).value)">
                    @for (kind of grantable; track kind) {
                      <option [value]="kind" [selected]="grantKind() === kind">{{ label(kind) }}</option>
                    }
                  </select>
                </label>
                @if (scoped()) {
                  <label class="cs-field">
                    <span>Rozsah</span>
                    <select (change)="grantScope.set($any($event.target).value)">
                      <option value="" [selected]="grantScope() === ''">Celý soubor</option>
                      <optgroup label="Akce pořádané skupinou">
                        @for (group of groups(); track group.id) {
                          <option [value]="'g' + group.id" [selected]="grantScope() === 'g' + group.id">{{ group.name }}</option>
                        }
                      </optgroup>
                      <optgroup label="Jedna akce">
                        @for (event of upcomingEvents(); track event.id) {
                          <option [value]="'e' + event.id" [selected]="grantScope() === 'e' + event.id">{{ event.title }} ({{ event.startsAt | date: 'd. M.' }})</option>
                        }
                      </optgroup>
                    </select>
                  </label>
                }
                <div class="cs-form__actions">
                  <button type="button" class="cs-btn cs-btn--primary" (click)="grant(m)">Přidělit</button>
                </div>
              </div>
              <p class="cs-hint">Správu skupin (hlavní správce, spolusprávce) určíte v detailu skupiny. Správa souboru sama nedává čtení soukromých skupin, správu akcí, docházky ani krojů.</p>
            }
          </section>

          <section class="mp__section mp__preview">
            <h3 class="mp__heading">Náhled skutečných přístupů</h3>
            @if (!m.isActive) {
              <p>Bývalý člen se nepřihlásí a nemá žádné přístupy. Historie, docházka i zápůjčky zůstávají.</p>
            } @else {
              <dl class="mp__dl">
                <dt>Čte chat a nástěnku</dt>
                <dd>{{ names(overview().readableGroupIds) || 'žádné skupiny' }}</dd>
                @if (overview().managedWithoutContentGroupIds.length) {
                  <dt>Spravuje bez přístupu k obsahu</dt>
                  <dd>{{ names(overview().managedWithoutContentGroupIds) }}</dd>
                }
                <dt>Správa souboru</dt>
                <dd>{{ overview().ensembleAdmin ? 'ano' : 'ne' }}</dd>
                <dt>Akce</dt>
                <dd>{{ scopeText(overview().events, 'zakládá a upravuje') }}</dd>
                <dt>Docházka</dt>
                <dd>{{ scopeText(overview().attendance, 'eviduje') }}</dd>
                <dt>Kroje</dt>
                <dd>{{ overview().costumes === 'manage' ? 'spravuje kroje' : overview().costumes === 'view' ? 'prohlíží správu krojů' : 'jen vlastní kroje' }}</dd>
              </dl>
            }
          </section>

          <section class="mp__section">
            @if (m.isExternal) {
              <!-- Externista není členem souboru – nemá co „ukončit“, jen se vyřadí z evidence -->
              <h3 class="mp__heading">Evidence externisty</h3>
              @if (m.isActive) {
                <p class="cs-hint">Externista není členem souboru. Vyřazení ho skryje z nabídek (výdej krojů, hosté akcí) a odebere případné skupiny a pověření. Jeho historie i zápůjčky v evidenci zůstanou.</p>
                <button type="button" class="cs-btn cs-btn--danger" (click)="setActive(m, false)">Vyřadit z evidence</button>
              } @else {
                <p class="cs-hint">Vyřazený externista – v nabídkách se nezobrazuje.</p>
                <button type="button" class="cs-btn" (click)="setActive(m, true)">Vrátit do evidence</button>
              }
            } @else {
              <h3 class="mp__heading">Členství v souboru</h3>
              @if (m.isActive) {
                <p class="cs-hint">Ukončení odebere skupiny a pověření. Osoba, její historie, docházka i zápůjčky v evidenci zůstanou.</p>
                <button type="button" class="cs-btn cs-btn--danger" (click)="setActive(m, false)">Ukončit aktivní členství</button>
              } @else {
                <button type="button" class="cs-btn" (click)="setActive(m, true)">Obnovit aktivní členství</button>
              }
            }
          </section>

          <section class="mp__section">
            <h3 class="mp__heading">Trvalé smazání</h3>
            @let blockers = deletionBlockers(m.id);
            @if (blockers.length) {
              <p class="cs-hint">Osobu nelze smazat, protože:</p>
              <ul class="mp__blockers">
                @for (reason of blockers; track reason) { <li>{{ reason }}</li> }
              </ul>
              <p class="cs-hint">{{ m.isExternal ? 'Externistu můžete vyřadit z evidence.' : 'Můžete ukončit její aktivní členství.' }} Historie a zápůjčky tak zůstanou zachované.</p>
            } @else {
              <p class="cs-hint">Jen pro osobu založenou omylem – nemá žádné odpovědi, docházku, obsah ani záznamy v krojích. Smazání nelze vrátit.</p>
              <button type="button" class="cs-btn cs-btn--danger" (click)="deletePerson(m)">Smazat osobu trvale</button>
            }
          </section>
        }
      </div>
    }
  `,
  styles: [
    `
      .mp { display: flex; flex-direction: column; gap: var(--spacing-md); }
      .mp__title { font-size: var(--font-size-lg); display: flex; gap: var(--spacing-sm); align-items: center; flex-wrap: wrap; }
      .mp__section { display: flex; flex-direction: column; gap: var(--spacing-sm); }
      .mp__blockers { margin: 0 0 var(--spacing-xs) var(--spacing-lg); font-size: var(--font-size-sm); color: var(--color-text); }
      .mp__heading { font-size: var(--font-size-xs); font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-text-muted); }
      .mp__list { list-style: none; display: flex; flex-direction: column; }
      .mp__row { display: flex; align-items: center; gap: var(--spacing-sm); padding: 6px 0; border-bottom: 1px solid var(--color-border); font-size: var(--font-size-sm); flex-wrap: wrap; }
      .mp__grow { flex: 1; min-width: 160px; }
      .mp__inline { max-width: 360px; }
      .mp__preview { padding: var(--spacing-md); border-radius: var(--radius-md); background: var(--color-surface-alt); border: 1px solid var(--color-border); }
      .mp__dl { display: grid; grid-template-columns: max-content 1fr; gap: 4px var(--spacing-md); font-size: var(--font-size-sm); }
      .mp__dl dt { color: var(--color-text-muted); }
      @media (max-width: 480px) { .mp__dl { grid-template-columns: 1fr; } .mp__dl dd { margin-bottom: 6px; } }
    `,
  ],
})
export class ManagePersonComponent {
  private readonly confirmDialog = inject(ConfirmService);
  private readonly deletion = inject(PersonDeletionService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private membersService = inject(MembersService);
  private mandatesService = inject(MandatesService);
  private groupsService = inject(GroupsService);
  private membership = inject(MembershipService);
  private accessService = inject(AccessService);
  private events = toSignal(inject(EventsService).getEvents(), { initialValue: [] });
  private costumes = inject(CostumesService);
  private costumeState = toSignal(this.costumes.state$);
  // Výchozí kroj osoby (docs/06 kap. 5.1a) – jen se zapnutým modulem Kroje
  readonly costumeGenders = computed(() => (this.accessService.modules().costumes ? (this.costumeState()?.classification.genders ?? []) : []));
  readonly defaultCostume = computed(() => {
    const state = this.costumeState();
    return state && this.personId ? defaultCostumeOf(state, { kind: 'member', memberId: this.personId }) : undefined;
  });

  readonly feedback = new ActionFeedback();
  readonly grantable = GRANTABLE;
  readonly personId = Number(this.route.snapshot.paramMap.get('id')) || null;
  readonly me = this.accessService.memberId;
  readonly groups = this.groupsService.groups;

  readonly member = computed(() => this.membersService.members().find((m) => m.id === this.personId));

  readonly draft = linkedSignal<PersonInput>(() => {
    const m = this.member();
    return m
      ? { firstName: m.firstName, lastName: m.lastName, nickname: m.nickname, email: m.email ?? '', phone: m.phone ?? '', functionTitle: m.functionTitle ?? '', isExternal: !!m.isExternal }
      : { ...EMPTY_PERSON };
  });

  readonly mandates = computed(() => this.mandatesService.mandates().filter((m) => m.memberId === this.personId));
  private subject = computed(() => {
    const m = this.member();
    return m ? toAccessSubject(m, this.mandatesService.mandates()) : null;
  });
  readonly overview = computed(() => accessOverview(this.subject(), this.groups()));

  // Skupiny, kde je členem nebo je spravuje (i bez členství)
  readonly groupRows = computed(() => {
    const m = this.member();
    if (!m) return [];
    return this.groups()
      .map((group) => ({ group, isMember: m.groupIds.includes(group.id), role: groupRole(this.subject(), group.id) }))
      .filter((row) => row.isMember || row.role);
  });

  readonly otherGroups = computed(() => this.groups().filter((g) => !this.member()?.groupIds.includes(g.id)));

  readonly upcomingEvents = computed(() => {
    const now = new Date().toISOString();
    return this.events().filter((e) => e.endsAt >= now).sort((a, b) => a.startsAt.localeCompare(b.startsAt)).slice(0, 40);
  });

  readonly grantKind = signal<MandateKind>('events');
  readonly grantScope = signal('');
  readonly scoped = computed(() => SCOPED_MANDATE_KINDS.includes(this.grantKind()));

  label(kind: MandateKind): string {
    return MANDATE_LABELS[kind];
  }

  scopeLabel(mandate: Mandate): string {
    if (mandate.groupId) {
      const name = this.groupsService.findGroup(mandate.groupId)?.name ?? 'skupina';
      return mandate.kind.startsWith('group-') ? name : `akce skupiny ${name}`;
    }
    if (mandate.eventId) return `akce ${this.events().find((e) => e.id === mandate.eventId)?.title ?? '#' + mandate.eventId}`;
    return SCOPED_MANDATE_KINDS.includes(mandate.kind) ? 'celý soubor' : '';
  }

  scopeText(scope: 'none' | 'ensemble' | 'scoped', verb: string): string {
    return scope === 'ensemble' ? `${verb} – celý soubor` : scope === 'scoped' ? `${verb} – vybrané skupiny/akce` : 'ne';
  }

  names(ids: number[]): string {
    return ids.map((id) => this.groupsService.findGroup(id)?.name).filter(Boolean).join(', ');
  }

  patch(change: Partial<PersonInput>): void {
    this.draft.update((d) => ({ ...d, ...change }));
  }

  savePerson(): void {
    const d = this.draft();
    const input: PersonInput = {
      firstName: d.firstName.trim(),
      lastName: d.lastName.trim(),
      nickname: d.nickname.trim(),
      email: d.email?.trim() || undefined,
      phone: d.phone?.trim() || undefined,
      functionTitle: d.functionTitle?.trim() || undefined,
      isExternal: d.isExternal || undefined,
    };
    if (this.personId) {
      this.feedback.run(this.membership.updatePerson(this.personId, input));
    } else {
      this.feedback.run(this.membership.createPerson(input), (m) => this.router.navigate(['/app/manage/members', m.id]), 'Osoba založena');
    }
  }

  setDefaultCostume(member: Member, genderId: string): void {
    this.feedback.run(this.costumes.setDefaultCostume({ kind: 'member', memberId: member.id }, genderId || undefined), undefined, 'Výchozí kroj uložen');
  }

  addToGroup(member: Member, select: HTMLSelectElement): void {
    const groupId = Number(select.value);
    select.value = '';
    if (groupId) this.feedback.run(this.membership.addMember(groupId, member.id), undefined, 'Přidáno do skupiny');
  }

  removeFromGroup(member: Member, groupId: number, groupName: string): void {
    const note = prompt(`Odebrat ${member.nickname} ze skupiny ${groupName}? Případný důvod zůstane jen v historii správy (nepovinné):`, '');
    if (note === null) return;
    this.feedback.run(this.membership.removeMember(groupId, member.id, note.trim() || undefined), undefined, 'Odebráno ze skupiny');
  }

  grant(member: Member): void {
    const scope = this.scoped() ? this.grantScope() : '';
    const target = scope.startsWith('g') ? { groupId: Number(scope.slice(1)) } : scope.startsWith('e') ? { eventId: Number(scope.slice(1)) } : {};
    this.feedback.run(this.membership.grantMandate(member.id, this.grantKind(), target), undefined, 'Pověření přiděleno');
  }

  async revoke(mandate: Mandate): Promise<void> {
    const ok = await this.confirmDialog.confirm({
      title: `Odebrat pověření ${this.label(mandate.kind)}?`,
      confirmLabel: 'Odebrat',
      danger: true,
    });
    if (!ok) return;
    this.feedback.run(this.membership.revokeMandate(mandate.id), undefined, 'Pověření odebráno');
  }

  deletionBlockers(memberId: number): string[] {
    return this.deletion.blockers(memberId);
  }

  async deletePerson(member: Member): Promise<void> {
    const ok = await this.confirmDialog.confirm({
      title: `Trvale smazat osobu ${member.nickname}?`,
      message: 'Osoba zmizí z evidence včetně skupin a pověření. Smazání nelze vrátit.',
      confirmLabel: 'Smazat trvale',
      danger: true,
    });
    if (!ok) return;
    this.feedback.run(this.deletion.deletePerson(member.id), () => this.router.navigate(['/app/manage/members']), 'Osoba smazána');
  }

  async setActive(member: Member, active: boolean): Promise<void> {
    const ok = await this.confirmDialog.confirm(personActiveQuestion(member, active));
    if (!ok) return;
    const done = member.isExternal ? (active ? 'Externista vrácen do evidence' : 'Externista vyřazen z evidence') : active ? 'Členství obnoveno' : 'Členství ukončeno';
    this.feedback.run(this.membership.setPersonActive(member.id, active), undefined, done);
  }
}

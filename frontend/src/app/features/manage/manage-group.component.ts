import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { GroupsService } from '../groups/groups.service';
import { MembersService } from '../members/members.service';
import { MembershipService } from '../groups/membership.service';
import { EnsembleSettingsService } from '../ensemble/ensemble-settings.service';
import { AccessService } from '../../core/access/access.service';
import { canDeleteGroup, canReadGroupContent } from '../../core/access/access.utils';
import { GroupAdminPanelComponent } from '../groups/group-admin/group-admin-panel.component';
import { GROUP_ICON_OPTIONS, IconComponent, IconName } from '../../shared/icon/icon.component';
import { ActionFeedback } from '../../shared/ui/form-ui';
import { ConfirmService } from '../../shared/dialog/confirm.service';

// Diakritiku pryč, mezery na pomlčky – návrh slugu z názvu
export function slugify(name: string): string {
  return name.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Správa → Skupiny → detail (nebo založení nové skupiny)
@Component({
  selector: 'app-manage-group',
  standalone: true,
  imports: [RouterLink, GroupAdminPanelComponent, IconComponent],
  template: `
    <a class="back-link" routerLink="/app/manage/groups">← Skupiny</a>

    @if (isNew) {
      <h2 class="mg__title">Nová skupina</h2>
      <form class="cs-form mg__form" (submit)="$event.preventDefault(); create()">
        <div class="cs-form__row">
          <label class="cs-field"><span>Název *</span><input type="text" required [value]="name()" (input)="setName($any($event.target).value)" /></label>
          <label class="cs-field"><span>Slug *</span><input type="text" required [value]="slug()" (input)="slug.set($any($event.target).value)" /></label>
        </div>
        <div class="cs-field">
          <span class="cs-field__label">Ikona</span>
          <div class="mg__icons">
            @for (option of iconOptions; track option) {
              <button type="button" class="mg__icon" [class.mg__icon--active]="icon() === option" [attr.aria-label]="option" (click)="icon.set(option)">
                <app-icon [name]="option" [size]="18" />
              </button>
            }
          </div>
        </div>
        @if (isAdmin()) {
          <label class="cs-field">
            <span>Hlavní správce</span>
            <select (change)="ownerId.set(+$any($event.target).value || null)">
              <option value="">Zatím já (přechodně, bez přístupu k obsahu)</option>
              @for (person of people(); track person.id) {
                <option [value]="person.id">{{ person.nickname }}</option>
              }
            </select>
            <span class="cs-hint">Hlavní správce pak sám přidá členy a spolusprávce. Zda bude správce i členem, rozhodne přidáním.</span>
          </label>
        } @else {
          <p class="cs-hint">Stanete se členem a hlavním správcem nové skupiny.</p>
        }
        <p class="cs-hint">Výchozí nastavení: {{ defaultsText() }}. Změníte ho po založení.</p>
        @if (feedback.error()) { <p class="cs-error" role="alert">{{ feedback.error() }}</p> }
        <div class="cs-form__actions">
          <button type="submit" class="cs-btn cs-btn--primary" [disabled]="feedback.busy() || !name().trim() || !slug().trim()">Založit skupinu</button>
        </div>
      </form>
    } @else if (group()) {
      @let g = group()!;
      <div class="mg__header">
        <h2 class="mg__title">
          @if (g.icon) { <app-icon [name]="g.icon" [size]="20" /> }
          {{ g.name }}
        </h2>
        @if (canRead()) {
          <a class="cs-btn" [routerLink]="['/app/boards', g.slug]">Otevřít skupinu</a>
        }
      </div>
      @if (!canRead()) {
        <p class="cs-hint">Skupinu spravujete technicky. Její chat a nástěnku nevidíte – nejste jejím členem.</p>
      }
      <app-group-admin-panel [groupId]="g.id" [openSettings]="true" />
      @if (canDelete()) {
        <div class="mg__danger">
          @if (feedback.error()) { <p class="cs-error" role="alert">{{ feedback.error() }}</p> }
          <button type="button" class="cs-btn cs-btn--danger" (click)="remove(g.id, g.name)">Smazat skupinu</button>
          <span class="cs-hint">Smazání je nevratné: odstraní příspěvky, komentáře a chat skupiny a členové o ni přijdou. Akce, docházka a krojová evidence zůstanou.</span>
        </div>
      }
    } @else {
      <p class="state-note">Skupina nebyla nalezena.</p>
    }
  `,
  styles: [
    `
      .mg__header { display: flex; align-items: center; justify-content: space-between; gap: var(--spacing-sm); flex-wrap: wrap; margin-bottom: var(--spacing-sm); }
      .mg__title { font-size: var(--font-size-lg); display: flex; align-items: center; gap: var(--spacing-sm); margin-bottom: var(--spacing-sm); }
      .mg__form { max-width: 560px; }
      .mg__icons { display: flex; flex-wrap: wrap; gap: 4px; }
      .mg__icon { width: 36px; height: 36px; display: grid; place-items: center; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); color: var(--color-text); }
      .mg__icon--active { border-color: var(--color-primary); color: var(--color-primary); }
      .mg__danger { margin-top: var(--spacing-xl); padding-top: var(--spacing-md); border-top: 1px solid var(--color-border); display: flex; flex-direction: column; gap: var(--spacing-sm); align-items: flex-start; }
    `,
  ],
})
export class ManageGroupComponent {
  private readonly confirmDialog = inject(ConfirmService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private groupsService = inject(GroupsService);
  private membersService = inject(MembersService);
  private membership = inject(MembershipService);
  private settings = inject(EnsembleSettingsService).settings;
  private access = inject(AccessService);

  readonly feedback = new ActionFeedback();
  readonly isNew = this.route.snapshot.paramMap.get('id') === null;
  private groupId = Number(this.route.snapshot.paramMap.get('id'));
  readonly group = computed(() => this.groupsService.groups().find((g) => g.id === this.groupId));
  readonly canRead = computed(() => !!this.group() && canReadGroupContent(this.access.subject(), this.group()!));
  readonly canDelete = computed(() => canDeleteGroup(this.access.subject(), this.group()));
  readonly isAdmin = this.access.isEnsembleAdmin;

  readonly iconOptions = GROUP_ICON_OPTIONS;
  readonly name = signal('');
  readonly slug = signal('');
  readonly icon = signal<IconName>('users');
  readonly ownerId = signal<number | null>(null);
  readonly people = computed(() =>
    this.membersService.members().filter((m) => m.isActive && !m.isExternal).sort((a, b) => a.nickname.localeCompare(b.nickname, 'cs')),
  );

  readonly defaultsText = computed(() => {
    const d = this.settings().newGroupDefaults;
    const parts = [d.visibility === 'open' ? 'otevřená' : d.visibility === 'hidden' ? 'skrytá' : 'soukromá', d.chatEnabled ? 'chat' : '', d.boardEnabled ? 'nástěnka' : ''];
    return parts.filter(Boolean).join(', ');
  });

  setName(value: string): void {
    // Slug se dopočítává, dokud ho uživatel neupraví ručně
    if (this.slug() === slugify(this.name())) this.slug.set(slugify(value));
    this.name.set(value);
  }

  create(): void {
    const d = this.settings().newGroupDefaults;
    this.feedback.run(
      this.membership.createGroup(
        { name: this.name().trim(), slug: slugify(this.slug()), icon: this.icon(), visibility: d.visibility, chatEnabled: d.chatEnabled, boardEnabled: d.boardEnabled, defaultTab: d.defaultTab, chatHistory: d.chatHistory ?? 'open' },
        this.ownerId() ?? undefined,
      ),
      (group) => this.router.navigate(['/app/manage/groups', group.id]),
    );
  }

  async remove(id: number, name: string): Promise<void> {
    const ok = await this.confirmDialog.confirm({
      title: `Smazat skupinu ${name}?`,
      message: 'Archivovaná skupina se nevratně smaže včetně příspěvků a chatu.',
      confirmLabel: 'Smazat nevratně',
      danger: true,
    });
    if (!ok) return;
    this.feedback.run(this.membership.deleteGroup(id), () => this.router.navigate(['/app/manage/groups']));
  }
}

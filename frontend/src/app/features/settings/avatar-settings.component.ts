import { Component, computed, inject, signal } from '@angular/core';
import { AccessService } from '../../core/access/access.service';
import { MembersService } from '../members/members.service';
import { AVATAR_COLORS, AVATAR_ICONS, AvatarComponent, defaultAvatarColor } from '../../shared/avatar/avatar.component';
import { IconComponent, IconName } from '../../shared/icon/icon.component';
import { MemberAvatar } from '../../core/models/member.model';

// Nastavení → Profilová ikonka: vidí ji ostatní v seznamech členů. Výchozí jsou iniciály.
@Component({
  selector: 'app-avatar-settings',
  standalone: true,
  imports: [AvatarComponent, IconComponent],
  template: `
    @if (member(); as m) {
      <section class="settings__section">
        <h2 class="settings__title">Profilová ikonka</h2>
        <p class="settings__hint">Uvidí ji ostatní členové v seznamech. Bez volby se zobrazují vaše iniciály.</p>
        <div class="av__preview">
          <app-avatar [name]="m.nickname" [memberId]="m.id" [avatar]="draft()" [size]="56" />
          <button type="button" class="cs-btn" [disabled]="!m.avatar && !draft()" (click)="save(undefined)">Použít iniciály</button>
        </div>
        <div class="av__grid" role="radiogroup" aria-label="Ikona">
          @for (icon of icons; track icon) {
            <button type="button" class="av__option" role="radio" [attr.aria-checked]="draft()?.icon === icon" [class.av__option--active]="draft()?.icon === icon" (click)="save({ icon, color: color() })">
              <app-icon [name]="icon" [size]="20" />
            </button>
          }
        </div>
        <div class="av__colors" role="radiogroup" aria-label="Barva">
          @for (c of colors; track c) {
            <button type="button" class="av__color" role="radio" [attr.aria-checked]="color() === c" [class.av__color--active]="color() === c" [style.background]="c" (click)="setColor(c)" [attr.aria-label]="'Barva ' + c"></button>
          }
        </div>
        @if (error()) { <p class="cs-error" role="alert">{{ error() }}</p> }
      </section>
    }
  `,
  styles: [`
    .av__preview { display: flex; align-items: center; gap: var(--spacing-md); margin: var(--spacing-sm) 0; }
    .av__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(44px, 1fr)); gap: 6px; margin-bottom: var(--spacing-sm); }
    .av__option { height: 44px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); color: var(--color-text); cursor: pointer; display: flex; align-items: center; justify-content: center; }
    .av__option--active { border-color: var(--color-primary); color: var(--color-primary); box-shadow: 0 0 0 2px var(--color-primary) inset; }
    .av__colors { display: flex; flex-wrap: wrap; gap: 8px; }
    .av__color { width: 32px; height: 32px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; }
    .av__color--active { border-color: var(--color-text); }
  `],
})
export class AvatarSettingsComponent {
  private access = inject(AccessService);
  private membersService = inject(MembersService);
  readonly icons = AVATAR_ICONS;
  readonly colors = AVATAR_COLORS;
  readonly error = signal('');
  readonly member = this.access.currentMember;
  readonly draft = computed(() => this.member()?.avatar);
  readonly color = computed(() => this.draft()?.color ?? defaultAvatarColor(this.member()?.id ?? 0));

  setColor(color: string): void {
    const icon: IconName | undefined = this.draft()?.icon;
    this.save(icon ? { icon, color } : { icon: AVATAR_ICONS[0], color });
  }

  save(avatar: MemberAvatar | undefined): void {
    const m = this.member();
    if (!m) return;
    this.error.set('');
    const { id, ...rest } = m;
    this.membersService.updateMember(id, { ...rest, avatar }).subscribe({ error: () => this.error.set('Ikonku se nepodařilo uložit.') });
  }
}

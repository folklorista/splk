import { Component, computed, input } from '@angular/core';
import { IconComponent, IconName } from '../icon/icon.component';
import { MemberAvatar } from '../../core/models/member.model';

// Paleta a ikony, ze kterých si člen vybírá profilovou ikonku (Nastavení → Profilová ikonka)
export const AVATAR_COLORS = ['#c0392b', '#d35400', '#b7950b', '#27ae60', '#16a085', '#2980b9', '#8e44ad', '#7f8c8d'];
export const AVATAR_ICONS: IconName[] = ['person-adult', 'person-child', 'footprints', 'music-note', 'drum', 'crown', 'heart', 'star', 'flag', 'mask', 'tent', 'compass', 'shirt', 'shield'];

export function defaultAvatarColor(id: number): string {
  return AVATAR_COLORS[Math.abs(id) % AVATAR_COLORS.length];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

// Profilová ikonka člena: vlastní ikona na zvolené barvě, jinak iniciály (placeholder)
@Component({
  selector: 'app-avatar',
  standalone: true,
  imports: [IconComponent],
  template: `
    <span class="avatar" [style.width.px]="size()" [style.height.px]="size()" [style.background]="color()" [style.font-size.px]="size() * 0.4" aria-hidden="true">
      @if (avatar()?.icon; as icon) {
        <app-icon [name]="icon" [size]="size() * 0.55" />
      } @else {
        {{ letters() }}
      }
    </span>
  `,
  styles: [`.avatar { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; border-radius: 50%; color: #fff; font-weight: 700; line-height: 1; } .avatar ::ng-deep .icon { color: #fff; }`],
})
export class AvatarComponent {
  readonly name = input('');
  readonly memberId = input(0);
  readonly avatar = input<MemberAvatar | undefined>(undefined);
  readonly size = input(40);
  readonly color = computed(() => this.avatar()?.color ?? defaultAvatarColor(this.memberId()));
  readonly letters = computed(() => initials(this.name()));
}

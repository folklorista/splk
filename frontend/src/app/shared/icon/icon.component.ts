import { Component, Input } from '@angular/core';

export type IconName =
  | 'calendar'
  | 'clock'
  | 'location'
  | 'star'
  | 'users'
  | 'home'
  | 'megaphone'
  | 'shirt'
  | 'user'
  | 'settings'
  | 'mail'
  | 'phone'
  | 'arrow-start'
  | 'arrow-end'
  | 'plus-circle'
  | 'save'
  | 'person-adult'
  | 'person-child'
  | 'footprints'
  | 'music-note'
  | 'crown'
  | 'flag'
  | 'shield'
  | 'heart'
  | 'tent'
  | 'compass'
  | 'drum'
  | 'mask';

// Sada ikon nabízených při výběru ikony skupiny (app/admin/groups)
export const GROUP_ICON_OPTIONS: IconName[] = [
  'person-adult',
  'person-child',
  'footprints',
  'music-note',
  'crown',
  'users',
  'shirt',
  'flag',
  'shield',
  'heart',
  'tent',
  'compass',
  'drum',
  'mask',
  'star',
];

@Component({
  selector: 'app-icon',
  standalone: true,
  template: `
    <svg
      class="icon"
      [attr.width]="size"
      [attr.height]="size"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      @switch (name) {
        @case ('calendar') {
          <rect x="3" y="4.5" width="18" height="16" rx="2" />
          <line x1="3" y1="9.5" x2="21" y2="9.5" />
          <line x1="8" y1="2.5" x2="8" y2="6.5" />
          <line x1="16" y1="2.5" x2="16" y2="6.5" />
        }
        @case ('clock') {
          <circle cx="12" cy="12" r="9" />
          <polyline points="12 7 12 12 15.5 14" />
        }
        @case ('location') {
          <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" />
          <circle cx="12" cy="9.5" r="2.3" />
        }
        @case ('star') {
          <polygon points="12 2.5 15 9 22 10 17 15 18.2 21.5 12 18.3 5.8 21.5 7 15 2 10 9 9" />
        }
        @case ('users') {
          <circle cx="9" cy="8" r="3" />
          <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
          <circle cx="17" cy="9" r="2.5" />
          <path d="M15.5 14.2c2.5.4 4.5 2.5 4.5 5.8" />
        }
        @case ('home') {
          <path d="M4 11 12 4l8 7" />
          <path d="M6 9.5V20h12V9.5" />
        }
        @case ('megaphone') {
          <path d="M3 10v4h3l6 4V6l-6 4H3Z" />
          <path d="M15 9a4.2 4.2 0 0 1 0 6" />
        }
        @case ('shirt') {
          <path d="M8 4 4 7l2 3 2-1.3V20h8V8.7L18 10l2-3-4-3-2 2h-4Z" />
        }
        @case ('user') {
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20c0-4 3-6.5 7-6.5s7 2.5 7 6.5" />
        }
        @case ('settings') {
          <line x1="4" y1="6" x2="20" y2="6" />
          <circle cx="9" cy="6" r="2" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <circle cx="15" cy="12" r="2" />
          <line x1="4" y1="18" x2="20" y2="18" />
          <circle cx="9" cy="18" r="2" />
        }
        @case ('mail') {
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <polyline points="3 7 12 13 21 7" />
        }
        @case ('phone') {
          <path d="M6 3h3l1.5 4.5-2 1.5a12 12 0 0 0 6 6l1.5-2 4.5 1.5v3a2 2 0 0 1-2 2C11 19.5 4.5 13 4 6a2 2 0 0 1 2-3Z" />
        }
        @case ('arrow-start') {
          <line x1="5" y1="4" x2="5" y2="20" />
          <line x1="9" y1="12" x2="19" y2="12" />
          <polyline points="14 7 19 12 14 17" />
        }
        @case ('arrow-end') {
          <line x1="5" y1="12" x2="15" y2="12" />
          <polyline points="10 7 15 12 10 17" />
          <line x1="19" y1="4" x2="19" y2="20" />
        }
        @case ('plus-circle') {
          <circle cx="12" cy="12" r="9" />
          <line x1="12" y1="8" x2="12" y2="16" />
          <line x1="8" y1="12" x2="16" y2="12" />
        }
        @case ('save') {
          <path d="M5 3h11l3 3v15H5V3Z" />
          <path d="M8 3v6h8V3" />
          <path d="M7 21v-7h10v7" />
        }
        @case ('person-adult') {
          <circle cx="12" cy="5" r="2.5" />
          <path d="M12 8v7" />
          <path d="M8 11h8" />
          <path d="M12 15l-3 6M12 15l3 6" />
        }
        @case ('person-child') {
          <circle cx="12" cy="7" r="3.2" />
          <path d="M12 10.2v5" />
          <path d="M9.3 12.2h5.4" />
          <path d="M12 15.2l-2.3 4M12 15.2l2.3 4" />
        }
        @case ('footprints') {
          <ellipse cx="8" cy="7.5" rx="2.2" ry="3.3" transform="rotate(-12 8 7.5)" />
          <ellipse cx="16" cy="15.5" rx="2.2" ry="3.3" transform="rotate(12 16 15.5)" />
        }
        @case ('music-note') {
          <circle cx="8" cy="17" r="2.5" />
          <circle cx="17" cy="15" r="2.5" />
          <path d="M10.5 17V5.5L19.5 4v11" />
          <path d="M10.5 8.5l9-1.5" />
        }
        @case ('crown') {
          <path d="M4 17h16" />
          <path d="M4 17l1.5-8 4 4 2.5-6 2.5 6 4-4L20 17Z" />
        }
        @case ('flag') {
          <line x1="5" y1="3" x2="5" y2="21" />
          <path d="M5 4h13l-3.5 4L18 12H5Z" />
        }
        @case ('shield') {
          <path d="M12 3l7 3v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6l7-3Z" />
        }
        @case ('heart') {
          <path d="M12 20s-7-4.5-9.5-9C.7 7.5 2.5 4 6 4c2 0 3.5 1.2 4 2.8.5-1.6 2-2.8 4-2.8 3.5 0 5.3 3.5 3.5 7-2.5 4.5-9.5 9-9.5 9Z" />
        }
        @case ('tent') {
          <path d="M3 19 12 5l9 14Z" />
          <path d="M9.5 19 12 12l2.5 7" />
        }
        @case ('compass') {
          <circle cx="12" cy="12" r="9" />
          <polygon points="14.5 9.5 13 13 9.5 14.5 11 11 14.5 9.5" />
        }
        @case ('drum') {
          <ellipse cx="12" cy="7" rx="7" ry="3" />
          <path d="M5 7v9a7 3 0 0 0 14 0V7" />
          <line x1="5" y1="7" x2="3" y2="18" />
          <line x1="19" y1="7" x2="21" y2="18" />
        }
        @case ('mask') {
          <path d="M4 10c0-4 3.5-7 8-7s8 3 8 7c0 6-3 11-8 11S4 16 4 10Z" />
          <circle cx="9" cy="10" r="1.3" />
          <circle cx="15" cy="10" r="1.3" />
          <path d="M9 15c1 1 5 1 6 0" />
        }
      }
    </svg>
  `,
  styles: [`
    :host {
      display: inline-flex;
      vertical-align: middle;
    }
  `],
})
export class IconComponent {
  @Input() name!: IconName;
  @Input() size = 16;
}

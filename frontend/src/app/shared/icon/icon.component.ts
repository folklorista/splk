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
  | 'phone';

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

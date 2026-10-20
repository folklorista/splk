import { Component, Input } from '@angular/core';
import { STITCH_CELL, STITCH_SIZE, STITCH_STROKE } from './stitch-icons.data';
import { StitchPath, stitchIcon } from './stitch-icons';

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
  | 'mask'
  | 'close'
  | 'search'
  | 'comment'
  | 'clipboard-check'
  | 'menu'
  | 'hanger'
  | 'download'
  | 'sidebar'
  | 'logout'
  | 'bell'
  | 'calendar-download'
  | 'check'
  | 'info'
  | 'link'
  | 'pencil'
  | 'repeat'
  | 'back'
  | 'plus'
  | 'manage'
  | 'question';

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

// Křížková ikona Vonica: mřížka 12×12 stehů (stitch-icons.data.ts, generuje scripts/generate-stitch-icons.mjs).
// Nit 1 bere barvu textu (currentColor), nit 2 je folklorní červená (--stitch-accent) –
// aktivní/neaktivní/disabled stav řídí barva a průhlednost rodiče.
@Component({
  selector: 'app-icon',
  standalone: true,
  template: `
    <svg
      class="icon"
      [attr.width]="size"
      [attr.height]="size"
      [attr.viewBox]="viewBox"
      fill="none"
      [attr.stroke-width]="stroke"
      stroke-linecap="round"
      aria-hidden="true"
    >
      @for (p of paths; track $index) {
        <path [attr.d]="p.d" [attr.stroke]="p.color" />
      }
    </svg>
  `,
  styles: [`
    :host {
      display: inline-flex;
      vertical-align: middle;
      flex-shrink: 0;
    }
  `],
})
export class IconComponent {
  @Input() name!: IconName;
  // Kresba 12×12 je čitelná od 16 px, doporučeně 20–24 px
  @Input() size = 20;

  readonly viewBox = `0 0 ${STITCH_SIZE * STITCH_CELL} ${STITCH_SIZE * STITCH_CELL}`;
  readonly stroke = STITCH_STROKE;

  get paths(): StitchPath[] {
    return stitchIcon(this.name);
  }
}

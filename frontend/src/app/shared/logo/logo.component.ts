import { Component, Input } from '@angular/core';

export type LogoVariant = 'full' | 'mark';

// Souborové logo Vonica. Obě barevné varianty jsou v DOM, CSS podle data-theme ukáže tu,
// která je čitelná na pozadí (černý nápis ve světlém režimu, krémový v tmavém).
@Component({
  selector: 'app-logo',
  standalone: true,
  template: `
    <img class="logo__img logo__img--light" [src]="src('')" [alt]="alt" [style.height.px]="height" />
    <img class="logo__img logo__img--dark" [src]="src('-dark')" alt="" aria-hidden="true" [style.height.px]="height" />
  `,
  host: { class: 'logo' },
})
export class LogoComponent {
  @Input() variant: LogoVariant = 'full';
  @Input() height = 36;
  @Input() alt = 'Vonica – folklorní soubor';

  src(suffix: string): string {
    return `identity/vonica-${this.variant === 'mark' ? 'mark' : 'logo'}${suffix}.svg`;
  }
}

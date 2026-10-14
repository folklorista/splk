import { Component } from '@angular/core';
import { DemoDataService } from '../../services/demo-data.service';

@Component({
  selector: 'app-demo-banner',
  standalone: true,
  template: `
    <div class="demo-banner" role="note">
      <span><strong>Demo verze</strong> – změny vidíš jen ty v tomto prohlížeči, ostatní je neuvidí.</span>
      <button type="button" class="demo-banner__reset" (click)="reset()">Obnovit demo data</button>
    </div>
  `,
})
export class DemoBannerComponent {
  constructor(private demoData: DemoDataService) {}

  reset(): void {
    if (confirm('Zahodit všechny tvoje změny a obnovit výchozí demo data?')) {
      this.demoData.reset();
    }
  }
}

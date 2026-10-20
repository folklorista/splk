import { Component, inject } from '@angular/core';
import { DemoDataService } from '../../services/demo-data.service';
import { ConfirmService } from '../../../shared/dialog/confirm.service';

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
  private readonly confirmDialog = inject(ConfirmService);
  constructor(private demoData: DemoDataService) {}

  async reset(): Promise<void> {
    const ok = await this.confirmDialog.confirm({
      title: 'Obnovit demo data?',
      message: 'Zahodí všechny tvoje změny a obnoví výchozí demo data.',
      confirmLabel: 'Obnovit',
      danger: true,
    });
    if (ok) this.demoData.reset();
  }
}

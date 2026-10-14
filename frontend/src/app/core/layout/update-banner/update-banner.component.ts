import { Component } from '@angular/core';
import { AppUpdateService } from '../../services/app-update.service';

@Component({
  selector: 'app-update-banner',
  standalone: true,
  template: `
    @if (updates.updateReady()) {
      <div class="update-banner" role="status">
        <span>Je dostupná nová verze aplikace.</span>
        <button type="button" class="update-banner__btn" (click)="updates.applyUpdate()">Obnovit</button>
      </div>
    }
  `,
})
export class UpdateBannerComponent {
  constructor(public updates: AppUpdateService) {}
}

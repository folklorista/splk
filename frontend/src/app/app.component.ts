import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SettingsService } from './core/settings/settings.service';
import { UpdateBannerComponent } from './core/layout/update-banner/update-banner.component';
import { ConfirmDialogComponent } from './shared/dialog/confirm-dialog.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, UpdateBannerComponent, ConfirmDialogComponent],
  template: `<app-update-banner /><router-outlet /><app-confirm-dialog />`,
})
export class AppComponent {
  // Vytvoření služby při startu aplikace promítne uložené nastavení (motiv, písmo, animace)
  constructor(_settings: SettingsService) {}
}

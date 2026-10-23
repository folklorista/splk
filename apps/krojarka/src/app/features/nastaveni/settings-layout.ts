import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { FundContext } from '../../core/fund/fund-context';

/** Nastavení with sections by mandate: fund catalog and series (krojařka), users and mandates (organization.admin). */
@Component({
  selector: 'app-settings-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <h1 class="page-title">Nastavení</h1>
    <nav class="subnav" aria-label="Části nastavení">
      @for (tab of tabs(); track tab.path) {
        <a [routerLink]="tab.path" routerLinkActive="active">{{ tab.label }}</a>
      }
    </nav>
    <router-outlet />
  `,
})
export class SettingsLayout {
  private readonly auth = inject(AuthService);
  private readonly funds = inject(FundContext);

  protected readonly tabs = computed(() => [
    ...(this.funds.current()
      ? [
          { path: '/nastaveni/katalog', label: 'Katalog' },
          { path: '/nastaveni/rady', label: 'Evidenční řady' },
        ]
      : []),
    ...(this.auth.user()?.mandates.some((m) => m.kind === 'organization.admin')
      ? [{ path: '/nastaveni/uzivatele', label: 'Uživatelé a pověření' }]
      : []),
  ]);
}

@Component({
  selector: 'app-settings-no-access',
  template: `<section class="card"><p>Nemáte pověření ke krojovému fondu ani ke správě organizace. Požádejte správce organizace.</p></section>`,
})
export class SettingsNoAccess {}

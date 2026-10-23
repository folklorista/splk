import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MOCK_DATA } from '../../data/api-config';
import { AuthService } from '../auth/auth.service';
import { LOGIN_PATH } from '../auth/auth.guards';
import { MENU } from './menu';

/** Signed-in layout: side menu (D-22), on narrow screens a drawer opened from the top bar. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  protected readonly auth = inject(AuthService);
  protected readonly mock = inject(MOCK_DATA);
  protected readonly menu = MENU;
  protected readonly menuOpen = signal(false);
  private readonly router = inject(Router);

  protected async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl(LOGIN_PATH);
  }
}

import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { NavigationService } from '../navigation.service';
import { IconComponent } from '../../../shared/icon/icon.component';
import { VersionLabelComponent } from '../../../shared/version-label/version-label.component';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, IconComponent, VersionLabelComponent],
  templateUrl: './sidebar.component.html',
  styles: [`
    .sidebar__nav-item {
      position: relative;
    }

    .sidebar__badge {
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      min-width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--color-primary);
      color: #fff;
      border-radius: 50%;
      font-size: 11px;
      font-weight: 700;
      padding: 0 4px;
    }
  `],
})
export class SidebarComponent implements OnInit, OnDestroy {
  // Přehled – Akce – Docházka – skupiny uživatele – Kroje; Soubor: rozcestník skupin, Správa.
  // Na profil se jde kliknutím na jméno v patičce.
  readonly navSections: NavigationService['sections'];

  constructor(
    public auth: AuthService,
    private router: Router,
    private navigation: NavigationService,
  ) {
    this.navSections = this.navigation.sections;
  }

  ngOnInit(): void {
    this.navigation.start();
  }

  ngOnDestroy(): void {
    this.navigation.stop();
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}

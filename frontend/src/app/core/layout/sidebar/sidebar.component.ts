import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { NavSection, NavigationService } from '../navigation.service';
import { SettingsService } from '../../settings/settings.service';
import { IconComponent } from '../../../shared/icon/icon.component';
import { VersionLabelComponent } from '../../../shared/version-label/version-label.component';
import { LogoComponent } from '../../../shared/logo/logo.component';
import { SidebarSectionKey } from '../sidebar-menu';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [NgTemplateOutlet, RouterLink, RouterLinkActive, IconComponent, VersionLabelComponent, LogoComponent],
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent implements OnInit, OnDestroy {
  // Přehled – Akce; Moje skupiny; Agendy; Soubor (rozcestník Skupiny, Hledat). Pořadí a skrytí podle
  // Nastavení → Boční menu. Na profil se jde kliknutím na jméno v patičce.
  private settings = inject(SettingsService);
  readonly navSections: NavigationService['sections'];
  // Sbalený sidebar (jen ikony) – uložené v tomto zařízení, na mobilu se sidebar nezobrazuje
  readonly compact = computed(() => this.settings.settings().sidebarCompact);
  private expanded = signal<ReadonlySet<SidebarSectionKey>>(new Set());

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

  // Sbalené menu: tooltip s názvem je position: fixed (seznam se posouvá a přetečení by ho usekl),
  // proto mu při najetí / fokusu předáme svislou polohu položky
  placeTooltip(event: Event): void {
    if (!this.compact()) return;
    const item = (event.target as HTMLElement | null)?.closest<HTMLElement>('.sidebar__nav-item');
    if (!item) return;
    const rect = item.getBoundingClientRect();
    item.style.setProperty('--tip-y', `${rect.top + rect.height / 2}px`);
  }

  toggleCompact(): void {
    this.settings.update({ sidebarCompact: !this.compact() });
  }

  isExpanded(key: SidebarSectionKey): boolean {
    return this.expanded().has(key);
  }

  toggleHidden(key: SidebarSectionKey): void {
    this.expanded.update((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }

  hiddenBadge(section: NavSection): number {
    return section.hidden.reduce((sum, item) => sum + (item.badge ?? 0), 0);
  }

  badgeText(count: number): string {
    return count > 99 ? '99+' : String(count);
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}

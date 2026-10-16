import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NavigationService } from '../navigation.service';
import { IconComponent } from '../../../shared/icon/icon.component';

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, IconComponent],
  templateUrl: './bottom-nav.component.html',
})
export class BottomNavComponent implements OnInit, OnDestroy {
  // Přehled – Akce – skupiny, kde je přihlášený členem – Skupiny – (Správa).
  // Když se položky nevejdou, lišta se dá posouvat prstem do strany.
  readonly navItems: NavigationService['bottomItems'];

  constructor(private navigation: NavigationService) {
    this.navItems = this.navigation.bottomItems;
  }

  ngOnInit(): void {
    this.navigation.start();
  }

  ngOnDestroy(): void {
    this.navigation.stop();
  }
}

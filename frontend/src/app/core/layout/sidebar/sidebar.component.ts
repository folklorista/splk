import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { Router } from '@angular/router';

interface NavItem {
  path: string;
  label: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent {
  navItems: NavItem[] = [
    { path: '/app/dashboard', label: 'Přehled' },
    { path: '/app/posts', label: 'Nástěnka' },
    { path: '/app/events', label: 'Akce' },
    { path: '/app/attendance', label: 'Docházka' },
    { path: '/app/members', label: 'Členové' },
    { path: '/app/costumes', label: 'Krojová databáze' },
  ];

  constructor(
    public auth: AuthService,
    private router: Router,
  ) {}

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}

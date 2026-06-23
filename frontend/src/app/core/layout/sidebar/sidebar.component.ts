import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { Router } from '@angular/router';

interface NavItem {
  path: string;
  label: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent {
  navSections: NavSection[] = [
    {
      label: 'Aplikace',
      items: [
        { path: '/app/dashboard', label: 'Přehled' },
        { path: '/app/posts', label: 'Nástěnka' },
        { path: '/app/events', label: 'Akce' },
        { path: '/app/attendance', label: 'Docházka' },
        { path: '/app/members', label: 'Členové' },
        { path: '/app/costumes', label: 'Krojová databáze' },
      ],
    },
    {
      label: 'Správa',
      items: [
        { path: '/app/admin', label: 'Administrace' },
      ],
    },
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

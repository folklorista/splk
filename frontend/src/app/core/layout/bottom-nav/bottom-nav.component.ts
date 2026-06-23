import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface NavItem {
  path: string;
  label: string;
}

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './bottom-nav.component.html',
})
export class BottomNavComponent {
  navItems: NavItem[] = [
    { path: '/app/dashboard', label: 'Přehled' },
    { path: '/app/posts', label: 'Nástěnka' },
    { path: '/app/events', label: 'Akce' },
    { path: '/app/members', label: 'Členové' },
    { path: '/app/costumes', label: 'Kroje' },
  ];
}

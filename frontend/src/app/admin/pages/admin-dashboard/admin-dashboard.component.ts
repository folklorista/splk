import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface AdminModule {
  path: string;
  label: string;
  description: string;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="admin-dashboard">
      <h2>Administrativní moduly</h2>
      <div class="admin-dashboard__modules">
        @for (module of modules; track module.path) {
          <a [routerLink]="module.path" class="admin-dashboard__module-card">
            <h3>{{ module.label }}</h3>
            <p>{{ module.description }}</p>
            <span class="admin-dashboard__arrow">→</span>
          </a>
        }
      </div>
    </div>
  `,
  styles: [`
    .admin-dashboard {
      max-width: 900px;
      margin: 0 auto;
    }
    .admin-dashboard h2 {
      margin-top: 0;
      margin-bottom: 1.5rem;
      font-size: 1.25rem;
      color: #333;
    }
    .admin-dashboard__modules {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1rem;
    }
    .admin-dashboard__module-card {
      display: block;
      padding: 1.5rem;
      background: #f9f9f9;
      border: 1px solid #ddd;
      border-radius: 6px;
      text-decoration: none;
      color: inherit;
      transition: all 0.2s ease;
      position: relative;
    }
    .admin-dashboard__module-card:hover {
      background: #f0f0f0;
      border-color: #999;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .admin-dashboard__module-card h3 {
      margin: 0 0 0.5rem 0;
      font-size: 1.1rem;
      color: #333;
    }
    .admin-dashboard__module-card p {
      margin: 0 0 0.5rem 0;
      font-size: 0.9rem;
      color: #666;
    }
    .admin-dashboard__arrow {
      position: absolute;
      top: 1.5rem;
      right: 1.5rem;
      color: #999;
      font-weight: bold;
    }
  `],
})
export class AdminDashboardComponent {
  modules: AdminModule[] = [
    {
      path: '/app/admin/posts',
      label: 'Příspěvky (nástěnka)',
      description: 'Správa příspěvků na nástěnce',
    },
    {
      path: '/app/admin/events',
      label: 'Akce',
      description: 'Správa akcí a jejich detailů',
    },
    {
      path: '/app/admin/members',
      label: 'Členové',
      description: 'Správa členů souboru',
    },
    {
      path: '/app/admin/groups',
      label: 'Skupiny',
      description: 'Správa skupin členů',
    },
  ];
}

import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-admin-groups',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="admin-groups">
      <div class="admin-groups__header">
        <h2>Skupiny</h2>
        <a [routerLink]="'/app/admin'" class="admin-groups__back-link">← Zpět na administraci</a>
      </div>
      <p class="admin-groups__placeholder">
        Zde budou CRUD operace pro skupiny: seznam, vytvoření, úprava, mazání.
      </p>
    </div>
  `,
  styles: [`
    .admin-groups {
      max-width: 900px;
      margin: 0 auto;
    }
    .admin-groups__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid #ddd;
    }
    .admin-groups__header h2 {
      margin: 0;
      font-size: 1.25rem;
    }
    .admin-groups__back-link {
      font-size: 0.9rem;
      color: #0066cc;
      text-decoration: none;
    }
    .admin-groups__back-link:hover {
      text-decoration: underline;
    }
    .admin-groups__placeholder {
      padding: 2rem;
      background: #f9f9f9;
      border: 1px dashed #ccc;
      border-radius: 4px;
      color: #666;
      text-align: center;
    }
  `],
})
export class AdminGroupsComponent {}

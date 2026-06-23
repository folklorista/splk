import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-admin-members',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="admin-members">
      <div class="admin-members__header">
        <h2>Členové</h2>
        <a [routerLink]="'/app/admin'" class="admin-members__back-link">← Zpět na administraci</a>
      </div>
      <p class="admin-members__placeholder">
        Zde budou CRUD operace pro členy: seznam, vytvoření, úprava, mazání.
      </p>
    </div>
  `,
  styles: [`
    .admin-members {
      max-width: 900px;
      margin: 0 auto;
    }
    .admin-members__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid #ddd;
    }
    .admin-members__header h2 {
      margin: 0;
      font-size: 1.25rem;
    }
    .admin-members__back-link {
      font-size: 0.9rem;
      color: #0066cc;
      text-decoration: none;
    }
    .admin-members__back-link:hover {
      text-decoration: underline;
    }
    .admin-members__placeholder {
      padding: 2rem;
      background: #f9f9f9;
      border: 1px dashed #ccc;
      border-radius: 4px;
      color: #666;
      text-align: center;
    }
  `],
})
export class AdminMembersComponent {}

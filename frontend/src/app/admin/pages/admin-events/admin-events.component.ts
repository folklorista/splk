import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-admin-events',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="admin-events">
      <div class="admin-events__header">
        <h2>Akce</h2>
        <a [routerLink]="'/app/admin'" class="admin-events__back-link">← Zpět na administraci</a>
      </div>
      <p class="admin-events__placeholder">
        Zde budou CRUD operace pro akce: seznam, vytvoření, úprava, mazání.
      </p>
    </div>
  `,
  styles: [`
    .admin-events {
      max-width: 900px;
      margin: 0 auto;
    }
    .admin-events__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid #ddd;
    }
    .admin-events__header h2 {
      margin: 0;
      font-size: 1.25rem;
    }
    .admin-events__back-link {
      font-size: 0.9rem;
      color: #0066cc;
      text-decoration: none;
    }
    .admin-events__back-link:hover {
      text-decoration: underline;
    }
    .admin-events__placeholder {
      padding: 2rem;
      background: #f9f9f9;
      border: 1px dashed #ccc;
      border-radius: 4px;
      color: #666;
      text-align: center;
    }
  `],
})
export class AdminEventsComponent {}

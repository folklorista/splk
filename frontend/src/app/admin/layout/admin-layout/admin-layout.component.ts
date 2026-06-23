import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Router } from '@angular/router';
import { MainLayoutComponent } from '../../../core/layout/main-layout/main-layout.component';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <div class="admin-layout">
      <header class="admin-layout__header">
        <h1>Administrace</h1>
        <button class="admin-layout__back" (click)="goBack()">← Zpět na aplikaci</button>
      </header>
      <main class="admin-layout__content">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [`
    .admin-layout {
      padding: 1rem;
    }
    .admin-layout__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      border-bottom: 2px solid #e0e0e0;
      padding-bottom: 1rem;
    }
    .admin-layout__header h1 {
      margin: 0;
      font-size: 1.5rem;
    }
    .admin-layout__back {
      padding: 0.5rem 1rem;
      background: #f0f0f0;
      border: 1px solid #ccc;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.9rem;
    }
    .admin-layout__back:hover {
      background: #e0e0e0;
    }
  `],
})
export class AdminLayoutComponent {
  constructor(private router: Router) {}

  goBack(): void {
    this.router.navigate(['/app/dashboard']);
  }
}

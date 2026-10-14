import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { Member } from '../../core/models/member.model';
import { User } from '../../core/auth/models/user.model';
import { LEADERSHIP_GROUP_ID } from '../../core/data/mock-groups';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styles: [`
    .login-page {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: #f5f5f5;
      padding: 1rem;
    }

    .login-card {
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      padding: 2rem;
      max-width: 500px;
      width: 100%;
    }

    .login-title {
      margin: 0 0 0.5rem;
      font-size: 1.75rem;
      text-align: center;
      color: #333;
    }

    .login-subtitle {
      margin: 0 0 1.5rem;
      text-align: center;
      color: #666;
      font-size: 0.95rem;
    }

    .login-form {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      margin-bottom: 1.5rem;
    }

    .form-field {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .form-field label {
      font-weight: 500;
      font-size: 0.95rem;
      color: #333;
    }

    .form-field input {
      padding: 0.75rem;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 0.95rem;
      font-family: inherit;
      outline: none;
      transition: border-color 0.2s;
    }

    .form-field input:focus {
      border-color: #0066cc;
    }

    .btn-primary {
      padding: 0.85rem 1.5rem;
      background: #c94a3a;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 1rem;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    }

    .btn-primary:hover:not(:disabled) {
      background: #a73a2a;
    }

    .btn-primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .login-error {
      padding: 0.75rem;
      background: #ffebee;
      color: #d32f2f;
      border-radius: 4px;
      border-left: 4px solid #d32f2f;
      margin: 0;
      font-size: 0.9rem;
    }

    .demo-section {
      border-top: 1px solid #ddd;
      padding-top: 1.5rem;
    }

    .demo-label {
      margin: 0 0 1rem;
      font-size: 0.9rem;
      font-weight: 500;
      color: #666;
      text-align: center;
    }

    .demo-login {
      display: flex;
      gap: 0.5rem;
    }

    .demo-login select {
      flex: 1;
      min-width: 0;
      padding: 0.65rem;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 0.9rem;
    }

    .btn-demo {
      padding: 0.65rem 1rem;
      background: #f0f0f0;
      color: #333;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 0.9rem;
      cursor: pointer;
      transition: all 0.2s;
      font-weight: 500;
    }

    .btn-demo:hover:not(:disabled) {
      background: #e0e0e0;
      border-color: #999;
    }

    .btn-demo:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `],
})
export class LoginComponent {
  email = '';
  password = '';
  error = signal<string | null>(null);
  loading = signal(false);
  demoMembers = signal<Member[]>([]);

  constructor(
    private auth: AuthService,
    private router: Router,
  ) {
    this.auth.getDemoMembers().subscribe((members) => this.demoMembers.set(members));
  }

  onSubmit(): void {
    this.error.set(null);
    this.loading.set(true);
    this.handleLogin(this.auth.login(this.email, this.password));
  }

  quickLogin(memberId: number): void {
    this.error.set(null);
    this.loading.set(true);
    this.handleLogin(this.auth.loginAsMember(memberId));
  }

  demoLabel(member: Member): string {
    if (member.isAdmin) return `${member.nickname} (administrátor)`;
    if (member.groupIds.includes(LEADERSHIP_GROUP_ID)) return `${member.nickname} (výbor)`;
    return member.nickname;
  }

  private handleLogin(login$: Observable<User>): void {
    login$.subscribe({
      next: () => this.router.navigate(['/app/dashboard']),
      error: (err: Error) => {
        this.error.set(err.message);
        this.loading.set(false);
      },
    });
  }
}

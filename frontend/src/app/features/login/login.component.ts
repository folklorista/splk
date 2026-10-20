import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { Member } from '../../core/models/member.model';
import { User } from '../../core/auth/models/user.model';
import { MandatesService } from '../mandates/mandates.service';
import { MANDATE_LABELS } from '../../core/models/mandate.model';
import { LogoComponent } from '../../shared/logo/logo.component';

const DEFAULT_RETURN_URL = '/app/dashboard';

// Vrátit se lze jen dovnitř aplikace – ne na cizí doménu (open redirect) ani zpět na login
export function safeReturnUrl(url: string | null | undefined): string {
  return url && url.startsWith('/app') ? url : DEFAULT_RETURN_URL;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, LogoComponent],
  templateUrl: './login.component.html',
  styles: [`
    .login-page {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: var(--color-surface-alt);
      padding: 1rem;
    }

    .login-card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-card);
      padding: 2rem;
      max-width: 460px;
      width: 100%;
    }

    .login-title {
      display: flex;
      justify-content: center;
      margin: 0 0 0.5rem;
    }

    .login-subtitle {
      margin: 0 0 1.5rem;
      text-align: center;
      color: var(--color-text-muted);
      font-size: var(--font-size-sm);
    }

    .login-form {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-md);
      margin-bottom: 1.5rem;
    }

    .form-field {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .form-field label {
      font-weight: 500;
      font-size: var(--font-size-sm);
      color: var(--color-text-muted);
    }

    .login-error {
      margin: 0;
    }

    .demo-section {
      padding-top: var(--spacing-md);
    }

    .demo-label {
      margin: 0 0 var(--spacing-sm);
      font-size: var(--font-size-sm);
      font-weight: 500;
      color: var(--color-text-muted);
      text-align: center;
    }

    .demo-login {
      display: flex;
      gap: var(--spacing-sm);
    }

    .demo-login select {
      flex: 1;
      min-width: 0;
    }
  `],
})
export class LoginComponent {
  email = '';
  password = '';
  error = signal<string | null>(null);
  loading = signal(false);
  demoMembers = signal<Member[]>([]);

  private readonly returnUrl: string;

  constructor(
    private auth: AuthService,
    private router: Router,
    private mandatesService: MandatesService,
    route: ActivatedRoute,
  ) {
    this.returnUrl = safeReturnUrl(route.snapshot.queryParamMap.get('returnUrl'));
    // Už přihlášený (zapamatované přihlášení) na login nepatří
    if (this.auth.isLoggedIn()) {
      this.router.navigateByUrl(this.returnUrl);
      return;
    }
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

  // V demu pomáhá vybrat profil podle toho, co smí: souborová funkce, případně hlavní pověření
  demoLabel(member: Member): string {
    const kinds = this.mandatesService.mandates().filter((m) => m.memberId === member.id).map((m) => m.kind);
    const main = kinds.includes('ensemble-admin') ? MANDATE_LABELS['ensemble-admin'] : kinds.includes('costumes') ? 'Správa krojů' : undefined;
    const label = [member.functionTitle, main].filter(Boolean).join(', ');
    return label ? `${member.nickname} (${label})` : member.nickname;
  }

  private handleLogin(login$: Observable<User>): void {
    login$.subscribe({
      next: () => this.router.navigateByUrl(this.returnUrl),
      error: (err: Error) => {
        this.error.set(err.message);
        this.loading.set(false);
      },
    });
  }
}

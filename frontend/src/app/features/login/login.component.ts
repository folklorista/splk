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
      position: relative;
      overflow: hidden;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      padding: calc(2rem + 14px) 2rem 2rem;
      max-width: 500px;
      width: 100%;
    }

    /* Souborová bordura přes horní okraj karty */
    .login-bordura {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 14px;
      background: var(--color-accent);
      -webkit-mask: url('/identity/bordura-tile.png') repeat-x center / auto 100%;
      mask: url('/identity/bordura-tile.png') repeat-x center / auto 100%;
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
      color: var(--color-text);
    }

    .form-field input {
      padding: 0.75rem;
      border: 1px solid var(--color-border);
      border-radius: 4px;
      background: var(--color-surface);
      color: var(--color-text);
      font-size: 0.95rem;
      font-family: inherit;
      outline: none;
      transition: border-color 0.2s;
    }

    .form-field input:focus {
      border-color: var(--color-primary);
    }

    .btn-primary {
      padding: 0.85rem 1.5rem;
      background: var(--color-primary-fill);
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 1rem;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    }

    .btn-primary:hover:not(:disabled) {
      background: var(--color-primary-dark);
    }

    .btn-primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .login-error {
      padding: 0.75rem;
      background: var(--color-primary-soft);
      color: var(--color-primary);
      border-radius: 4px;
      border-left: 4px solid var(--color-primary);
      margin: 0;
      font-size: 0.9rem;
    }

    .demo-section {
      border-top: 1px solid var(--color-border);
      padding-top: 1.5rem;
    }

    .demo-label {
      margin: 0 0 1rem;
      font-size: 0.9rem;
      font-weight: 500;
      color: var(--color-text-muted);
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
      border: 1px solid var(--color-border);
      border-radius: 4px;
      background: var(--color-surface);
      color: var(--color-text);
      font-size: 0.9rem;
    }

    .btn-demo {
      padding: 0.65rem 1rem;
      background: var(--color-surface-alt);
      color: var(--color-text);
      border: 1px solid var(--color-border);
      border-radius: 4px;
      font-size: 0.9rem;
      cursor: pointer;
      transition: all 0.2s;
      font-weight: 500;
    }

    .btn-demo:hover:not(:disabled) {
      border-color: var(--color-text-muted);
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

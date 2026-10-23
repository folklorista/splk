import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MOCK_DATA } from '../../data/api-config';
import { MOCK_LOGIN } from '../../data/auth/mock-auth-api';
import { AuthService } from './auth.service';
import { safeReturnUrl } from './auth.guards';
import { errorMessage } from './error-messages';

/** K01 – login by e-mail and password (D-53). */
@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login-page.html',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly mock = inject(MOCK_DATA);
  protected readonly mockLogin = MOCK_LOGIN;
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Vyplňte e-mail a heslo.');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      const { email, password } = this.form.getRawValue();
      await this.auth.login(email, password);
      await this.router.navigateByUrl(safeReturnUrl(this.route.snapshot.queryParamMap.get('navrat')));
    } catch (error) {
      this.error.set(errorMessage(error));
      this.form.controls.password.reset();
    } finally {
      this.busy.set(false);
    }
  }
}

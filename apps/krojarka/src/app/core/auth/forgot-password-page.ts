import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from './auth.service';
import { errorMessage } from './error-messages';

/** Request a password link by e-mail (D-49); also the way to set the first password of a new account. */
@Component({
  selector: 'app-forgot-password-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password-page.html',
})
export class ForgotPasswordPage {
  private readonly auth = inject(AuthService);
  protected readonly busy = signal(false);
  protected readonly sent = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
  });

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.error.set('Zadejte platný e-mail.');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.auth.requestPasswordReset(this.form.getRawValue().email);
      this.sent.set(true);
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}

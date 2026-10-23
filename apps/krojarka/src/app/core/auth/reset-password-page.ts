import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PASSWORD_MIN_LENGTH } from '@splk/api-contracts';
import { AuthService } from './auth.service';
import { errorMessage } from './error-messages';

/** Target of the e-mailed link /obnova-hesla?token=… */
@Component({
  selector: 'app-reset-password-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password-page.html',
})
export class ResetPasswordPage {
  private readonly auth = inject(AuthService);
  protected readonly token = inject(ActivatedRoute).snapshot.queryParamMap.get('token') ?? '';
  protected readonly minLength = PASSWORD_MIN_LENGTH;
  protected readonly busy = signal(false);
  protected readonly done = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    password: ['', [Validators.required, Validators.minLength(PASSWORD_MIN_LENGTH)]],
    confirmation: ['', Validators.required],
  });

  protected async submit(): Promise<void> {
    const { password, confirmation } = this.form.getRawValue();
    if (password.length < PASSWORD_MIN_LENGTH) {
      this.error.set(`Heslo musí mít alespoň ${PASSWORD_MIN_LENGTH} znaků.`);
      return;
    }
    if (password !== confirmation) {
      this.error.set('Hesla se neshodují.');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.auth.confirmPasswordReset(this.token, password);
      this.done.set(true);
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}

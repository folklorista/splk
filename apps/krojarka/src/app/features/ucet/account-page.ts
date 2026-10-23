import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { PASSWORD_MIN_LENGTH, SessionInfo } from '@splk/api-contracts';
import { AuthService } from '../../core/auth/auth.service';
import { LOGIN_PATH } from '../../core/auth/auth.guards';
import { errorMessage } from '../../core/auth/error-messages';
import { mandateLabel } from '../../core/labels';

/** Můj účet – identity, mandates, password change, signed-in devices, logout (D-22). */
@Component({
  selector: 'app-account-page',
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './account-page.html',
})
export class AccountPage implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly mandateLabel = mandateLabel;
  protected readonly minLength = PASSWORD_MIN_LENGTH;

  protected readonly sessions = signal<SessionInfo[]>([]);
  protected readonly sessionsError = signal<string | null>(null);
  protected readonly passwordBusy = signal(false);
  protected readonly passwordMessage = signal<{ ok: boolean; text: string } | null>(null);

  protected readonly passwordForm = inject(NonNullableFormBuilder).group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.minLength(PASSWORD_MIN_LENGTH)]],
  });

  ngOnInit(): void {
    void this.loadSessions();
  }

  protected async changePassword(): Promise<void> {
    const { currentPassword, newPassword } = this.passwordForm.getRawValue();
    if (!currentPassword || newPassword.length < PASSWORD_MIN_LENGTH) {
      this.passwordMessage.set({ ok: false, text: `Vyplňte současné heslo a nové heslo o alespoň ${PASSWORD_MIN_LENGTH} znacích.` });
      return;
    }
    this.passwordBusy.set(true);
    try {
      await this.auth.changePassword(currentPassword, newPassword);
      this.passwordForm.reset();
      this.passwordMessage.set({ ok: true, text: 'Heslo je změněné. Ostatní zařízení byla odhlášena.' });
      await this.loadSessions();
    } catch (error) {
      this.passwordMessage.set({ ok: false, text: errorMessage(error) });
    } finally {
      this.passwordBusy.set(false);
    }
  }

  protected async endSession(session: SessionInfo): Promise<void> {
    try {
      await this.auth.deleteSession(session);
      if (session.current) {
        await this.router.navigateByUrl(LOGIN_PATH);
        return;
      }
      await this.loadSessions();
    } catch (error) {
      this.sessionsError.set(errorMessage(error));
    }
  }

  protected async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl(LOGIN_PATH);
  }

  private async loadSessions(): Promise<void> {
    try {
      this.sessions.set(await this.auth.sessions());
      this.sessionsError.set(null);
    } catch (error) {
      this.sessionsError.set(errorMessage(error));
    }
  }
}

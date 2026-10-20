import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MyUnavailabilityComponent } from '../availability/my-unavailability.component';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { MembersService, NicknameTakenError } from '../members/members.service';
import { Member } from '../../core/models/member.model';
import { getFullName } from '../../core/utils/member.utils';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [ReactiveFormsModule, MyUnavailabilityComponent],
  templateUrl: './profile.component.html',
  styles: [`
    .profile-page {
      padding: 1rem;
      max-width: 600px;
      margin: 0 auto;
    }

    .profile-header {
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid #ddd;
    }

    .profile-header h1 {
      margin: 0 0 0.5rem;
      font-size: 1.5rem;
      color: #333;
    }

    .profile-section {
      margin-bottom: 2rem;
    }

    .profile-section h2 {
      margin: 0 0 1rem;
      font-size: 1rem;
      font-weight: 600;
      color: #555;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .profile-field {
      padding: 0.75rem;
      margin-bottom: 0.75rem;
      background: #f9f9f9;
      border-radius: 4px;
      border-left: 3px solid #0066cc;
    }

    .profile-field-label {
      font-size: 0.85rem;
      color: #666;
      margin-bottom: 0.25rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .profile-field-value {
      font-size: 0.95rem;
      color: #333;
      font-weight: 500;
    }

    .profile-field-hint {
      display: block;
      font-size: 0.8rem;
      color: #888;
      font-weight: 400;
    }




    .contact-form {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .contact-form label {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      font-size: 0.85rem;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .contact-form input {
      padding: 0.75rem;
      border: 1px solid #ccc;
      border-radius: 4px;
      font-size: 0.95rem;
      font-family: inherit;
      text-transform: none;
      letter-spacing: normal;
    }

    .contact-form__error {
      font-size: 0.85rem;
      color: #d32f2f;
      text-transform: none;
      letter-spacing: normal;
    }

    .contact-form__actions {
      display: flex;
      gap: 0.75rem;
      align-items: center;
    }

    .contact-form__saved {
      color: var(--status-ok-fg);
      font-size: 0.9rem;
    }

    .logout-btn {
      display: block;
      width: 100%;
      padding: 0.85rem;
      margin-top: 2rem;
      background: #c94a3a;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 1rem;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    }

    .logout-btn:hover {
      background: #a73a2a;
    }

  `],
})
export class ProfileComponent {
  fullName = signal('');
  contactForm: FormGroup;
  isSaving = false;
  saved = false;
  saveError = '';
  private member: Member | null = null;

  constructor(
    private auth: AuthService,
    private members: MembersService,
    private router: Router,
    fb: FormBuilder,
  ) {
    this.contactForm = fb.group({
      nickname: ['', Validators.required],
      email: ['', Validators.email],
      phone: [''],
    });
    this.loadMemberData();
  }




  get currentUser() {
    return this.auth.currentUser;
  }

  private loadMemberData(): void {
    const user = this.auth.currentUser();
    if (!user) return;

    this.members.getMemberByUserId(user.id).subscribe((member) => {
      if (!member) return;

      this.member = member;
      this.fullName.set(getFullName(member));
      this.contactForm.reset({ nickname: member.nickname, email: member.email ?? '', phone: member.phone ?? '' });
    });
  }

  saveContact(): void {
    if (this.contactForm.invalid || !this.member) return;

    this.isSaving = true;
    this.saved = false;
    this.saveError = '';
    const { id, ...rest } = this.member;
    const { nickname, email, phone } = this.contactForm.value;
    const changes = { nickname: nickname.trim(), email: email.trim() || undefined, phone: phone.trim() || undefined };

    this.members.updateMember(id, { ...rest, ...changes }).subscribe({
      next: (updated) => {
        this.isSaving = false;
        if (!updated) {
          this.saveError = 'Nepodařilo se uložit údaje';
          return;
        }
        this.member = updated;
        this.auth.refreshFromMember(updated);
        this.contactForm.markAsPristine();
        this.saved = true;
      },
      error: (err: Error) => {
        this.isSaving = false;
        this.saveError = err instanceof NicknameTakenError ? err.message : 'Nepodařilo se uložit údaje';
      },
    });
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}

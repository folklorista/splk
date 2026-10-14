import { Component, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { MembersService } from '../members/members.service';
import { EventsService } from '../events/events.service';
import { getUnconfirmedEventsCount } from '../../core/utils/visibility.utils';
import { Member } from '../../core/models/member.model';
import { getFullName } from '../../core/utils/member.utils';
import { NotificationService } from '../../core/notifications/notification.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule],
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

    .pending-events {
      display: block;
      padding: 1rem;
      background: #fff3cd;
      border: 1px solid #ffc107;
      border-radius: 4px;
      margin-bottom: 1rem;
      color: inherit;
      text-decoration: none;
    }

    .pending-events:hover {
      border-color: #856404;
    }

    .pending-events-count {
      font-weight: 600;
      color: #856404;
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
      color: #2e7d32;
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

    .no-pending {
      padding: 1rem;
      background: #e8f5e9;
      border: 1px solid #4caf50;
      border-radius: 4px;
      color: #2e7d32;
      font-weight: 500;
    }
  `],
})
export class ProfileComponent {
  pendingEventCount = 0;
  fullName = signal('');
  contactForm: FormGroup;
  isSaving = false;
  saved = false;
  saveError = '';
  private member: Member | null = null;

  constructor(
    private auth: AuthService,
    private members: MembersService,
    private events: EventsService,
    private router: Router,
    private notificationService: NotificationService,
    fb: FormBuilder,
  ) {
    this.contactForm = fb.group({
      nickname: ['', Validators.required],
      email: ['', Validators.email],
      phone: [''],
    });
    this.loadMemberData();
  }

  get notificationsSupported(): boolean {
    return this.notificationService.isSupported;
  }

  get notificationPermission() {
    return this.notificationService.permission;
  }

  enableNotifications(): void {
    this.notificationService.requestPermission();
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

      this.events.getEvents().subscribe((events) => {
        this.pendingEventCount = getUnconfirmedEventsCount(events, user, member.id);
      });
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
      error: () => {
        this.isSaving = false;
        this.saveError = 'Nepodařilo se uložit údaje';
      },
    });
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}

import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MyUnavailabilityComponent } from '../availability/my-unavailability.component';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { MembersService, NicknameTakenError } from '../members/members.service';
import { Member } from '../../core/models/member.model';
import { getFullName } from '../../core/utils/member.utils';
import { IconComponent } from '../../shared/icon/icon.component';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [ReactiveFormsModule, MyUnavailabilityComponent, IconComponent],
  templateUrl: './profile.component.html',
  styles: [`
    .profile-page { max-width: 640px; }
    .profile-section { display: flex; flex-direction: column; gap: var(--spacing-md); margin-bottom: var(--spacing-lg); }
    .profile-readonly { display: flex; flex-direction: column; gap: 2px; font-size: var(--font-size-sm); }
    .profile-logout { width: 100%; margin-top: var(--spacing-lg); }
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

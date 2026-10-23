import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ManagedMandate, ManagedPerson, MandateKind } from '@splk/api-contracts';
import { errorMessage } from '../../core/auth/error-messages';
import { MANDATE_KIND_LABELS, mandateLabel } from '../../core/labels';
import { OrganizationStore } from './organization.store';

const ACCOUNT_STATUS: Record<string, string> = { invited: 'pozván', active: 'aktivní', disabled: 'zablokován' };

/** Nastavení → Uživatelé a pověření (D-48): persons, account invitations and mandates. Only organization.admin. */
@Component({
  selector: 'app-users-page',
  imports: [ReactiveFormsModule],
  providers: [OrganizationStore],
  templateUrl: './users-page.html',
})
export class UsersPage implements OnInit {
  protected readonly store = inject(OrganizationStore);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly mandateLabel = mandateLabel;
  protected readonly kinds = Object.entries(MANDATE_KIND_LABELS) as [MandateKind, string][];
  protected readonly accountStatus = ACCOUNT_STATUS;

  protected readonly text = signal('');
  protected readonly message = signal<{ ok: boolean; text: string } | null>(null);
  /** person whose action panel is open: invitation e-mail or a new mandate */
  protected readonly open = signal<{ personId: number; panel: 'invite' | 'mandate' } | null>(null);

  protected readonly personForm = this.fb.group({ firstName: ['', Validators.required], lastName: ['', Validators.required], nickname: [''] });
  protected readonly inviteForm = this.fb.group({ email: ['', [Validators.required, Validators.email]] });
  protected readonly mandateForm = this.fb.group({ kind: ['costumes.manage' as MandateKind], unitId: [0] });

  protected readonly visible = computed(() => {
    const needle = this.text().trim().toLocaleLowerCase('cs');
    return this.store
      .persons()
      .filter((p) => !needle || `${p.firstName} ${p.lastName} ${p.nickname ?? ''} ${p.account?.loginEmail ?? ''}`.toLocaleLowerCase('cs').includes(needle));
  });

  ngOnInit(): void {
    void this.store.load();
  }

  /** costume mandates per fund (costumes.view may also cover all funds), the others organization-wide */
  protected scopeOptions(kind: MandateKind): { id: number; label: string }[] {
    const funds = this.store.funds().map((u) => ({ id: u.id, label: u.name }));
    switch (kind) {
      case 'costumes.manage':
        return funds;
      case 'costumes.view':
        return [{ id: 0, label: 'všechny fondy' }, ...funds];
      default:
        return [{ id: 0, label: 'celá organizace' }];
    }
  }

  protected toggle(person: ManagedPerson, panel: 'invite' | 'mandate'): void {
    const current = this.open();
    this.open.set(current?.personId === person.id && current.panel === panel ? null : { personId: person.id, panel });
    this.inviteForm.reset({ email: '' });
    this.mandateForm.reset({ kind: 'costumes.manage', unitId: this.scopeOptions('costumes.manage')[0]?.id ?? 0 });
  }

  protected onKindChange(): void {
    this.mandateForm.controls.unitId.setValue(this.scopeOptions(this.mandateForm.controls.kind.value)[0]?.id ?? 0);
  }

  protected async addPerson(): Promise<void> {
    const { firstName, lastName, nickname } = this.personForm.getRawValue();
    if (!firstName.trim() || !lastName.trim()) {
      return this.show(false, 'Vyplňte jméno a příjmení.');
    }
    await this.run(async () => {
      const person = await this.store.createPerson({ firstName: firstName.trim(), lastName: lastName.trim(), nickname: nickname.trim() || null });
      this.personForm.reset();
      this.open.set({ personId: person.id, panel: 'invite' });
      return `${person.firstName} ${person.lastName} je v evidenci. Můžete poslat pozvánku k účtu.`;
    });
  }

  protected async invite(person: ManagedPerson): Promise<void> {
    const email = this.inviteForm.getRawValue().email.trim();
    if (this.inviteForm.invalid) {
      return this.show(false, 'Zadejte platný e-mail.');
    }
    await this.run(async () => {
      const { invitationSent } = await this.store.createAccount(person.id, email);
      this.open.set(null);
      return invitationSent ? `Pozvánka odešla na ${email}.` : 'Účet je založený, ale e-mail se nepodařilo odeslat. Zkuste pozvánku poslat znovu.';
    });
  }

  protected async resend(person: ManagedPerson): Promise<void> {
    await this.run(async () =>
      (await this.store.resendInvitation(person.account!.id)) ? `Pozvánka znovu odešla na ${person.account!.loginEmail}.` : 'E-mail se nepodařilo odeslat.',
    );
  }

  protected async setDisabled(person: ManagedPerson, disabled: boolean): Promise<void> {
    if (disabled && !confirm(`Zablokovat účet ${person.account!.loginEmail}? Osoba se odhlásí ze všech zařízení.`)) {
      return;
    }
    await this.run(async () => {
      await this.store.setAccountDisabled(person.account!.id, disabled);
      return disabled ? 'Účet je zablokovaný.' : 'Účet je odblokovaný.';
    });
  }

  protected async grant(person: ManagedPerson): Promise<void> {
    const { kind, unitId } = this.mandateForm.getRawValue();
    await this.run(async () => {
      await this.store.grantMandate({ personId: person.id, kind, unitId: unitId || null });
      this.open.set(null);
      return `Pověření ${MANDATE_KIND_LABELS[kind]} je přidělené.`;
    });
  }

  protected async revoke(person: ManagedPerson, mandate: ManagedMandate): Promise<void> {
    if (!confirm(`Odebrat pověření „${mandateLabel(mandate)}“ osobě ${person.firstName} ${person.lastName}?`)) {
      return;
    }
    await this.run(async () => {
      await this.store.revokeMandate(person.id, mandate.id);
      return 'Pověření je odebrané.';
    });
  }

  private async run(action: () => Promise<string>): Promise<void> {
    try {
      this.show(true, await action());
    } catch (error) {
      this.show(false, errorMessage(error));
    }
  }

  private show(ok: boolean, text: string): void {
    this.message.set({ ok, text });
  }
}

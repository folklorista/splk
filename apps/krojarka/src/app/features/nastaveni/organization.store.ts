import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CreateAccountResponse, GrantMandateRequest, ManagedPerson, PersonInput, Unit } from '@splk/api-contracts';
import { OrganizationApi } from '../../data/organization/organization-api';
import { AuthService } from '../../core/auth/auth.service';
import { errorMessage } from '../../core/auth/error-messages';

/** Persons, accounts and mandates for Nastavení → Uživatelé a pověření (organization.admin, D-48). */
@Injectable()
export class OrganizationStore {
  private readonly api = inject(OrganizationApi);
  private readonly auth = inject(AuthService);

  readonly persons = signal<ManagedPerson[]>([]);
  readonly units = signal<Unit[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly funds = computed(() => this.units().filter((u) => u.hasCostumeFund && !u.archived));
  readonly currentAccountId = computed(() => this.auth.user()?.account.id ?? null);

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [persons, units] = await Promise.all([firstValueFrom(this.api.persons()), firstValueFrom(this.api.units())]);
      this.persons.set(sortPersons(persons));
      this.units.set(units);
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  async createPerson(input: PersonInput): Promise<ManagedPerson> {
    const person = await firstValueFrom(this.api.createPerson(input));
    this.persons.update((list) => sortPersons([...list, person]));
    return person;
  }

  async createAccount(personId: number, email: string): Promise<CreateAccountResponse> {
    const response = await firstValueFrom(this.api.createAccount(personId, email));
    this.replace(response.person);
    return response;
  }

  async resendInvitation(accountId: number): Promise<boolean> {
    return (await firstValueFrom(this.api.resendInvitation(accountId))).invitationSent;
  }

  async setAccountDisabled(accountId: number, disabled: boolean): Promise<void> {
    this.replace(await firstValueFrom(disabled ? this.api.disableAccount(accountId) : this.api.enableAccount(accountId)));
  }

  async grantMandate(request: GrantMandateRequest): Promise<void> {
    const mandate = await firstValueFrom(this.api.grantMandate(request));
    this.persons.update((list) => list.map((p) => (p.id === request.personId ? { ...p, mandates: [...p.mandates, mandate] } : p)));
    await this.refreshOwnMandates(request.personId);
  }

  async revokeMandate(personId: number, mandateId: number): Promise<void> {
    await firstValueFrom(this.api.revokeMandate(mandateId));
    this.persons.update((list) => list.map((p) => (p.id === personId ? { ...p, mandates: p.mandates.filter((m) => m.id !== mandateId) } : p)));
    await this.refreshOwnMandates(personId);
  }

  /** A change of one's own mandates changes the menu and the funds right away. */
  private async refreshOwnMandates(personId: number): Promise<void> {
    if (this.auth.user()?.person.id === personId) {
      await this.auth.refresh();
    }
  }

  private replace(person: ManagedPerson): void {
    this.persons.update((list) => list.map((p) => (p.id === person.id ? person : p)));
  }
}

function sortPersons(persons: ManagedPerson[]): ManagedPerson[] {
  return [...persons].sort((a, b) => a.lastName.localeCompare(b.lastName, 'cs') || a.firstName.localeCompare(b.firstName, 'cs'));
}

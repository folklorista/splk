import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { HolderProfileInput, PersonCard, PersonCreateInput, PersonInFund, PersonPatch, Unit } from '@splk/api-contracts';
import { AuthService } from '../../core/auth/auth.service';
import { errorMessage } from '../../core/auth/error-messages';
import { FundContext } from '../../core/fund/fund-context';
import { ApiError } from '../../data/api-error';
import { OrganizationApi } from '../../data/organization/organization-api';
import { PeopleApi } from '../../data/people/people-api';

@Injectable()
export class PeopleStore {
  private readonly api = inject(PeopleApi);
  private readonly organization = inject(OrganizationApi);
  private readonly auth = inject(AuthService);
  readonly fund = inject(FundContext).current;
  readonly canEditIdentity = computed(() => this.auth.hasMandate('costumes.manage'));
  readonly canManageProfile = computed(() => this.fund()?.canManage ?? false);
  readonly people = signal<PersonInFund[]>([]);
  readonly units = signal<Unit[]>([]);
  readonly card = signal<PersonCard | null>(null);
  readonly loading = signal(false);
  readonly detailLoading = signal(false);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  private generation = 0;
  private listRequest = 0;
  private detailRequest = 0;

  constructor() {
    effect(() => {
      const fund = this.fund();
      untracked(() => { this.generation++; this.listRequest++; this.closeCard(); this.people.set([]); this.units.set([]); this.error.set(null); this.busy.set(false); this.loading.set(false); if (fund) void this.load(); });
    });
  }
  async load(): Promise<void> {
    const unit = this.fund()?.unitId, generation = this.generation, request = ++this.listRequest;
    if (!unit) return;
    this.loading.set(true); this.error.set(null);
    try {
      const [people, units] = await Promise.all([this.allPeople(unit), firstValueFrom(this.organization.units())]);
      if (this.current(unit, generation) && request === this.listRequest) { this.people.set(people); this.units.set(units); }
    } catch (error) { if (this.current(unit, generation) && request === this.listRequest) this.error.set(errorMessage(error)); }
    finally { if (this.current(unit, generation) && request === this.listRequest) this.loading.set(false); }
  }
  async openCard(id: number): Promise<void> {
    const unit = this.fund()?.unitId, generation = this.generation, request = ++this.detailRequest;
    this.card.set(null); this.error.set(null); this.detailLoading.set(true);
    if (!unit) { this.detailLoading.set(false); return; }
    try {
      const card = await firstValueFrom(this.api.card(unit, id));
      if (this.current(unit, generation) && request === this.detailRequest) {
        if (card.person.id !== id || card.profile && card.profile.unitId !== unit) throw new ApiError(404, 'not_found');
        this.card.set(card);
      }
    } catch (error) { if (this.current(unit, generation) && request === this.detailRequest) this.error.set(errorMessage(error)); }
    finally { if (this.current(unit, generation) && request === this.detailRequest) this.detailLoading.set(false); }
  }
  closeCard(): void { this.detailRequest++; this.card.set(null); this.detailLoading.set(false); }
  create(input: PersonCreateInput) { return this.write(() => this.api.create(input), false); }
  update(id: number, input: PersonPatch) { return this.write(() => this.api.update(id, input), false); }
  profile(id: number, input: HolderProfileInput) { return this.write((unit) => this.api.profile(unit, id, input), true); }
  name(person: { firstName: string; lastName: string; nickname: string | null }): string { return `${person.firstName} ${person.lastName}${person.nickname ? ' („' + person.nickname + '“)' : ''}`; }
  private current(unit: number, generation: number) { return this.fund()?.unitId === unit && generation === this.generation; }
  private async allPeople(unit: number): Promise<PersonInFund[]> {
    const result: PersonInFund[] = [];
    while (true) {
      const page = await firstValueFrom(this.api.people({ fund: unit, limit: 200, offset: result.length }));
      result.push(...page.items);
      if (result.length >= page.total) return result;
      if (!page.items.length) throw new ApiError(0, 'internal_error');
    }
  }
  private async write<T>(request: (unit: number) => Observable<T>, profile: boolean): Promise<T> {
    const unit = this.fund()?.unitId, generation = this.generation;
    if (!unit || !(profile ? this.canManageProfile() : this.canEditIdentity())) throw new ApiError(403, 'forbidden');
    if (this.busy()) throw new ApiError(422, 'validation_failed', { reason: 'not_allowed' });
    this.busy.set(true);
    try {
      const result = await firstValueFrom(request(unit));
      if (!this.current(unit, generation)) throw new ApiError(404, 'not_found');
      await this.load();
      if (!this.current(unit, generation)) throw new ApiError(404, 'not_found');
      return result;
    } finally { if (this.current(unit, generation)) this.busy.set(false); }
  }
}

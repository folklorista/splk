import { AttachmentsApi } from '../attachments/attachments-api';
import type { PaperMigrationRequest, PageQuery } from '@splk/api-contracts';
import { inject, Injectable } from '@angular/core';
import { defer, firstValueFrom, from } from 'rxjs';
import { DefaultCostume, HolderProfile, HolderProfileInput, ManagedPerson, Page, PeopleQuery, PersonCard, PersonCreateInput, PersonIdentity, PersonInFund, PersonPatch } from '@splk/api-contracts';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../api-error';
import { OrganizationApi } from '../organization/organization-api';
import { InventoryApi } from '../inventory/inventory-api';
import { PeopleApi } from './people-api';

/** Uses the same mock persons as organization administration; never creates a second identity registry. */
@Injectable()
export class MockPeopleApi extends PeopleApi {
  private readonly attachments = inject(AttachmentsApi, { optional: true });
  private readonly organization = inject(OrganizationApi);
  private readonly inventory = inject(InventoryApi, { optional: true });
  private readonly auth = inject(AuthService);
  private readonly defaults = new Map<number, DefaultCostume>();
  private readonly profiles = new Map<string, HolderProfile>();
  private nextId = 1;
  private contactsVisible = false;
  private queue: Promise<unknown> = Promise.resolve();

  people(query: PeopleQuery = {}) {
    return this.run(async (): Promise<Page<PersonInFund>> => {
      await this.access(query.fund, false);
      if (query.hasLoans !== undefined && !query.fund) throw new ApiError(422, 'validation_failed', { field: 'fund', reason: 'required' });
      const holders = new Set<number>();
      if (query.hasLoans !== undefined && this.inventory) {
        let offset = 0;
        while (true) {
          const loans = await firstValueFrom(this.inventory.loans(query.fund!, { open: true, limit: 200, offset }));
          for (const loan of loans.items) if ('personId' in loan.holder && loan.holder.personId) holders.add(loan.holder.personId);
          offset += loans.items.length;
          if (offset >= loans.total || !loans.items.length) break;
        }
      }
      const people = await firstValueFrom(this.organization.persons());
      const rows = people.map((p) => ({ ...this.summary(p), profile: query.fund ? this.getProfile(query.fund, p.id) : null }))
        .filter((p) => (!query.q || normalize(`${p.firstName} ${p.lastName} ${p.nickname ?? ''}`).includes(normalize(query.q)))
          && (!query.paperState || p.profile?.paperState === query.paperState) && !query.unit && (query.hasLoans === undefined || holders.has(p.id) === query.hasLoans))
        .sort((a, b) => a.lastName.localeCompare(b.lastName, 'cs') || a.firstName.localeCompare(b.firstName, 'cs'));
      const offset = query.offset ?? 0;
      return { items: rows.slice(offset, offset + (query.limit ?? 50)), total: rows.length };
    });
  }
  create(input: PersonCreateInput) {
    return this.run(async () => {
      await this.access(undefined, true);
      if (!input.firstName.trim() || !input.lastName.trim()) throw new ApiError(422, 'validation_failed', { reason: 'required' });
      const duplicates = (await firstValueFrom(this.organization.persons())).filter((p) => normalize(p.firstName) === normalize(input.firstName) && normalize(p.lastName) === normalize(input.lastName));
      if (duplicates.length && !input.confirmDuplicate) throw new ApiError(422, 'possible_duplicate', { people: duplicates.map((p) => this.summary(p)) });
      const person = await firstValueFrom(this.organization.createPerson(input));
      this.defaults.set(person.id, input.defaultCostume ?? 'unspecified');
      return this.identity(person);
    });
  }
  update(id: number, input: PersonPatch) {
    return this.run(async () => {
      await this.access(undefined, true);
      const { defaultCostume, ...patch } = input;
      if (patch.firstName !== undefined && !patch.firstName.trim() || patch.lastName !== undefined && !patch.lastName.trim()) throw new ApiError(422, 'validation_failed', { reason: 'required' });
      const person = await firstValueFrom(this.organization.updatePerson(id, patch));
      if (defaultCostume !== undefined) this.defaults.set(id, defaultCostume);
      return this.identity(person);
    });
  }
  card(unit: number, id: number) {
    return this.run(async (): Promise<PersonCard> => {
      await this.access(unit, false);
      const openLoans = this.inventory ? await firstValueFrom(this.inventory.loans(unit, { person: id, open: true })) : { items: [], total: 0 };
      const movements = this.inventory ? await firstValueFrom(this.inventory.movements(unit, { person: id })) : { items: [], total: 0 };
      return { person: this.identity(await this.find(id)), profile: this.getProfile(unit, id), openLoans, movements };
    });
  }
  profile(unit: number, id: number, input: HolderProfileInput) {
    return this.run(async () => {
      await this.access(unit, true); await this.find(id);
      const old = this.getProfile(unit, id);
      const profile: HolderProfile = { id: old?.id ?? this.nextId++, personId: id, unitId: unit, paperState: input.paperState,
        note: input.note === undefined ? old?.note ?? null : input.note?.trim() || null, paperCheckedAt: input.originalChecked ? new Date().toISOString() : old?.paperCheckedAt ?? null,
        migratedAt: old?.migratedAt ?? (input.paperState === 'digital' ? new Date().toISOString() : null),
        migratedBy: old?.migratedBy ?? (input.paperState === 'digital' ? this.auth.user()?.account.id ?? 1 : null) };
      this.profiles.set(`${unit}:${id}`, profile); return profile;
    });
  }
  migratePaper(unit: number, person: number, input: PaperMigrationRequest) {
    return this.run(async () => { await this.access(unit, true); await this.find(person); if (!this.inventory) throw new ApiError(500, 'internal_error'); if (input.sourceAttachmentId) {
        if (!this.attachments) throw new ApiError(404, 'not_found');
        const source = await firstValueFrom(this.attachments.metadata(input.sourceAttachmentId));
        if (source.unitId !== unit || source.ownerType !== 'person' || source.ownerId !== person) throw new ApiError(404, 'not_found');
      }
      return firstValueFrom(this.inventory.migratePaper(unit, person, input)); });
  }
  paperFindings(unit: number, person: number, query: PageQuery = {}) {
    return this.run(async () => { await this.access(unit, false); await this.find(person); if (!this.inventory) throw new ApiError(500, 'internal_error'); return firstValueFrom(this.inventory.paperFindings(unit, person, query)); });
  }
  private getProfile(unit: number, person: number) { return this.profiles.get(`${unit}:${person}`) ?? null; }
  private async find(id: number) { const person = (await firstValueFrom(this.organization.persons())).find((p) => p.id === id); if (!person) throw new ApiError(404, 'not_found'); return person; }
  private summary(p: ManagedPerson): PersonInFund {
    const visible = this.contactsVisible;
    return { id: p.id, firstName: p.firstName, lastName: p.lastName, nickname: p.nickname, contact: visible ? p.contact : null,
      contactVisible: visible, affiliations: [], profile: null };
  }
  private identity(p: ManagedPerson): PersonIdentity { const { profile: _, ...person } = this.summary(p); return { ...person, defaultCostume: this.defaults.get(p.id) ?? 'unspecified' }; }
  private async access(unit: number | undefined, write: boolean) {
    const mandates = this.auth.user()?.mandates ?? [];
    const units = (await firstValueFrom(this.organization.units())).filter((u) => u.hasCostumeFund && !u.archived);
    const manage = (id: number) => mandates.some((m) => m.kind === 'costumes.manage' && m.scopeType === 'unit' && m.scopeId === id);
    const view = (id: number) => manage(id) || mandates.some((m) => m.kind === 'costumes.view' && (m.scopeType === 'organization' || m.scopeId === id));
    this.contactsVisible = units.some((u) => manage(u.id));
    if (unit !== undefined) {
      if (!units.some((u) => u.id === unit && view(u.id))) throw new ApiError(404, 'not_found');
      if (write && !manage(unit)) throw new ApiError(403, 'forbidden');
    } else if (!units.some((u) => view(u.id)) || write && !this.contactsVisible) throw new ApiError(403, 'forbidden');
  }
  private run<T>(work: () => Promise<T>) {
    return defer(() => { const result = this.queue.then(async () => structuredClone(await work())); this.queue = result.catch(() => undefined); return from(result); });
  }
}
function normalize(value: string) { return value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }

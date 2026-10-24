import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ManagedGroup } from '@splk/api-contracts';
import { GroupsStore } from './groups.store';
import { OrganizationStore } from './organization.store';
import { errorMessage } from '../../core/auth/error-messages';

@Component({
  selector: 'app-groups-panel', imports: [ReactiveFormsModule], providers: [GroupsStore],
  template: `
    <section class="card">
      <h2>Skupiny osob</h2>
      <p class="muted">Skupina vybírá držitele při inventuře. Sama nedává přístup ke krojovému fondu.</p>
      @if (store.error()) { <p class="notice notice-danger" role="alert">{{ store.error() }}</p> }
      @if (message()) { <p class="notice" role="status">{{ message() }}</p> }
      <form [formGroup]="form" (ngSubmit)="save()" class="form-row">
        <label class="field"><span>Název skupiny</span><input formControlName="name" maxlength="200" required /></label>
        <label class="field"><span>Složka</span><select formControlName="unitId"><option [ngValue]="0">Celá organizace</option>
          @for (unit of organization.units(); track unit.id) { @if (!unit.archived) { <option [ngValue]="unit.id">{{ unit.name }}</option> } }
        </select></label>
        <div class="form-actions"><button class="button button-primary" [disabled]="form.invalid || store.saving()">{{ selected() ? 'Uložit skupinu' : 'Přidat skupinu' }}</button>
          @if (selected()) { <button type="button" class="button" (click)="choose(null)">Nová skupina</button> }
        </div>
      </form>
      <div class="toolbar">
        @for (group of store.groups(); track group.id) { <button type="button" class="button" [attr.aria-pressed]="selected()?.id === group.id" (click)="choose(group)">{{ group.name }}{{ group.archived ? ' (archiv)' : '' }}</button> }
      </div>
      @if (selected(); as group) {
        <h3>{{ group.name }}</h3>
        <button type="button" class="button" [disabled]="store.saving()" (click)="archive(group)">{{ group.archived ? 'Obnovit skupinu' : 'Archivovat skupinu' }}</button>
        @if (!group.archived) {
          <form [formGroup]="member" (ngSubmit)="addMember(group)" class="form-row">
            <label class="field"><span>Osoba</span><select formControlName="personId"><option [ngValue]="0">Vyberte osobu</option>
              @for (person of organization.persons(); track person.id) { <option [ngValue]="person.id">{{ person.firstName }} {{ person.lastName }}</option> }
            </select></label>
            <label class="field"><span>Od</span><input type="date" formControlName="validFrom" /></label>
            <label class="field"><span>Do (nepovinné)</span><input type="date" formControlName="validTo" /></label>
            <div class="form-actions"><button class="button" [disabled]="!member.controls.personId.value || store.saving()">Přidat členství</button></div>
          </form>
        }
        <ul>
          @for (m of group.memberships; track m.id) {
            <li>{{ personName(m.personId) }} · {{ m.validFrom }}{{ m.validTo ? ' – ' + m.validTo : '' }} · {{ m.revokedAt ? 'odebráno' : m.active ? 'aktivní' : 'mimo platnost' }}
              @if (!m.revokedAt) { <button type="button" class="button" [disabled]="store.saving()" (click)="revoke(group, m.id)">Odebrat členství</button> }
            </li>
          } @empty { <li>Zatím bez členů.</li> }
        </ul>
      }
    </section>`,
})
export class GroupsPanel implements OnInit {
  protected readonly store = inject(GroupsStore);
  protected readonly organization = inject(OrganizationStore);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly selectedId = signal<number | null>(null);
  protected readonly selected = computed(() => this.store.groups().find((g) => g.id === this.selectedId()) ?? null);
  protected readonly message = signal('');
  protected readonly form = this.fb.group({ name: ['', Validators.required], unitId: [0] });
  protected readonly member = this.fb.group({ personId: [0], validFrom: [new Date().toISOString().slice(0, 10)], validTo: [''] });
  ngOnInit(): void { void this.store.load(); }
  protected choose(group: ManagedGroup | null): void { this.selectedId.set(group?.id ?? null); this.form.reset({ name: group?.name ?? '', unitId: group?.unitId ?? 0 }); }
  protected async save(): Promise<void> {
    if (this.form.invalid) return;
    const { name, unitId } = this.form.getRawValue(), selected = this.selected();
    await this.run(async () => { this.choose(await (selected ? this.store.update(selected.id, { name, unitId: unitId || null }) : this.store.create({ name, unitId: unitId || null }))); });
  }
  protected async archive(group: ManagedGroup): Promise<void> { await this.run(async () => { await this.store.update(group.id, { archived: !group.archived }); }); }
  protected async addMember(group: ManagedGroup): Promise<void> {
    const { personId, validFrom, validTo } = this.member.getRawValue();
    await this.run(async () => { await this.store.add(group.id, { personId, ...(validFrom ? { validFrom } : {}), validTo: validTo || null }); });
  }
  protected async revoke(group: ManagedGroup, id: number): Promise<void> { await this.run(async () => { await this.store.revoke(group.id, id); }); }
  protected personName(id: number): string { const p = this.organization.persons().find((p) => p.id === id); return p ? p.firstName + ' ' + p.lastName : 'Osoba ' + id; }
  private async run(work: () => Promise<void>): Promise<void> { try { await work(); this.message.set('Změna je uložená.'); } catch (e) { this.message.set(errorMessage(e)); } }
}

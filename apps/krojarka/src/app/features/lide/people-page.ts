import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DefaultCostume, PaperState, PersonSummary } from '@splk/api-contracts';
import { errorMessage } from '../../core/auth/error-messages';
import { ApiError } from '../../data/api-error';
import { PeopleStore } from './people.store';

export const PAPER_LABELS: Record<PaperState, string> = { paper: 'papírová evidence', migrating: 'převádí se', digital: 'digitální evidence' };
@Component({ selector: 'app-people-page', imports: [ReactiveFormsModule, RouterLink], template: `
  @if (notice()) { <p class="notice" role="status">{{ notice() }}</p> }
  <section class="card"><h2>Všechny osoby evidence</h2><p class="muted">Osoba může být externistou i bez účtu a příslušnosti. Stav karty a poznámky se vztahují k vybranému fondu.</p>
    <div class="form-row">
      <label class="field"><span>Hledat jméno nebo přezdívku</span><input type="search" (input)="search.set($any($event.target).value)" /></label>
      <label class="field"><span>Příslušnost ke složce</span><select (change)="unit.set(+$any($event.target).value)"><option value="0">všechny osoby</option>@for (u of store.units(); track u.id) { <option [value]="u.id">{{ u.name }}</option> }</select></label>
      <label class="field"><span>Stav karty ve fondu</span><select (change)="paper.set($any($event.target).value)"><option value="">všechny</option><option value="none">stav neevidován</option><option value="paper">papírová evidence</option><option value="migrating">převádí se</option><option value="digital">digitální evidence</option></select></label>
    </div>
    <ul class="inventory-list">@for (person of visible(); track person.id) {
      <li><a [routerLink]="[person.id]">{{ store.name(person) }}</a>
        <span>{{ person.profile ? paperLabels[person.profile.paperState] : 'stav karty neevidován' }}</span>
        @if (person.contactVisible && person.contact) { <span>{{ person.contact }}</span> }
        @for (a of person.affiliations; track $index) { <span>{{ a.unitName }}{{ a.validTo ? ' (dřívější příslušnost)' : '' }}</span> }
      </li>
    } @empty { <li class="muted">Žádná osoba pro tento výběr.</li> }</ul>
  </section>
  @if (store.canEditIdentity()) {
    <section class="card"><h2>Nová osoba</h2><p class="muted">Nevzniká přihlašovací účet ani členství. Kontakt je společný krojařkám; krojové poznámky patří do karty konkrétního fondu.</p>
      <form [formGroup]="form" (ngSubmit)="save(false)" class="form-row">
        <label class="field"><span>Jméno</span><input formControlName="firstName" maxlength="100" required /></label>
        <label class="field"><span>Příjmení</span><input formControlName="lastName" maxlength="100" required /></label>
        <label class="field"><span>Přezdívka</span><input formControlName="nickname" maxlength="100" /></label>
        <label class="field"><span>Společný kontakt</span><textarea formControlName="contact" maxlength="1000"></textarea></label>
        <label class="field"><span>Výchozí kroj (společný pro všechny fondy)</span><select formControlName="defaultCostume"><option value="unspecified">neurčeno</option><option value="male">mužský</option><option value="female">ženský</option></select></label>
        <button class="button button-primary" [disabled]="store.busy() || form.invalid">Založit osobu</button>
      </form>
      @if (duplicates().length) {
        <section class="notice notice-warn"><h3>Možná shoda jmen</h3><p>Nejprve zkontrolujte již evidované osoby.</p>
          <ul>@for (person of duplicates(); track person.id) { <li><a [routerLink]="[person.id]">{{ store.name(person) }}</a></li> }</ul>
          <button type="button" class="button" [disabled]="store.busy()" (click)="save(true)">Potvrdit založení jiné osoby se stejným jménem</button>
        </section>
      }
    </section>
  }
` })
export class PeoplePage {
  protected readonly store = inject(PeopleStore);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly paperLabels = PAPER_LABELS;
  protected readonly search = signal(''); protected readonly unit = signal(0); protected readonly paper = signal('');
  protected readonly notice = signal(''); protected readonly duplicates = signal<PersonSummary[]>([]);
  protected readonly form = this.fb.group({ firstName: ['', Validators.required], lastName: ['', Validators.required], nickname: [''], contact: [''], defaultCostume: ['unspecified' as DefaultCostume] });
  protected readonly visible = computed(() => {
    const query = normalize(this.search()), unit = this.unit(), paper = this.paper(), date = today();
    return this.store.people().filter((person) => {
      if (query && !normalize(this.store.name(person)).includes(query)) return false;
      if (unit && !person.affiliations.some((a) => a.unitId === unit && a.validFrom <= date && (!a.validTo || a.validTo >= date))) return false;
      return !paper || (paper === 'none' ? !person.profile : person.profile?.paperState === paper);
    });
  });
  constructor() {
    effect(() => { this.store.fund()?.unitId; untracked(() => { this.store.closeCard(); this.form.reset(); this.notice.set(''); this.duplicates.set([]); }); });
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.duplicates.set([]));
  }
  protected async save(confirmed: boolean): Promise<void> {
    if (this.form.invalid || confirmed && !this.duplicates().length) return;
    const unit = this.store.fund()?.unitId;
    try {
      const person = await this.store.create({ ...this.form.getRawValue(), confirmDuplicate: confirmed });
      if (this.store.fund()?.unitId === unit) await this.router.navigate(['/lide', person.id]);
    } catch (error) {
      if (this.store.fund()?.unitId !== unit) return;
      const apiError = ApiError.from(error);
      if (apiError.code === 'possible_duplicate') this.duplicates.set((apiError.details['people'] ?? []) as PersonSummary[]);
      this.notice.set(errorMessage(error));
    }
  }
}
function normalize(value: string) { return value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
function today() { return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Prague' }).format(new Date()); }

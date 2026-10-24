import { Component, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LoanCreate } from '@splk/api-contracts';
import { errorMessage } from '../../core/auth/error-messages';
import { FundHeader } from '../nastaveni/fund-header';
import { LoansStore } from './loans.store';

@Component({ selector: 'app-issue-page', imports: [FormsModule, RouterLink, FundHeader], template: `
  <h1>Výdej součástek</h1><app-fund-header /><p><a routerLink="/vypujcky">Zpět na výpůjčky</a></p>
  @if (store.error() || error) { <p class="error" role="alert">{{ error || store.error() }}</p> }
  @if (!store.canManage()) { <p>Pro výdej potřebujete pověření ke správě vybraného fondu.</p> }
  <form (ngSubmit)="review()">
    <fieldset [disabled]="!store.canManage() || store.loading() || store.busy()">
      <legend>Skutečný držitel a obsah předání</legend>
      <label>Držitel <select name="holderType" [(ngModel)]="holderType" (ngModelChange)="holderId = 0; reviewed = false"><option value="person">Osoba</option><option value="unit">Jiná složka</option></select></label>
      <label>{{ holderType === 'person' ? 'Osoba' : 'Složka' }}
        <select name="holder" required [(ngModel)]="holderId" (ngModelChange)="personChanged()"><option [ngValue]="0">Vyberte…</option>
          @if (holderType === 'person') { @for (p of store.people(); track p.id) { <option [ngValue]="p.id">{{ p.firstName }} {{ p.lastName }} {{ p.nickname ? ' („' + p.nickname + '“)' : '' }}</option> } }
          @else { @for (u of store.units(); track u.id) { @if (!u.archived && u.id !== store.fund()?.unitId) { <option [ngValue]="u.id">{{ u.name }}</option> } } }
        </select>
      </label>
      <p>Osobu bez členství lze založit v <a routerLink="/lide">Lidech</a>; výdej jí nezaloží účet ani členství.</p>
      @if (holderType === 'person' && store.holderCard()?.profile?.paperState !== 'digital') { <p>Tento nový výdej se vede digitálně. Dosavadní papírová karta se tím nepřevádí ani fyzicky neověřuje.</p> }
      <label>Vydat <select name="mode" [(ngModel)]="mode" (ngModelChange)="selected.clear(); bulk = {}; reviewed = false"><option value="items">Jednotlivé součástky</option><option value="kit">Celý komplet s výjimkami</option></select></label>
      @if (mode === 'items') {
        <label>Hledat <input name="search" [(ngModel)]="search" /></label>
        @if (holderType === 'person' && store.holderCard()?.person?.defaultCostume !== 'unspecified') { <label><input name="opposite" type="checkbox" [(ngModel)]="opposite" /> Nabízet i součástky pro opačný kroj</label> }
        <div class="choices">@for (i of offeredItems(); track i.id) {
          <label><input type="checkbox" [checked]="selected.has(i.id)" (change)="toggle(i.id)" /> {{ store.itemLabel(i.id) }}</label>
        } @empty { <p>Žádné dostupné kusy pro tuto nabídku.</p> }</div>
        <h2>Nečíslované součástky</h2>
        @for (s of store.stocks(); track s.id) { <label>{{ store.stockLabel(s.id) }} · volné {{ s.quantityAvailable }} <input type="number" min="0" [max]="s.quantityAvailable" step="1" [name]="'bulk' + s.id" [ngModel]="bulk[s.id] || 0" (ngModelChange)="bulk[s.id] = $event; reviewed = false" /></label> }
      } @else {
        <label>Komplet <select name="kit" [(ngModel)]="kitId" (ngModelChange)="chooseKit()"><option [ngValue]="0">Vyberte…</option>@for (k of store.kits(); track k.id) { <option [ngValue]="k.id">{{ store.kitLabel(k.id) }}</option> }</select></label>
        @if (store.previewLoading()) { <p>Načítám náhled…</p> }
        @if (store.preview(); as k) {
          <p>Určené složení není potvrzením fyzické přítomnosti. Ponechte zaškrtnuté jen skutečně předávané kusy.</p>
          <div class="choices">@for (i of k.items; track i.id) { <label><input type="checkbox" [disabled]="!i.available" [checked]="selected.has(i.id)" (change)="toggle(i.id)" /> {{ store.itemLabel(i.id) }} {{ !i.available ? ' · nelze předat (již půjčeno, nevydatelné nebo vyřazené)' : '' }}</label> }</div>
          @for (l of k.bulkLines; track l.id) { <label>{{ store.stockLabel(l.bulkStockId) }} · evidováno {{ l.presentQty }} z {{ l.requiredQty }} <input type="number" min="0" [max]="l.presentQty" step="1" [name]="'kitBulk' + l.id" [ngModel]="bulk[l.bulkStockId] || 0" (ngModelChange)="bulk[l.bulkStockId] = $event; reviewed = false" /></label> }
          <button type="button" (click)="chooseKit()">Obnovit náhled a výběr</button>
        }
      }
      <label>Termín vrácení (nepovinný) <input type="datetime-local" name="due" [(ngModel)]="due" (ngModelChange)="reviewed = false" /></label>
      <label>Poznámka k předání <textarea name="note" maxlength="5000" [(ngModel)]="note" (ngModelChange)="reviewed = false"></textarea></label>
      <p>Prázdný termín znamená dlouhodobou výpůjčku. Při neúplném předání kompletu doplňte poznámku.</p>
      <button type="submit" [disabled]="store.previewLoading()">Zkontrolovat předání</button>
    </fieldset>
  </form>
  @if (reviewed) { <section class="card" aria-label="Kontrola předání"><h2>Potvrzení skutečného předání</h2>
    <p>{{ store.holderLabel(holderType === 'person' ? { personId: holderId } : { unitId: holderId }) }}</p>
    <ul>@for (id of selected; track id) { <li>{{ store.itemLabel(id) }}</li> }@for (line of bulkSelection(); track line.stockId) { <li>{{ store.stockLabel(line.stockId) }} · {{ line.qty }} ks</li> }</ul>
    <p>{{ note }}</p><button type="button" [disabled]="store.busy() || !store.canManage()" (click)="submit()">Potvrdit skutečné předání</button>
  </section> }
`, styles: [`.choices {display:grid;gap:.6rem;margin:1rem 0} fieldset {display:grid;gap:.8rem;min-width:0} label {display:grid;gap:.3rem} .choices label {display:block} select,input,textarea {max-width:100%}`] })
export class IssuePage {
  readonly store = inject(LoansStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  holderType = 'person'; holderId = 0; mode = 'items'; kitId = 0; selected = new Set<number>(); bulk: Record<number, number> = {};
  search = ''; opposite = false; due = ''; note = ''; reviewed = false; error = '';
  constructor() {
    effect(() => { this.store.fund(); this.holderId = Number(this.route.snapshot.queryParamMap.get('person')) || 0; this.kitId = Number(this.route.snapshot.queryParamMap.get('kit')) || 0; this.mode = this.kitId ? 'kit' : 'items'; this.selected = new Set(); this.bulk = {}; this.note = ''; this.due = ''; this.reviewed = false; if (this.holderId) void this.store.selectPerson(this.holderId); if (this.kitId) void this.store.openKit(this.kitId); });
    effect(() => { const kit = this.store.preview(); this.selected = new Set(kit?.items.filter((i) => i.available).map((i) => i.id) ?? []); this.bulk = Object.fromEntries(kit?.bulkLines.map((l) => [l.bulkStockId, l.presentQty]) ?? []); this.reviewed = false; });
  }
  personChanged() { this.reviewed = false; this.opposite = false; if (this.holderType === 'person') void this.store.selectPerson(this.holderId); }
  chooseKit() { this.reviewed = false; if (this.kitId) void this.store.openKit(this.kitId); }
  toggle(id: number) { this.selected.has(id) ? this.selected.delete(id) : this.selected.add(id); this.reviewed = false; }
  offeredItems() {
    const preference = this.holderType === 'person' ? this.store.holderCard()?.person.defaultCostume : 'unspecified';
    const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return this.store.items().filter((i) => {
      const series = this.store.series().find((s) => s.id === i.seriesId), gender = series?.gender ?? this.store.partTypes().find((t) => t.id === series?.partTypeId)?.gender;
      return i.available && (!this.search || normalize(this.store.itemLabel(i.id)).includes(normalize(this.search))) && (this.opposite || !preference || preference === 'unspecified' || !gender || gender === preference);
    });
  }
  bulkSelection() { return Object.entries(this.bulk).filter(([, qty]) => qty > 0).map(([id, qty]) => ({ stockId: Number(id), qty })); }
  review() { this.error = ''; if (!this.holderId || !this.selected.size && !this.bulkSelection().length || this.mode === 'kit' && this.store.preview()?.id !== this.kitId) { this.error = 'Vyberte držitele a skutečně předávané součástky.'; return; } this.reviewed = true; }
  async submit() {
    if (!this.reviewed) return;
    const holder = this.holderType === 'person' ? { personId: this.holderId } : { unitId: this.holderId };
    const base = { holder, dueAt: this.due ? new Date(this.due).toISOString() : null, note: this.note.trim() || null };
    const preview = this.store.preview();
    const input: LoanCreate = this.mode === 'kit' && preview ? { ...base, kitId: preview.id, kitVersion: preview.version, omitItemIds: preview.items.filter((i) => !this.selected.has(i.id)).map((i) => i.id), kitBulk: preview.bulkLines.filter((l) => l.presentQty > 0).map((l) => ({ stockId: l.bulkStockId, qty: this.bulk[l.bulkStockId] ?? 0 })) } : { ...base, items: [...this.selected], bulk: this.bulkSelection() };
    try { const loan = await this.store.issue(input); await this.router.navigate(['/vypujcky', loan.id]); }
    catch (error) { this.error = errorMessage(error); }
  }
}

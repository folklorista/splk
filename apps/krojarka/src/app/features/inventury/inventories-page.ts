import { Component, effect, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Gender, InventoryScope } from '@splk/api-contracts';
import { InventoriesStore } from './inventories.store';
import { InventoryProgressPanel } from './inventory-progress-panel';
import { errorMessage } from '../../core/auth/error-messages';

@Component({ selector: 'app-inventories-page', imports: [FormsModule, RouterLink, DatePipe, InventoryProgressPanel], template: `
  <button type="button" class="button" [disabled]="store.loading() || store.busy()" (click)="store.reload()">Obnovit seznam</button>
  <section class="card"><h2>Inventury tohoto fondu</h2>
    <ul>@for (inventory of store.inventories(); track inventory.id) { <li><a [routerLink]="['/inventury', inventory.id]">{{ inventory.name }}</a> · {{ inventory.startedAt | date:'d. M. y H:mm' }} · {{ inventory.status === 'open' ? 'probíhá' : inventory.closedWithIssues ? 'uzavřena s nesrovnalostmi' : 'uzavřena' }}</li> } @empty { <li>Zatím žádná inventura.</li> }</ul>
  </section>
  @if (store.canManage()) {
    <section class="card"><h2>Zahájit inventuru</h2>
      <form (ngSubmit)="preview()"><fieldset [disabled]="store.busy() || store.loading()" class="filters">
        <legend>Název a rozsah</legend>
        <label>Název <input name="name" [(ngModel)]="name" maxlength="200" required /></label>
        <label>Region <select name="region" [(ngModel)]="regionId" (ngModelChange)="changed()"><option [ngValue]="0">Všechny</option>@for (r of store.regions(); track r.id) { <option [ngValue]="r.id">{{ r.name }}{{ r.archived ? ' (archiv)' : '' }}</option> }</select></label>
        <label>Kroj <select name="gender" [(ngModel)]="gender" (ngModelChange)="changed()"><option value="">Všechny</option><option value="male">Mužský</option><option value="female">Ženský</option></select></label>
        <label>Druh <select name="type" [(ngModel)]="partTypeId" (ngModelChange)="changed()"><option [ngValue]="0">Všechny</option>@for (t of store.types(); track t.id) { <option [ngValue]="t.id">{{ t.name }}</option> }</select></label>
        <label>Varianta <input name="variant" [(ngModel)]="variant" (ngModelChange)="changed()" maxlength="100" /></label>
        <label>Řada <select name="series" [(ngModel)]="seriesId" (ngModelChange)="changed()"><option [ngValue]="0">Všechny</option>@for (s of store.series(); track s.id) { <option [ngValue]="s.id">{{ s.name }}{{ s.archived ? ' (archiv)' : '' }}</option> }</select></label>
        <label>Skupina držitelů <select name="group" [(ngModel)]="groupId" (ngModelChange)="changed()"><option [ngValue]="0">Bez omezení na skupinu</option>@for (g of store.groups(); track g.id) { <option [ngValue]="g.id">{{ g.name }}</option> }</select></label>
        <label>Příslušnost držitelů <select name="unit" [(ngModel)]="affiliationUnitId" (ngModelChange)="changed()"><option [ngValue]="0">Bez omezení na složku</option>@for (u of store.units(); track u.id) { @if (!u.archived) { <option [ngValue]="u.id">{{ u.name }}</option> } }</select></label>
        <p>Filtry se kombinují průnikem. Skupina nebo příslušnost vybírá skutečně zapůjčené součástky dotčených osob, nikoli volné zásoby.</p>
        <button class="button" [disabled]="previewing || !name.trim()">Zobrazit náhled rozsahu</button>
      </fieldset></form>
      @if (message) { <p class="notice" role="status">{{ message }}</p> }
      @if (store.preview(); as preview) {
        <app-inventory-progress [progress]="preview.progress" /><p>Nezapůjčených číslovaných kusů: {{ preview.unloanedItemCount }}.</p>
        @if (!preview.progress.allTargetCount) { <p class="notice notice-warn">Vybraný rozsah je prázdný. Zkontrolujte filtry; pozdější rozšíření vyžaduje výslovné přidání s poznámkou.</p> }
        <p>Při zahájení se seznam součástek a držitelů zmrazí. Pozdější pohyby ani změny skupin jej automaticky nerozšíří.</p>
        <button type="button" class="button button-primary" [disabled]="store.busy() || !name.trim() || previewing" (click)="start()">{{ preview.progress.allTargetCount ? 'Zahájit inventuru s tímto rozsahem' : 'Zahájit prázdnou inventuru' }}</button>
      }
    </section>
  }
`, styles: [`.filters {display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,15rem),1fr));gap:.8rem;min-width:0}.filters label {display:grid;gap:.3rem}.filters p {grid-column:1/-1} input,select {max-width:100%;min-width:0}`] })
export class InventoriesPage {
  protected readonly store = inject(InventoriesStore);
  private readonly router = inject(Router);
  name = ''; regionId = 0; partTypeId = 0; seriesId = 0; groupId = 0; affiliationUnitId = 0; gender: Gender | '' = ''; variant = ''; previewing = false; message = '';
  constructor() { effect(() => { this.store.fund(); this.name = ''; this.regionId = this.partTypeId = this.seriesId = this.groupId = this.affiliationUnitId = 0; this.gender = ''; this.variant = ''; this.message = ''; }); }
  scope(): InventoryScope { return { ...(this.regionId ? { regionId: this.regionId } : {}), ...(this.partTypeId ? { partTypeId: this.partTypeId } : {}), ...(this.seriesId ? { seriesId: this.seriesId } : {}), ...(this.groupId ? { groupId: this.groupId } : {}), ...(this.affiliationUnitId ? { affiliationUnitId: this.affiliationUnitId } : {}), ...(this.gender ? { gender: this.gender } : {}), ...(this.variant.trim() ? { variant: this.variant.trim() } : {}) }; }
  changed(): void { this.store.invalidatePreview(); this.message = ''; }
  async preview(): Promise<void> {
    const unit = this.store.fund()?.unitId; this.message = ''; this.previewing = true;
    try { await this.store.showPreview(this.scope()); }
    catch (e) { if (unit === this.store.fund()?.unitId) this.message = errorMessage(e); }
    finally { this.previewing = false; }
  }
  async start(): Promise<void> {
    if (!this.store.preview() || !this.name.trim()) return;
    const unit = this.store.fund()?.unitId;
    try { const inventory = await this.store.create({ name: this.name.trim(), scope: this.scope() }); await this.router.navigate(['/inventury', inventory.id]); }
    catch (e) { if (unit === this.store.fund()?.unitId) this.message = errorMessage(e); }
  }
}

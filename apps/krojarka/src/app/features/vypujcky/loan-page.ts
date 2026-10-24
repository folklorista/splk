import { Component, effect, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ItemCondition, ItemLocation, LoanLine, LoanReturnInput } from '@splk/api-contracts';
import { errorMessage } from '../../core/auth/error-messages';
import { FundHeader } from '../nastaveni/fund-header';
import { LoansStore } from './loans.store';
import { InventoryOperationNotice } from '../inventury/inventory-operation-notice';

interface ReturnDraft { selected: boolean; qty: number; type: 'returned' | 'settled'; note: string; condition: ItemCondition | ''; issuable: '' | 'yes' | 'no'; location: ItemLocation | '' }
@Component({ selector: 'app-loan-page', imports: [DatePipe, FormsModule, RouterLink, FundHeader, InventoryOperationNotice], template: `
  <app-inventory-operation-notice />
  <h1>Předání #{{ store.detail()?.id }}</h1><app-fund-header /><p><a routerLink="/vypujcky">Zpět na výpůjčky a pohyby</a></p>
  @if (error || store.error()) { <p class="error" role="alert">{{ error || store.error() }}</p> }
  @if (store.detailLoading()) { <p role="status">Načítám předání…</p> }
  @if (store.detail(); as loan) {
    <section class="card"><h2>{{ store.holderLabel(loan.holder) }}</h2>
      @if (loan.origin === 'paper_migration') { <p>Převzato z papíru · digitalizováno {{ loan.migratedAt | date:'d. M. y HH:mm' }} · účet {{ loan.migratedBy }}.</p><p>Původní datum výdeje: {{ loan.originalIssuedOn ? (loan.originalIssuedOn | date:'d. M. y') : 'neznámé' }}. Převod není fyzické ověření ani nový výdej.</p> }
      @else { <p>Vydáno {{ loan.issuedAt | date:'d. M. y HH:mm' }} · {{ loan.kitId ? store.kitLabel(loan.kitId) : 'Jednotlivé součástky' }}</p> }
      @if (loan.holder.personId) { <p><a [routerLink]="['/lide', loan.holder.personId]">Krojová karta držitele</a></p> }
      @if (loan.replacesLoanId) { <p>Navazuje výměnou na <a [routerLink]="['/vypujcky', loan.replacesLoanId]">předání #{{ loan.replacesLoanId }}</a>.</p> }
      <form (ngSubmit)="save()"><fieldset [disabled]="!store.canManage() || store.busy()"><legend>Termín a poznámka</legend>
        <label>Termín vrácení <input name="due" type="datetime-local" [(ngModel)]="due" /></label><label>Poznámka k výpůjčce <textarea name="note" maxlength="5000" [(ngModel)]="note"></textarea></label>
        <button>Uložit termín a poznámku</button>
      </fieldset></form>
    </section>
    <section class="card"><h2>{{ loan.origin === 'paper_migration' ? 'Držení převzaté z papíru' : 'Skutečně předaný obsah' }}</h2><p>Pozdější změny složení kompletu tento obsah nemění.</p>
      <form (ngSubmit)="reviewReturn()"><fieldset [disabled]="!store.canManage() || store.busy() || store.operation?.blocked()"><legend>Vrácení po jednotlivých řádcích</legend>
        <button type="button" (click)="selectAll()">Označit všechny otevřené řádky k převzetí</button>
        @for (line of loan.lines; track line.id) {
          <article class="line"><h3>{{ line.itemId ? store.itemLabel(line.itemId) : store.stockLabel(line.bulkStockId) }}</h3>
            <p>Předáno {{ line.qty }} · fyzicky vráceno {{ line.returnedQty }}@if (line.closedAt) { · uzavřeno {{ line.closedAt | date:'d. M. y HH:mm' }} ({{ line.closeType === 'settled' ? 'ztráta' : line.closeType === 'exchanged' ? 'výměna' : 'vrácení' }}) }@else { · zbývá {{ line.qty - line.returnedQty }} }</p>
            @if (line.closeNote) { <p>{{ line.closeNote }}</p> }
            @if (!line.closedAt && drafts[line.id]; as d) {
              <label><input type="checkbox" [name]="'select' + line.id" [(ngModel)]="d.selected" (ngModelChange)="reviewed = false" /> Zpracovat tento řádek</label>
              @if (d.selected) {
                <label>Operace <select [name]="'type' + line.id" [(ngModel)]="d.type" (ngModelChange)="changeType(line)"><option value="returned">Skutečné vrácení</option><option value="settled">Vypořádat ztrátu nevrácené části</option></select></label>
                <label>Právě fyzicky převzato <input type="number" [min]="d.type === 'settled' ? 0 : 1" [max]="line.qty - line.returnedQty" step="1" [name]="'qty' + line.id" [(ngModel)]="d.qty" (ngModelChange)="reviewed = false" required /></label>
                @if (d.type === 'settled') { <p class="error">{{ line.qty - line.returnedQty - d.qty }} ks se vypořádá jako ztráta. Číslovaný kus se vyřadí, zásoba se sníží. Nejde o fyzické převzetí.</p> }
                <label>{{ d.type === 'settled' ? 'Povinný důvod ztráty' : 'Poznámka k tomuto vrácení' }} <textarea [required]="d.type === 'settled'" maxlength="5000" [name]="'note' + line.id" [(ngModel)]="d.note" (ngModelChange)="reviewed = false"></textarea></label>
                @if (line.itemId && d.type === 'returned') {
                  <label>Stav převzatého kusu <select [name]="'condition' + line.id" [(ngModel)]="d.condition" (ngModelChange)="reviewed = false"><option value="">Neměnit</option><option value="ok">V pořádku</option><option value="needs_adjustment">Potřebuje úpravu</option><option value="damaged">Poškozený</option></select></label>
                  <label>Vydatelnost <select [name]="'issuable' + line.id" [(ngModel)]="d.issuable" (ngModelChange)="reviewed = false"><option value="">Neměnit</option><option value="yes">Vydatelný</option><option value="no">Nevydatelný</option></select></label>
                  <label>Umístění <select [name]="'location' + line.id" [(ngModel)]="d.location" (ngModelChange)="reviewed = false"><option value="">Neměnit</option><option value="store">Ve skladu</option><option value="holder">U držitele</option><option value="seamstress">U švadleny</option><option value="repair">V opravě</option><option value="unknown">Neznámé</option></select></label>
                }
              }
              @if (line.itemId) { <button type="button" (click)="exchangeLine = line.id; replacement = 0; presented = false">Vyměnit předložený kus</button> }
            }
          </article>
        }
        <button>Zkontrolovat vrácení a případné ztráty</button>
      </fieldset></form>
      @if (reviewed) { <section aria-label="Kontrola vrácení"><h3>Potvrzení převzetí a ztrát</h3>
        <ul>@for (line of returnInput().lines; track line.lineId) { <li>{{ lineLabel(line.lineId) }} · převzato {{ line.returnedQty }}@if (line.closeType === 'settled') { · zbytek ztracen } · {{ line.note }}</li> }</ul>
        <button type="button" [disabled]="store.busy() || !store.canManage() || store.operation?.blocked()" (click)="confirmReturn()">Potvrdit uvedené skutečné převzetí a ztráty</button>
      </section> }
    </section>
    @if (exchangeLine) { <section class="card"><h2>Výměna předloženého kusu</h2><p>{{ lineLabel(exchangeLine) }}</p>
      <form (ngSubmit)="exchange()"><fieldset [disabled]="!store.canManage() || store.busy() || store.operation?.blocked()"><legend>Převzetí původního a předání náhradního kusu</legend>
        <label><input type="checkbox" name="presented" [(ngModel)]="presented" required /> Původní kus byl skutečně předložen a přebírám jej</label>
        <label><input type="checkbox" name="opposite" [(ngModel)]="opposite" /> Nabízet i součástky pro opačný kroj</label>
        <label>Náhradní dostupný kus <select name="replacement" [(ngModel)]="replacement" required><option [ngValue]="0">Vyberte…</option>@for (i of replacements(); track i.id) { <option [ngValue]="i.id">{{ store.itemLabel(i.id) }}</option> }</select></label>
        <label>Poznámka k výměně <textarea name="exchangeNote" [(ngModel)]="exchangeNote" maxlength="5000"></textarea></label>
        <button [disabled]="!presented || !replacement">Potvrdit převzetí původního a výdej náhradního kusu</button>
      </fieldset></form>
    </section> }
    <section class="card"><h2>Jednotlivá vrácení, výměny a ztráty</h2>
      @for (r of loan.returns; track r.id) { <article class="line"><p>{{ r.at | date:'d. M. y HH:mm' }} · {{ lineLabel(r.lineId) }} · převzato {{ r.qty }}@if (r.lostQty) { · ztraceno {{ r.lostQty }} }@if (r.closeType === 'exchanged') { · výměna }</p><p>{{ r.note }}</p></article> } @empty { <p>Zatím nebylo zapsané vrácení ani vypořádání.</p> }
    </section>
    <button type="button" [disabled]="store.busy()" (click)="reload()">Obnovit předání a zahodit rozepsané změny</button>
  }
`, styles: [`.line {padding:1rem 0;border-bottom:1px solid #ddd} fieldset {display:grid;gap:.8rem;min-width:0} label {display:block;margin:.6rem 0} input,select,textarea {max-width:100%}`] })
export class LoanPage {
  readonly store = inject(LoansStore);
  private readonly router = inject(Router);
  private readonly params = toSignal(inject(ActivatedRoute).paramMap);
  drafts: Record<number, ReturnDraft> = {}; due = ''; note = ''; error = ''; reviewed = false;
  exchangeLine = 0; replacement = 0; presented = false; exchangeNote = ''; opposite = false;
  constructor() {
    effect(() => { const id = Number(this.params()?.get('id')); if (this.store.fund() && id > 0) void this.store.openLoan(id); });
    effect(() => {
      const loan = this.store.detail(); this.drafts = {}; this.reviewed = false; this.error = ''; this.exchangeLine = 0; this.presented = false;
      this.note = loan?.note ?? ''; this.due = loan?.dueAt ? localDateTime(loan.dueAt) : '';
      for (const line of loan?.lines ?? []) if (!line.closedAt) this.drafts[line.id] = { selected: false, qty: line.qty - line.returnedQty, type: 'returned', note: '', condition: '', issuable: '', location: '' };
      if (loan && 'personId' in loan.holder && loan.holder.personId) void this.store.selectPerson(loan.holder.personId);
    });
  }
  lineLabel(id: number) { const line = this.store.detail()?.lines.find((l) => l.id === id); return line?.itemId ? this.store.itemLabel(line.itemId) : this.store.stockLabel(line?.bulkStockId ?? null); }
  changeType(line: LoanLine) { const d = this.drafts[line.id]; d.qty = d.type === 'settled' ? 0 : line.qty - line.returnedQty; d.condition = ''; d.issuable = ''; d.location = ''; this.reviewed = false; }
  selectAll() { for (const line of this.store.detail()?.lines ?? []) { const d = this.drafts[line.id]; if (d) { d.selected = true; d.type = 'returned'; d.qty = line.qty - line.returnedQty; } } this.reviewed = false; }
  returnInput(): LoanReturnInput { return { lines: Object.entries(this.drafts).filter(([, d]) => d.selected).map(([id, d]) => ({ lineId: Number(id), returnedQty: d.qty, closeType: d.type, note: d.note.trim() || null, ...(d.type === 'returned' && d.condition ? { condition: d.condition } : {}), ...(d.type === 'returned' && d.issuable ? { issuable: d.issuable === 'yes' } : {}), ...(d.type === 'returned' && d.location ? { location: d.location } : {}) })) }; }
  reviewReturn() { this.error = ''; if (!this.returnInput().lines.length) { this.error = 'Označte alespoň jeden skutečně přebíraný nebo ztracený řádek.'; return; } this.reviewed = true; }
  async confirmReturn() { const loan = this.store.detail(); if (!loan || !this.reviewed) return; try { await this.store.returnLoan(loan.id, this.returnInput()); await this.store.openLoan(loan.id); } catch (error) { this.error = errorMessage(error); } }
  async save() { const loan = this.store.detail(); if (!loan) return; try { await this.store.update(loan.id, { dueAt: this.due ? new Date(this.due).toISOString() : null, note: this.note.trim() || null }); await this.store.openLoan(loan.id); } catch (error) { this.error = errorMessage(error); } }
  async exchange() { const loan = this.store.detail(); if (!loan || !this.presented || !this.replacement) return; try { const next = await this.store.exchange(loan.id, { lineId: this.exchangeLine, itemId: this.replacement, note: this.exchangeNote.trim() || null }); await this.router.navigate(['/vypujcky', next.id], { queryParamsHandling: 'preserve' }); } catch (error) { this.error = errorMessage(error); } }
  replacements() { const preference = this.store.holderCard()?.person.defaultCostume; return this.store.items().filter((i) => { const series = this.store.series().find((s) => s.id === i.seriesId), gender = series?.gender ?? this.store.partTypes().find((t) => t.id === series?.partTypeId)?.gender; return i.available && (this.opposite || !preference || preference === 'unspecified' || !gender || gender === preference); }); }
  reload() { const id = this.store.detail()?.id; if (id) void this.store.openLoan(id); }
}
function localDateTime(value: string) { const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }

import { Component, effect, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InventoryCheckBatch, InventoryCheckEntry, InventoryCheckResponse, InventoryMode, InventoryResult, InventoryTarget, ItemCondition } from '@splk/api-contracts';
import { InventoriesStore } from './inventories.store';
import { CONDITIONS } from '../soucastky/inventory-labels';
import { checkFeedback } from './inventory-feedback';
import { errorMessage } from '../../core/auth/error-messages';

@Component({ selector: 'app-inventory-check-form', imports: [FormsModule], template: `
  <section class="card"><h3>Jednotlivá fyzická kontrola: {{ store.targetLabel(target()) }}</h3>
    <p>Držitel při zahrnutí: {{ store.holderLabel(target()) }}.</p>
    @if (target().bulkStockId !== null) { <p>Evidenční počet při zahrnutí: {{ target().expectedQty }}. Zjištěný počet zapište ručně; není součástí procenta ověřených kusů.</p> }
    <form (ngSubmit)="submit()"><fieldset [disabled]="!store.canManage() || store.busy() || store.detailLoading() || store.detail()?.status !== 'open'">
      <legend>Zjištění při této kontrole</legend>
      <label>Výsledek <select name="result" [(ngModel)]="result"><option value="">Neověřeno – bez nového zápisu</option><option [value]="mode() === 'people' ? 'presented' : 'found'">{{ mode() === 'people' ? 'Fyzicky předložen' : 'Fyzicky nalezen / přítomen' }}</option><option [value]="mode() === 'people' ? 'not_presented' : 'not_found'">{{ mode() === 'people' ? 'Nepředložen' : 'Nenalezen / nepřítomen' }}</option></select></label>
      @if (target().itemId !== null) { <label>Zjištěný stav <select name="condition" [(ngModel)]="condition" [disabled]="!positive()"><option value="">Bez nového zjištění stavu</option>@for (c of conditions; track c[0]) { <option [value]="c[0]">{{ c[1] }}</option> }</select></label> }
      @if (target().bulkStockId !== null) { <label>Skutečně zjištěný počet <input type="number" name="quantity" min="0" step="1" max="2147483647" [(ngModel)]="quantity" required /></label> }
      <label>Poznámka k této kontrole <textarea name="note" maxlength="2000" [(ngModel)]="note" [required]="confirmConflict"></textarea></label>
      <label><input type="checkbox" name="recheck" [(ngModel)]="recheck" /> Opakovaná fyzická kontrola již ověřeného kusu</label>
      @if (mode() !== 'people' && target().itemId !== null) { <label><input type="checkbox" name="conflict" [(ngModel)]="confirmConflict" /> Potvrzuji skutečný nález přes rozpor v evidovaném {{ mode() === 'kit' ? 'složení' : 'umístění' }}; důvod uvádím v poznámce</label> }
      <p class="muted">Zjištěný stav patří k této kontrole. Aktuální stav, vydatelnost, umístění a určené složení upravte v detailu součástky; vrácení je samostatný pohyb.</p>
      <button class="button button-primary" [disabled]="!result || target().bulkStockId !== null && quantity === null || confirmConflict && !note.trim()">Zapsat tuto kontrolu</button>
    </fieldset></form>
    @if (message) { <p class="notice" role="status">{{ message }}</p> }
  </section>
`, styles: [`fieldset {display:grid;gap:.8rem;min-width:0} label {display:grid;gap:.3rem} label:has(input[type=checkbox]) {display:block} input,select,textarea {max-width:100%;min-width:0}`] })
export class InventoryCheckForm {
  protected readonly store = inject(InventoriesStore);
  readonly target = input.required<InventoryTarget>(); readonly mode = input.required<InventoryMode>(); readonly holder = input(''); readonly kitId = input(0);
  readonly saved = output<InventoryCheckResponse>();
  protected readonly conditions = Object.entries(CONDITIONS);
  result: InventoryResult | '' = ''; condition: ItemCondition | '' = ''; quantity: number | null = null; note = ''; recheck = false; confirmConflict = false; message = '';
  constructor() { effect(() => { this.target().id; this.mode(); this.holder(); this.kitId(); this.result = ''; this.condition = ''; this.quantity = null; this.note = ''; this.recheck = false; this.confirmConflict = false; this.message = ''; }); }
  positive(): boolean { return this.result === 'presented' || this.result === 'found'; }
  async submit(): Promise<void> {
    if (!this.result) return;
    const entry: InventoryCheckEntry = { targetId: this.target().id, result: this.result, ...(this.positive() && this.condition ? { condition: this.condition } : {}),
      ...(this.target().bulkStockId !== null && this.quantity !== null ? { checkedQty: this.quantity } : {}), ...(this.note.trim() ? { note: this.note.trim() } : {}), recheck: this.recheck, confirmConflict: this.confirmConflict };
    const [kind, id] = this.holder().split(':');
    const body: Omit<InventoryCheckBatch, 'version'> = { mode: this.mode(), entries: [entry], ...(this.mode() === 'people' ? kind === 'unit' ? { holderUnitId: Number(id) } : { personId: Number(id) } : {}), ...(this.mode() === 'kit' ? { kitId: this.kitId() } : {}) };
    try { const response = await this.store.check(body); this.message = checkFeedback(response.results[0].code); this.saved.emit(response); }
    catch (e) { this.message = errorMessage(e); }
  }
}

import { Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { Observable, concat, defer, of } from 'rxjs';
import { last } from 'rxjs/operators';
import { CostumesService } from '../../costumes.service';
import { InventoryService } from '../../inventory.service';
import { CONDITION_LABELS, CostumeItem, CostumeLoan, CostumeState, ItemCondition } from '../../models/costume.model';
import { Inventory } from '../../models/inventory.model';
import { itemLabel } from '../../utils/costume-logic';
import { activeChecks, exchangeCandidates, isInTarget, itemInventoryState } from '../../utils/inventory-logic';
import { ItemPickerComponent } from './item-picker.component';
import { WorkOrderFormComponent } from './work-order-form.component';
import { errorMessage } from './wardrobe-ui';
import { WARDROBE_STYLES } from './wardrobe.styles';

type Mode = 'none' | 'return' | 'exchange' | 'work-order';

// Běžné operace krojárny nad jednou zápůjčkou: vrátit, vyměnit, založit úkol.
// Stejná komponenta slouží v krojové kartě i při inventurní návštěvě (s kontextem inventury).
@Component({
  selector: 'app-loan-actions',
  standalone: true,
  imports: [ItemPickerComponent, WorkOrderFormComponent],
  template: `
    <div class="row no-print">
      <button type="button" class="btn-secondary" [class.btn-secondary--active]="mode() === 'return'" (click)="toggle('return')">Vrátit</button>
      <button type="button" class="btn-secondary" [class.btn-secondary--active]="mode() === 'exchange'" (click)="toggle('exchange')">Vyměnit</button>
      <button type="button" class="btn-secondary" [class.btn-secondary--active]="mode() === 'work-order'" (click)="toggle('work-order')">+ Úkol</button>
    </div>
    @if (error()) { <div class="error-box">{{ error() }}</div> }

    @if (mode() === 'return') {
      <div class="panel stack">
        <strong>Vrácení: {{ label(item) }}</strong>
        <div class="fields">
          <label class="field">Stav při převzetí
            <select class="input" [value]="condition()" (change)="condition.set($any($event.target).value)">
              @for (c of conditions; track c) { <option [value]="c" [selected]="c === condition()">{{ conditionLabels[c] }}</option> }
            </select>
          </label>
        </div>
        <label class="check"><input type="checkbox" [checked]="issuable()" (change)="issuable.set($any($event.target).checked)" /> Lze znovu vydat</label>
        <input class="input" placeholder="Poznámka k vrácení" [value]="note()" (input)="note.set($any($event.target).value)" />
        @if (inventoryCheckApplies()) {
          <p class="muted">Kus je fyzicky v rukou krojárny – vrácení zároveň zapíše jeho ověření v inventuře.</p>
        }
        <div class="row">
          <button type="button" class="btn-primary btn-primary--sm" [disabled]="busy()" (click)="doReturn()">Potvrdit vrácení</button>
          <button type="button" class="btn-secondary" (click)="mode.set('none')">Zrušit</button>
        </div>
      </div>
    }

    @if (mode() === 'exchange') {
      <div class="panel stack">
        <strong>Výměna: {{ label(item) }}</strong>
        <label class="check">
          <input type="checkbox" [checked]="originalReturned()" (change)="originalReturned.set($any($event.target).checked)" />
          Původní kus byl skutečně předložen a vrácen
        </label>
        @if (!originalReturned()) {
          <div class="warn-box">Původní kus se neoznačí jako vrácený ani ověřený – zůstane u držitele jako otevřená položka.</div>
        }
        <span class="muted">Náhrada – vyberte existující dostupný kus (nejdřív ze stejné řady):</span>
        <app-item-picker [state]="state" [items]="candidates()" [selected]="newItemId() ? [newItemId()!] : []" (selectedChange)="newItemId.set($event.length ? $event[0] : null)" />
        @if (newInTarget()) {
          <label class="check">
            <input type="checkbox" [checked]="newChecked()" (change)="newChecked.set($any($event.target).checked)" />
            Nový kus jsem fyzicky zkontrolovala (započítá se do inventury)
          </label>
        } @else if (inventory && newItemId()) {
          <p class="muted">Nový kus nepatří do rozsahu inventury – rozsah se tím nemění.</p>
        }
        <input class="input" placeholder="Poznámka (důvod výměny)" [value]="note()" (input)="note.set($any($event.target).value)" />
        <div class="row">
          <button type="button" class="btn-primary btn-primary--sm" [disabled]="busy() || !newItemId()" (click)="doExchange()">Potvrdit výměnu a nové vydání</button>
          <button type="button" class="btn-secondary" (click)="mode.set('none')">Zrušit</button>
        </div>
      </div>
    }

    @if (mode() === 'work-order') {
      <app-work-order-form [itemId]="item.id" [inventoryId]="inventory?.id" [visitId]="visitId" (saved)="finish()" (cancelled)="mode.set('none')" />
    }
  `,
  styles: [WARDROBE_STYLES],
})
export class LoanActionsComponent {
  @Input({ required: true }) state!: CostumeState;
  @Input({ required: true }) loan!: CostumeLoan;
  @Input({ required: true }) item!: CostumeItem;
  @Input() inventory?: Inventory;
  @Input() visitId?: number;
  @Output() changed = new EventEmitter<void>();

  private costumes = inject(CostumesService);
  private inventories = inject(InventoryService);

  readonly conditions: ItemCondition[] = ['ok', 'needs-alteration', 'damaged'];
  readonly conditionLabels = CONDITION_LABELS;
  readonly mode = signal<Mode>('none');
  readonly condition = signal<ItemCondition>('ok');
  readonly issuable = signal(true);
  readonly note = signal('');
  readonly originalReturned = signal(true);
  readonly newItemId = signal<number | null>(null);
  readonly newChecked = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');

  readonly candidates = computed(() => (this.mode() === 'exchange' ? exchangeCandidates(this.state, this.item) : []));
  readonly newInTarget = computed(() => !!this.inventory && !!this.newItemId() && isInTarget(this.inventory, this.newItemId()!));

  label(item: CostumeItem): string {
    return itemLabel(this.state, item);
  }

  toggle(mode: Mode): void {
    this.error.set('');
    this.condition.set(this.item.condition);
    this.mode.set(this.mode() === mode ? 'none' : mode);
  }

  inventoryCheckApplies(itemId = this.item.id): boolean {
    if (!this.inventory || !isInTarget(this.inventory, itemId)) return false;
    return !itemInventoryState(activeChecks(this.state, this.inventory.id), itemId).verified;
  }

  // Fyzické převzetí v rámci inventury = ověření kusu (jen pokud ještě ověřen nebyl)
  private checkIfNeeded(itemId: number, condition?: ItemCondition): Observable<unknown> {
    return defer(() => (!this.inventoryCheckApplies(itemId) ? of(null) : this.inventories.recordCheck({ inventoryId: this.inventory!.id, itemId, presented: true, condition, mode: 'person', visitId: this.visitId })));
  }

  doReturn(): void {
    const ctx = { inventoryId: this.inventory?.id, visitId: this.visitId };
    this.run(
      concat(
        this.checkIfNeeded(this.item.id, this.condition()),
        defer(() => this.costumes.returnLoan(this.loan.id, { condition: this.condition(), issuable: this.issuable(), note: this.note(), ...ctx })),
      ),
    );
  }

  doExchange(): void {
    const newItemId = this.newItemId();
    if (!newItemId) return;
    const original = this.originalReturned() ? this.checkIfNeeded(this.item.id) : of(null);
    this.run(
      concat(
        original,
        defer(() => this.costumes.exchangeItem({ loanId: this.loan.id, originalReturned: this.originalReturned(), newItemId, note: this.note(), inventoryId: this.inventory?.id, visitId: this.visitId })),
        this.newInTarget() && this.newChecked() ? this.checkIfNeeded(newItemId) : of(null),
      ),
    );
  }

  finish(): void {
    this.mode.set('none');
    this.note.set('');
    this.newItemId.set(null);
    this.changed.emit();
  }

  private run(obs: Observable<unknown>): void {
    this.busy.set(true);
    this.error.set('');
    obs.pipe(last()).subscribe({
      next: () => { this.busy.set(false); this.finish(); },
      error: (e) => { this.busy.set(false); this.error.set(errorMessage(e)); },
    });
  }
}

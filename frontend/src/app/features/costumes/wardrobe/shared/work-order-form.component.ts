import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { CostumesService } from '../../costumes.service';
import { WORK_ORDER_KIND_LABELS, WorkOrderKind } from '../../models/costume.model';
import { dateInputToIso } from '../../utils/costume-logic';
import { errorMessage } from './wardrobe-ui';
import { WARDROBE_STYLES } from './wardrobe.styles';

// Založení pracovního úkolu na konkrétní součástce – z detailu kusu, krojové karty i inventury
@Component({
  selector: 'app-work-order-form',
  standalone: true,
  template: `
    <div class="panel stack">
      <strong>Nový úkol</strong>
      @if (error()) { <div class="error-box">{{ error() }}</div> }
      <div class="row">
        @for (k of kinds; track k) {
          <button type="button" class="btn-secondary" [class.btn-secondary--active]="kind() === k" (click)="kind.set(k)">{{ kindLabels[k] }}</button>
        }
      </div>
      <input class="input" placeholder="Co je potřeba udělat *" [value]="description()" (input)="description.set($any($event.target).value)" />
      <div class="fields">
        <label class="field">Kdo řeší<input class="input" [value]="assignee()" (input)="assignee.set($any($event.target).value)" placeholder="např. švadlena" /></label>
        <label class="field">Do kdy<input class="input" type="date" [value]="dueAt()" (input)="dueAt.set($any($event.target).value)" /></label>
      </div>
      <div class="row">
        <button type="button" class="btn-primary btn-primary--sm" [disabled]="busy()" (click)="save()">Založit úkol</button>
        <button type="button" class="btn-secondary" (click)="cancelled.emit()">Zrušit</button>
      </div>
    </div>
  `,
  styles: [WARDROBE_STYLES],
})
export class WorkOrderFormComponent {
  @Input({ required: true }) itemId!: number;
  @Input() inventoryId?: number;
  @Input() visitId?: number;
  @Output() saved = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  private costumes = inject(CostumesService);
  readonly kinds: WorkOrderKind[] = ['alteration', 'repair', 'resewing'];
  readonly kindLabels = WORK_ORDER_KIND_LABELS;
  readonly kind = signal<WorkOrderKind>('alteration');
  readonly description = signal('');
  readonly assignee = signal('');
  readonly dueAt = signal('');
  readonly busy = signal(false);
  readonly error = signal('');

  save(): void {
    this.busy.set(true);
    this.costumes
      .createWorkOrder({ itemId: this.itemId, kind: this.kind(), description: this.description(), assignee: this.assignee(), dueAt: dateInputToIso(this.dueAt()), inventoryId: this.inventoryId, visitId: this.visitId })
      .subscribe({
        next: () => { this.busy.set(false); this.saved.emit(); },
        error: (e) => { this.busy.set(false); this.error.set(errorMessage(e)); },
      });
  }
}

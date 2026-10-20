import { Component, ElementRef, effect, inject, viewChild } from '@angular/core';
import { ConfirmService } from './confirm.service';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  template: `
    <dialog
      #dialog
      class="dialog"
      aria-labelledby="confirm-dialog-title"
      (cancel)="$event.preventDefault(); confirm.close(false)"
      (click)="onBackdropClick($event)"
    >
      @if (confirm.request(); as req) {
        <div class="dialog__body">
          <h2 class="dialog__title" id="confirm-dialog-title">{{ req.title }}</h2>
          @if (req.message) {
            <p class="dialog__message">{{ req.message }}</p>
          }
          <div class="dialog__actions">
            <button type="button" class="btn-secondary" (click)="confirm.close(false)">{{ req.cancelLabel ?? 'Zrušit' }}</button>
            <button
              type="button"
              class="btn-primary btn-primary--sm"
              [class.dialog__danger]="req.danger"
              (click)="confirm.close(true)"
              autofocus
            >
              {{ req.confirmLabel ?? 'Potvrdit' }}
            </button>
          </div>
        </div>
      }
    </dialog>
  `,
})
export class ConfirmDialogComponent {
  readonly confirm = inject(ConfirmService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const el = this.dialog().nativeElement;
      const open = !!this.confirm.request();
      if (open && !el.open) el.showModal?.();
      if (!open && el.open) el.close();
    });
  }

  // Klik na podklad (mimo obsah dialogu) = zrušit
  onBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.confirm.close(false);
  }
}

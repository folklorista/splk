import { signal } from '@angular/core';
import { Observable } from 'rxjs';

// Zpětná vazba k akcím na formulářových stránkách (Správa krojů, Správa, akce).
// Styly tříd cs-* jsou globální: src/styles/_form-ui.scss.

export function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Akci se nepodařilo provést.';
}

// Spuštění zápisu s viditelnou chybou (pravidlo, chybějící oprávnění) a krátkým potvrzením
export class ActionFeedback {
  readonly error = signal('');
  readonly success = signal('');
  readonly busy = signal(false);
  private timer?: ReturnType<typeof setTimeout>;

  run<T>(action: Observable<T>, done?: (value: T) => void, successText = 'Uloženo'): void {
    this.error.set('');
    this.success.set('');
    this.busy.set(true);
    action.subscribe({
      next: (value) => {
        this.busy.set(false);
        this.flash(successText);
        done?.(value);
      },
      error: (error) => {
        this.busy.set(false);
        this.error.set(errorMessage(error));
      },
    });
  }

  private flash(text: string): void {
    clearTimeout(this.timer);
    this.success.set(text);
    this.timer = setTimeout(() => this.success.set(''), 2500);
  }
}

import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  // Nevratná / mazací akce – potvrzovací tlačítko v barvě chyby
  danger?: boolean;
}

export interface ConfirmRequest extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

// Potvrzovací dialog místo systémového confirm(): jednotný vzhled, čitelný i na mobilu.
// Dialog vykresluje ConfirmDialogComponent (jednou v AppComponent).
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly _request = signal<ConfirmRequest | null>(null);
  readonly request = this._request.asReadonly();

  confirm(options: ConfirmOptions): Promise<boolean> {
    // Nový dotaz nahradí rozpracovaný – ten se bere jako zrušený
    this._request()?.resolve(false);
    return new Promise((resolve) => this._request.set({ ...options, resolve }));
  }

  close(confirmed: boolean): void {
    const request = this._request();
    if (!request) return;
    this._request.set(null);
    request.resolve(confirmed);
  }
}

import { Injectable } from '@angular/core';
import { clearDemoData } from '../data/demo-storage';

// Demo režim bez backendu: data žijí jen v prohlížeči uživatele
@Injectable({ providedIn: 'root' })
export class DemoDataService {
  // Zahodí změny uložené v prohlížeči a načte aplikaci znovu s výchozími demo daty
  reset(): void {
    clearDemoData();
    this.reload();
  }

  protected reload(): void {
    window.location.reload();
  }
}

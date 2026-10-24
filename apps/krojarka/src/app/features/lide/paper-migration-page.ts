import { DatePipe } from '@angular/common';
import { Component, effect, inject, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { parseInventoryNumbers } from '@splk/domain';
import { AttachmentGallery } from '../dokumenty/attachment-gallery';
import { PaperMigrationStore } from './paper-migration.store';

export const PAPER_RESULTS = { migrated: 'Držení převzato z papíru', already_recorded: 'Držení u této osoby už je evidováno', not_found: 'Kus nebyl dohledán', ambiguous: 'Číslo označuje více historických kusů', conflict: 'Existující držení u jiného držitele', item_retired: 'Kus je vyřazený' };
@Component({ selector: 'app-paper-migration-page', imports: [FormsModule, DatePipe, RouterLink, AttachmentGallery], providers: [PaperMigrationStore], templateUrl: './paper-migration-page.html' })
export class PaperMigrationPage {
  protected readonly store = inject(PaperMigrationStore);
  private readonly params = toSignal(inject(ActivatedRoute).paramMap);
  protected readonly labels = PAPER_RESULTS;
  private loadedNoteKey = '';
  originalChecked = false;
  confirmed = false;
  note = '';
  seriesId = 0;
  numbers = '';
  importNote = '';
  originalIssuedOn = '';
  constructor() {
    effect(() => { const id = Number(this.params()?.get('id')); untracked(() => this.store.personId.set(id || null)); });
    effect(() => { this.store.key(); untracked(() => { this.loadedNoteKey = ''; this.originalChecked = false; this.confirmed = false; this.note = ''; this.seriesId = 0; this.numbers = ''; this.importNote = ''; this.originalIssuedOn = ''; }); });
    effect(() => { const card = this.store.card(); if (card && this.loadedNoteKey !== this.store.key()) untracked(() => { this.loadedNoteKey = this.store.key(); this.note = card.profile?.note ?? ''; }); });
  }
  async migrate(): Promise<void> {
    const key = this.store.key();
    try {
      if (!this.seriesId) { this.store.error.set('Vyberte evidenční řadu.'); return; }
      const numbers = parseInventoryNumbers(this.numbers);
      if (await this.store.migrate({ entries: numbers.map((number) => ({ seriesId: this.seriesId, number, originalIssuedOn: this.originalIssuedOn || null })), note: this.importNote || null }) && this.store.key() === key) this.numbers = '';
    } catch { this.store.error.set('Zadejte nejvýše 200 čísel, například 1, 03, 7-9.'); }
  }
}

import { AttachmentGallery } from '../dokumenty/attachment-gallery';
import { DatePipe } from '@angular/common';
import { Component, effect, inject, signal, untracked } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CostumeLoan, DefaultCostume, LoanLine, PaperState, PersonPatch } from '@splk/api-contracts';
import { errorMessage } from '../../core/auth/error-messages';
import { PeopleStore } from './people.store';
import { PAPER_LABELS } from './people-page';

@Component({ selector: 'app-person-card-page', imports: [AttachmentGallery, ReactiveFormsModule, RouterLink, DatePipe], templateUrl: './person-card-page.html' })
export class PersonCardPage {
  protected readonly store = inject(PeopleStore);
  private readonly params = toSignal(inject(ActivatedRoute).paramMap);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly notice = signal('');
  protected readonly paperLabels = PAPER_LABELS;
  protected readonly identityForm = this.fb.group({ firstName: ['', Validators.required], lastName: ['', Validators.required], nickname: [''], contact: [''], defaultCostume: ['unspecified' as DefaultCostume] });
  protected readonly profileForm = this.fb.group({ paperState: ['' as '' | PaperState, Validators.required], note: [''] });
  constructor() {
    effect(() => {
      const id = Number(this.params()?.get('id')), unit = this.store.fund()?.unitId;
      untracked(() => { this.identityForm.reset(); this.profileForm.reset(); this.notice.set(''); if (id && unit) void this.store.openCard(id); });
    });
    effect(() => {
      const card = this.store.card();
      if (card) untracked(() => {
        if (!this.identityForm.dirty) this.identityForm.reset({ firstName: card.person.firstName, lastName: card.person.lastName, nickname: card.person.nickname ?? '', contact: card.person.contact ?? '', defaultCostume: card.person.defaultCostume });
        if (!this.profileForm.dirty) this.profileForm.reset({ paperState: card.profile?.paperState ?? '', note: card.profile?.note ?? '' });
      });
    });
  }
  protected loanGroups() {
    const groups = new Map<string, { label: string; entries: { loan: CostumeLoan; line: LoanLine }[] }>();
    for (const loan of this.store.card()?.openLoans.items ?? []) for (const line of loan.lines) if (!line.closedAt) {
      const label = `${line.region ?? 'Univerzální'} · ${line.gender === 'male' ? 'mužský kroj' : line.gender === 'female' ? 'ženský kroj' : 'pro oba kroje'}`;
      const group = groups.get(label) ?? { label, entries: [] }; group.entries.push({ loan, line }); groups.set(label, group);
    }
    return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label, 'cs'));
  }
  protected async refresh(): Promise<void> { this.identityForm.markAsPristine(); this.profileForm.markAsPristine(); const id = Number(this.params()?.get('id')); if (id) await this.store.openCard(id); }
  protected async saveIdentity(): Promise<void> {
    const card = this.store.card(), unit = this.store.fund()?.unitId;
    if (!card || this.identityForm.invalid) return;
    const values = this.identityForm.getRawValue();
    const patch = Object.fromEntries(Object.entries(values).filter(([key]) => this.identityForm.controls[key as keyof typeof values].dirty)) as PersonPatch;
    if (!Object.keys(patch).length) { this.notice.set('Údaje jsou beze změny.'); return; }
    try {
      await this.store.update(card.person.id, patch);
      if (this.store.fund()?.unitId === unit) { this.identityForm.markAsPristine(); await this.store.openCard(card.person.id); this.notice.set('Společné údaje osoby jsou uložené.'); }
    } catch (error) { if (this.store.fund()?.unitId === unit) this.notice.set(errorMessage(error)); }
  }
  protected async saveProfile(): Promise<void> {
    const card = this.store.card(), unit = this.store.fund()?.unitId, input = this.profileForm.getRawValue();
    if (!card || this.profileForm.invalid || !input.paperState) return;
    try {
      await this.store.profile(card.person.id, { paperState: input.paperState, note: input.note || null });
      if (this.store.fund()?.unitId === unit) { this.profileForm.markAsPristine(); await this.store.openCard(card.person.id); this.notice.set('Profil tohoto fondu je uložený. Fyzická kontrola ani předání kroje tím nevzniklo.'); }
    } catch (error) { if (this.store.fund()?.unitId === unit) this.notice.set(errorMessage(error)); }
  }
}

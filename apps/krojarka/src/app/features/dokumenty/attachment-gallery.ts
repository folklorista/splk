import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, effect, ElementRef, inject, input, signal, untracked, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Attachment, AttachmentKind, AttachmentOwnerType } from '@splk/api-contracts';
import { MOCK_DATA } from '../../data/api-config';
import { ATTACHMENT_KINDS } from '../../data/attachments/attachment-kinds';
import { AttachmentOwnersStore } from './attachment-owners.store';
import { AttachmentsStore } from './attachments.store';

export const DOCUMENT_KINDS: Record<AttachmentKind, string> = { person_card: 'Osobní krojová karta', kit_card: 'Karta kompletu', kit_label: 'Lístek kompletu', series_card: 'Karta řady', loan_book: 'Kniha zápůjček', loose_slip: 'Volný lístek', item_photo: 'Fotografie součástky', check_photo: 'Fotografie z kontroly' };
export const DOCUMENT_OWNERS: Record<AttachmentOwnerType, string> = { person: 'Osoba', item: 'Součástka', kit: 'Komplet', series: 'Evidenční řada', inventory_check: 'Inventurní kontrola', archive: 'Dokumenty fondu' };

@Component({ selector: 'app-attachment-gallery', imports: [ReactiveFormsModule, DatePipe, DecimalPipe], providers: [AttachmentsStore, AttachmentOwnersStore],
  templateUrl: './attachment-gallery.html', styleUrl: './attachment-gallery.css' })
export class AttachmentGallery {
  readonly ownerType = input<AttachmentOwnerType>();
  readonly ownerId = input<number>();
  readonly title = input('Přílohy a skeny');
  protected readonly store = inject(AttachmentsStore);
  protected readonly owners = inject(AttachmentOwnersStore);
  protected readonly mock = inject(MOCK_DATA);
  protected readonly labels = DOCUMENT_KINDS;
  protected readonly ownerLabels = DOCUMENT_OWNERS;
  protected readonly ownerTypes = Object.keys(DOCUMENT_OWNERS) as AttachmentOwnerType[];
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly files = signal<File[]>([]);
  protected readonly editing = signal<Attachment | null>(null);
  protected readonly confirmed = signal(false);
  protected readonly uploadError = signal('');
  protected readonly fixed = computed(() => !!this.ownerType() && !!this.ownerId());
  protected readonly form = this.fb.group({ ownerType: ['archive' as AttachmentOwnerType], ownerId: [0, Validators.min(1)], kind: ['loan_book' as AttachmentKind], page: [1, [Validators.min(1), Validators.max(2147483647)]], caption: [''], originalDate: [''] });
  protected readonly editForm = this.fb.group({ page: [1, Validators.min(1)], caption: [''], originalDate: [''] });
  protected readonly kinds = signal<readonly AttachmentKind[]>(ATTACHMENT_KINDS.archive);
  protected readonly natural = signal({ width: 1, height: 1 });
  protected readonly viewport = viewChild<ElementRef<HTMLElement>>('viewport');
  protected readonly viewportWidth = signal(640);
  protected readonly imageBox = computed(() => {
    const v = this.store.viewer(), n = this.natural(), quarter = (v?.rotation ?? 0) % 180 !== 0;
    const width = quarter ? n.height : n.width, height = quarter ? n.width : n.height;
    const scale = Math.min(1, Math.max(1, this.viewportWidth() - 24) / width) * (v?.zoom ?? 1);
    return { width: width * scale, height: height * scale, imageWidth: n.width * scale, imageHeight: n.height * scale };
  });
  protected readonly dialog = viewChild<ElementRef<HTMLElement>>('dialog');
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  constructor() {
    effect((cleanup) => {
      const dialog = this.dialog()?.nativeElement;
      if (!dialog) return;
      const previous = document.activeElement;
      queueMicrotask(() => { if (dialog.isConnected) dialog.querySelector<HTMLElement>('button')?.focus(); });
      cleanup(() => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); });
    });
    effect(() => {
      const type = this.ownerType(), id = this.ownerId(), fund = this.store.fund();
      untracked(() => {
        this.files.set([]); this.editing.set(null); this.confirmed.set(false); this.uploadError.set('');
        const field = this.fileInput(); if (field) field.nativeElement.value = '';
        this.store.setOwner(type && id ? { ownerType: type, ownerId: id } : null);
        this.form.reset({ ownerType: type ?? 'archive', ownerId: id ?? fund?.unitId ?? 0, kind: ATTACHMENT_KINDS[type ?? 'archive'][0], page: 1, caption: '', originalDate: '' });
        this.kinds.set(ATTACHMENT_KINDS[type ?? 'archive']);
        if (!type) void this.owners.load('archive');
      });
    });
    effect((cleanup) => {
      const viewport = this.viewport()?.nativeElement;
      if (!viewport) return;
      this.viewportWidth.set(viewport.clientWidth || 640);
      if (typeof ResizeObserver !== 'undefined') {
        const observer = new ResizeObserver(() => this.viewportWidth.set(viewport.clientWidth || 640)); observer.observe(viewport); cleanup(() => observer.disconnect());
      }
    });
  }
  protected async typeChanged(): Promise<void> {
    const type = this.form.controls.ownerType.value; this.kinds.set(ATTACHMENT_KINDS[type]); this.form.controls.kind.setValue(ATTACHMENT_KINDS[type][0]);
    this.form.controls.ownerId.setValue(type === 'archive' ? this.store.fund()?.unitId ?? 0 : 0); await this.owners.load(type);
  }
  protected chooseFiles(event: Event): void { this.files.set(Array.from((event.target as HTMLInputElement).files ?? [])); this.uploadError.set(''); }
  protected async upload(): Promise<void> {
    const unit = this.store.fund()?.unitId, context = this.store.contextKey(); if (!unit || this.form.invalid || !this.files().length) return;
    const values = this.form.getRawValue(), pending = [...this.files()]; let page = values.page;
    for (const file of pending) {
      const result = await this.store.upload(file, { ...values, unitId: unit, page, caption: values.caption || null, originalDate: values.originalDate || null });
      if (this.store.contextKey() !== context) return;
      if (!result) { this.uploadError.set('Nahrávání se zastavilo. Uložené přílohy zůstaly zachované; nenahrané soubory můžete zkusit znovu.'); return; }
      this.files.update((files) => files.filter((f) => f !== file)); page++; this.form.controls.page.setValue(page);
    }
    this.form.controls.page.setValue(page); const field = this.fileInput(); if (field) field.nativeElement.value = '';
  }
  protected edit(row: Attachment): void { this.editing.set(structuredClone(row)); this.editForm.reset({ page: row.page, caption: row.caption ?? '', originalDate: row.originalDate ?? '' }); }
  protected async save(): Promise<void> {
    const row = this.editing(), context = this.store.contextKey(); if (!row || this.editForm.invalid) return;
    const value = this.editForm.getRawValue(); const result = await this.store.save(row.id, { version: row.version, page: value.page, caption: value.caption || null, originalDate: value.originalDate || null });
    if (result && this.store.contextKey() === context) this.editing.set(null);
  }
  protected imageLoaded(event: Event): void { const image = event.target as HTMLImageElement; this.natural.set({ width: image.naturalWidth || 1, height: image.naturalHeight || 1 }); }
  protected trapFocus(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;
    const controls = this.dialog()?.nativeElement.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input:not(:disabled), [tabindex="0"]');
    if (!controls?.length) return;
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  protected async purge(): Promise<void> { if (await this.store.purgeExported(this.confirmed())) this.confirmed.set(false); }
}

import { computed, DestroyRef, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Attachment, AttachmentOwnerType, AttachmentVersion, UpdateAttachmentRequest, UploadAttachmentRequest } from '@splk/api-contracts';
import { FundContext } from '../../core/fund/fund-context';
import { errorMessage } from '../../core/auth/error-messages';
import { ApiError } from '../../data/api-error';
import { AttachmentsApi } from '../../data/attachments/attachments-api';

export interface DocumentOwner { ownerType: AttachmentOwnerType; ownerId: number }
export interface AttachmentViewer { row: Attachment; url: string; rotation: number; zoom: number }

/** Per-gallery state; shared adapters own data, this service owns requests and temporary browser URLs. */
@Injectable()
export class AttachmentsStore {
  private readonly api = inject(AttachmentsApi);
  readonly fund = inject(FundContext).current;
  readonly canManage = computed(() => this.fund()?.canManage ?? false);
  readonly owner = signal<DocumentOwner | null | undefined>(undefined);
  readonly contextKey = computed(() => `${this.fund()?.unitId ?? ''}:${this.owner()?.ownerType ?? ''}:${this.owner()?.ownerId ?? ''}`);
  readonly rows = signal<Attachment[]>([]);
  readonly history = signal(false);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly notice = signal('');
  readonly page = signal(0);
  readonly visible = computed(() => this.rows().slice(this.page() * 20, this.page() * 20 + 20));
  readonly thumbnails = signal<ReadonlyMap<string, string>>(new Map());
  readonly viewer = signal<AttachmentViewer | null>(null);
  readonly viewerLoading = signal(false);
  readonly selected = signal<ReadonlySet<string>>(new Set());
  readonly receipt = signal<{ id: string; unit: number; attachments: AttachmentVersion[] } | null>(null);
  private generation = 0;
  private request = 0;
  private viewerRequest = 0;
  private readonly urls = new Set<string>();
  private readonly thumbnailRequests = new Set<string>();

  constructor() {
    effect(() => {
      this.fund(); this.owner();
      untracked(() => {
        this.generation++; this.request++; this.viewerRequest++; this.clearUrls(); this.rows.set([]); this.selected.set(new Set()); this.receipt.set(null);
        this.error.set(null); this.notice.set(''); this.busy.set(false); this.loading.set(false); this.page.set(0);
        if (this.fund() && this.owner() !== undefined) void this.load();
      });
    });
    effect(() => {
      const rows = this.visible(); const generation = this.generation;
      untracked(() => {
        const thumbnails = new Map(this.thumbnails());
        for (const [id, url] of thumbnails) if (!rows.some((r) => r.id === id && r.hasThumbnail && !r.purgedAt)) { this.revoke(url); thumbnails.delete(id); }
        this.thumbnails.set(thumbnails);
        for (const row of rows) if (row.hasThumbnail && !row.purgedAt) void this.thumbnail(row, generation);
      });
    });
    inject(DestroyRef).onDestroy(() => { this.generation++; this.request++; this.viewerRequest++; this.clearUrls(); });
  }
  setOwner(owner: DocumentOwner | null): void { this.owner.set(owner); }
  async load(): Promise<void> {
    const unit = this.fund()?.unitId, owner = this.owner(), generation = this.generation, request = ++this.request;
    if (!unit || owner === undefined) return;
    this.loading.set(true); this.error.set(null);
    try {
      const rows: Attachment[] = []; let total = 0;
      do {
        const page = await firstValueFrom(this.api.list({ unitId: unit, ...owner, archived: this.history(), purged: this.history(), limit: 200, offset: rows.length }));
        total = page.total;
        if (!this.current(unit, generation) || request !== this.request) return;
        if (page.items.some((a) => a.unitId !== unit || owner && (a.ownerType !== owner.ownerType || a.ownerId !== owner.ownerId))) throw new ApiError(404, 'not_found');
        if (!page.items.length && rows.length < total) throw new ApiError(500, 'internal_error');
        rows.push(...page.items);
      } while (rows.length < total);
      if (new Set(rows.map((r) => r.id)).size !== rows.length) throw new ApiError(409, 'version_conflict');
      if (this.current(unit, generation) && request === this.request) {
        this.rows.set(rows); this.page.set(Math.min(this.page(), Math.max(0, Math.ceil(rows.length / 20) - 1)));
        this.selected.set(new Set([...this.selected()].filter((id) => rows.some((r) => r.id === id && !r.purgedAt))));
      }
    } catch (error) { if (this.current(unit, generation) && request === this.request) this.error.set(errorMessage(error)); }
    finally { if (this.current(unit, generation) && request === this.request) this.loading.set(false); }
  }
  async showHistory(value: boolean): Promise<void> { this.history.set(value); this.page.set(0); await this.load(); }
  select(id: string, value: boolean): void {
    if (this.busy() || !this.rows().some((r) => r.id === id && !r.purgedAt)) return;
    const selected = new Set(this.selected()); value ? selected.add(id) : selected.delete(id); this.selected.set(selected);
  }
  async upload(file: File, input: UploadAttachmentRequest): Promise<Attachment | null> {
    return this.mutate(async (unit) => {
      const owner = this.owner();
      if (input.unitId !== unit || owner && (owner.ownerType !== input.ownerType || owner.ownerId !== input.ownerId)) throw new ApiError(404, 'not_found');
      return firstValueFrom(this.api.upload(file, input));
    }, 'Příloha je uložená.');
  }
  async save(id: string, input: UpdateAttachmentRequest): Promise<Attachment | null> {
    return this.mutate(async (unit) => { this.inScope(id, unit); return firstValueFrom(this.api.update(id, input)); }, 'Metadata jsou uložená.', true, true);
  }
  async archive(id: string, version: number): Promise<Attachment | null> {
    return this.mutate(async (unit) => { this.inScope(id, unit); return firstValueFrom(this.api.archive(id, version)); }, 'Příloha je archivovaná; soubor zatím zůstává dostupný.', true, true);
  }
  async exportSelected(): Promise<boolean> {
    const generation = this.generation;
    const result = await this.mutate(async (unit) => {
      const attachments = this.rows().filter((r) => this.selected().has(r.id) && !r.purgedAt).map(({ id, version }) => ({ id, version }));
      if (!attachments.length) throw new ApiError(422, 'validation_failed', { reason: 'required' });
      const exported = await firstValueFrom(this.api.export(unit, { attachments }));
      return { ...exported, unit, attachments };
    }, 'Stažení ZIP bylo zahájeno. Před odstraněním ověřte jeho uložení do digiarchivu mimo aplikaci.', false);
    if (!result || !this.current(result.unit, generation)) return false;
    this.downloadBlob(result.file, `krojove-podklady-${result.id}.zip`);
    this.receipt.set({ id: result.id, unit: result.unit, attachments: result.attachments }); return true;
  }
  async purgeExported(confirmed: boolean): Promise<boolean> {
    const receipt = this.receipt(), generation = this.generation;
    const result = await this.mutate(async (unit) => {
      if (!receipt || receipt.unit !== unit || !confirmed) throw new ApiError(422, 'attachment_export_required');
      return firstValueFrom(this.api.purge(unit, { exportId: receipt.id, attachments: receipt.attachments, confirmArchived: true }));
    }, 'Obsah exportovaných příloh je odstraněný; metadata zůstávají dohledatelná.');
    if (!result || !receipt || !this.current(receipt.unit, generation)) return false;
    this.closeViewer(); this.receipt.set(null); this.selected.set(new Set()); return true;
  }
  async open(id: string): Promise<void> {
    const unit = this.fund()?.unitId, generation = this.generation; if (!unit) return;
    this.closeViewer(); const request = ++this.viewerRequest; this.viewerLoading.set(true); this.error.set(null);
    try {
      const row = this.inScope(id, unit);
      if (row.purgedAt) throw new ApiError(410, 'attachment_purged');
      const blob = await firstValueFrom(this.api.content(id));
      if (this.current(unit, generation) && request === this.viewerRequest) {
        if (row.mime === 'application/pdf') this.downloadBlob(blob, `${row.id}.pdf`);
        else this.viewer.set({ row, url: this.url(blob), rotation: 0, zoom: 1 });
      }
    } catch (error) { if (this.current(unit, generation) && request === this.viewerRequest) this.error.set(errorMessage(error)); }
    finally { if (this.current(unit, generation) && request === this.viewerRequest) this.viewerLoading.set(false); }
  }
  closeViewer(): void { this.viewerRequest++; const viewer = this.viewer(); if (viewer) this.revoke(viewer.url); this.viewer.set(null); this.viewerLoading.set(false); }
  rotate(): void { this.viewer.update((v) => v ? { ...v, rotation: (v.rotation + 90) % 360 } : null); }
  zoom(delta: number): void { this.viewer.update((v) => v ? { ...v, zoom: Math.max(0.25, Math.min(5, v.zoom + delta)) } : null); }
  async step(delta: number): Promise<void> {
    const images = this.rows().filter((r) => !r.purgedAt && r.mime !== 'application/pdf'); const at = images.findIndex((r) => r.id === this.viewer()?.row.id);
    if (at >= 0 && images[at + delta]) await this.open(images[at + delta].id);
  }
  private async thumbnail(row: Attachment, generation: number): Promise<void> {
    if (this.thumbnails().has(row.id) || this.thumbnailRequests.has(row.id)) return;
    this.thumbnailRequests.add(row.id);
    try {
      const blob = await firstValueFrom(this.api.content(row.id, true));
      if (this.current(row.unitId, generation) && this.visible().some((r) => r.id === row.id && !r.purgedAt)) {
        const urls = new Map(this.thumbnails()); urls.set(row.id, this.url(blob)); this.thumbnails.set(urls);
      }
    } catch { /* A failed thumbnail never hides metadata; opening the original reports its own error. */ }
    finally { if (generation === this.generation) this.thumbnailRequests.delete(row.id); }
  }
  private async mutate<T>(work: (unit: number) => Promise<T>, notice: string, reload = true, invalidateExport = false): Promise<T | null> {
    const fund = this.fund(), generation = this.generation;
    if (!fund || !fund.canManage || this.busy()) { this.error.set(errorMessage(new ApiError(403, 'forbidden'))); return null; }
    this.busy.set(true); this.error.set(null); this.notice.set('');
    try {
      const result = await work(fund.unitId);
      if (!this.current(fund.unitId, generation)) return null;
      this.notice.set(notice); if (invalidateExport) this.receipt.set(null); if (reload) await this.load();
      return this.current(fund.unitId, generation) ? result : null;
    } catch (error) { if (this.current(fund.unitId, generation)) this.error.set(errorMessage(error)); return null; }
    finally { if (this.current(fund.unitId, generation)) this.busy.set(false); }
  }
  private inScope(id: string, unit: number): Attachment { const row = this.rows().find((r) => r.id === id && r.unitId === unit); if (!row) throw new ApiError(404, 'not_found'); return row; }
  private current(unit: number, generation: number): boolean { return this.generation === generation && this.fund()?.unitId === unit; }
  private url(blob: Blob): string { const url = URL.createObjectURL(blob); this.urls.add(url); return url; }
  private revoke(url: string): void { URL.revokeObjectURL(url); this.urls.delete(url); }
  private clearUrls(): void { for (const url of this.urls) URL.revokeObjectURL(url); this.urls.clear(); this.thumbnailRequests.clear(); this.thumbnails.set(new Map()); this.viewer.set(null); }
  private downloadBlob(blob: Blob, name: string): void {
    const url = this.url(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click();
    setTimeout(() => { if (this.urls.has(url)) this.revoke(url); }, 60000);
  }
}

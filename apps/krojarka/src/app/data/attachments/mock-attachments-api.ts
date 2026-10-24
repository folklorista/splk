import { ATTACHMENT_KINDS } from './attachment-kinds';
import { inject, Injectable } from '@angular/core';
import { defer, firstValueFrom, from, Observable } from 'rxjs';
import { Attachment, AttachmentExport, AttachmentKind, AttachmentListQuery, AttachmentOwnerType, ExportAttachmentsRequest, PurgeAttachmentsRequest, UpdateAttachmentRequest, UploadAttachmentRequest } from '@splk/api-contracts';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../api-error';
import { CatalogApi } from '../catalog/catalog-api';
import { InventoryApi } from '../inventory/inventory-api';
import { OrganizationApi } from '../organization/organization-api';
import { AttachmentsApi } from './attachments-api';
import { sanitizeMockFile, storedZip } from './attachment-binary';

/** Synthetic session-only files. Existing mock identities/physical entities remain the source of owners. */
@Injectable()
export class MockAttachmentsApi extends AttachmentsApi {
  private readonly auth = inject(AuthService);
  private readonly organization = inject(OrganizationApi);
  private readonly inventory = inject(InventoryApi);
  private readonly catalog = inject(CatalogApi);
  private readonly rows: Attachment[] = [];
  private readonly files = new Map<string, { content: Blob; thumbnail: Blob | null }>();
  private readonly exports = new Map<string, { unit: number; manifest: Attachment[] }>();
  private queue: Promise<unknown> = Promise.resolve();

  list(query: AttachmentListQuery) { return this.run(async () => {
    only(query, ['unitId', 'ownerType', 'ownerId', 'archived', 'purged', 'limit', 'offset']);
    await this.access(query.unitId, false);
    if (query.ownerType !== undefined || query.ownerId !== undefined) await this.owner(query.unitId, query.ownerType, query.ownerId);
    const limit = query.limit ?? 50, offset = query.offset ?? 0;
    if (!Number.isInteger(limit) || limit < 1 || limit > 200 || !Number.isInteger(offset) || offset < 0) throw invalid('limit');
    const rows = this.rows.filter((a) => a.unitId === query.unitId && (!query.ownerType || a.ownerType === query.ownerType && a.ownerId === query.ownerId)
      && (query.archived || !a.archivedAt) && (query.purged || !a.purgedAt)).sort((a, b) => a.page - b.page || a.uploadedAt.localeCompare(b.uploadedAt) || a.id.localeCompare(b.id));
    return { items: structuredClone(rows.slice(offset, offset + limit)), total: rows.length };
  }); }
  metadata(id: string) { return this.run(async () => { const row = await this.accessible(id, false); return structuredClone(row); }); }
  upload(file: File, input: UploadAttachmentRequest) { return this.run(async () => {
    only(input, ['unitId', 'ownerType', 'ownerId', 'kind', 'page', 'caption', 'originalDate']);
    await this.access(input.unitId, true); const metadata = this.values(input); await this.owner(input.unitId, metadata.ownerType, metadata.ownerId);
    const actor = this.auth.user()?.account.id; if (!actor) throw new ApiError(401, 'unauthenticated');
    this.quota(input.unitId, metadata.ownerType, metadata.ownerId);
    if (file.size > 10485760) throw new ApiError(413, 'file_too_large');
    let prepared: ReturnType<typeof sanitizeMockFile>;
    try { prepared = sanitizeMockFile(new Uint8Array(await file.arrayBuffer())); } catch { throw new ApiError(422, 'invalid_file'); }
    const content = new Blob([prepared.content], { type: prepared.mime });
    const thumbnail = prepared.mime === 'application/pdf' ? null : await this.thumbnail(content);
    const digest = await crypto.subtle.digest('SHA-256', prepared.content);
    const row: Attachment = { ...metadata, unitId: input.unitId, id: crypto.randomUUID(), mime: prepared.mime, size: prepared.content.length,
      sha256: Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join(''), hasThumbnail: thumbnail !== null,
      uploadedBy: actor, uploadedAt: new Date().toISOString(), archivedAt: null, purgedAt: null, version: 1 };
    // Recheck after asynchronous decoding: a logout must not finish an upload under a new account.
    await this.access(input.unitId, true);
    if (this.auth.user()!.account.id !== row.uploadedBy) throw new ApiError(401, 'unauthenticated');
    this.rows.push(row); this.files.set(row.id, { content, thumbnail }); return structuredClone(row);
  }); }
  update(id: string, input: UpdateAttachmentRequest) { return this.run(async () => {
    only(input, ['version', 'ownerType', 'ownerId', 'kind', 'page', 'caption', 'originalDate']);
    const row = await this.accessible(id, true); this.editable(row, input.version);
    if ((input.ownerType !== undefined) !== (input.ownerId !== undefined)) throw invalid('ownerId');
    const metadata = this.values({ ...row, ...input }); await this.owner(row.unitId, metadata.ownerType, metadata.ownerId);
    if (row.ownerType !== metadata.ownerType || row.ownerId !== metadata.ownerId) this.quota(row.unitId, metadata.ownerType, metadata.ownerId);
    Object.assign(row, metadata, { version: row.version + 1 }); return structuredClone(row);
  }); }
  archive(id: string, version: number) { return this.run(async () => {
    const row = await this.accessible(id, true); this.editable(row, version);
    row.archivedAt ??= new Date().toISOString(); row.version++; return structuredClone(row);
  }); }
  content(id: string, thumbnail = false) { return this.run(async () => {
    const row = await this.accessible(id, false); if (row.purgedAt) throw new ApiError(410, 'attachment_purged');
    const files = this.files.get(id); const blob = thumbnail ? files?.thumbnail : files?.content;
    if (!blob) throw new ApiError(404, 'not_found'); return blob;
  }); }
  export(unit: number, input: ExportAttachmentsRequest): Observable<AttachmentExport> { return this.run(async () => {
    only(input, ['attachments']);
    await this.access(unit, true); const rows = await this.selected(unit, input); const manifest = structuredClone(rows);
    if (rows.reduce((sum, row) => sum + row.size, 0) > 52428800) throw new ApiError(413, 'file_too_large');
    const entries: { name: string; content: Uint8Array }[] = [];
    for (const row of rows) entries.push({ name: row.id + (row.mime === 'application/pdf' ? '.pdf' : row.mime === 'image/png' ? '.png' : '.jpg'), content: new Uint8Array(await this.files.get(row.id)!.content.arrayBuffer()) });
    entries.push({ name: 'manifest.json', content: new TextEncoder().encode(JSON.stringify(manifest, null, 2)) });
    const file = new Blob([storedZip(entries)], { type: 'application/zip' }), id = crypto.randomUUID();
    await this.access(unit, true); this.exports.set(id, { unit, manifest }); return { id, file };
  }); }
  purge(unit: number, input: PurgeAttachmentsRequest) { return this.run(async () => {
    only(input, ['attachments', 'exportId', 'confirmArchived']);
    await this.access(unit, true);
    if (input.confirmArchived !== true || !isUuid(input.exportId)) throw new ApiError(422, 'attachment_export_required');
    const receipt = this.exports.get(input.exportId); if (!receipt || receipt.unit !== unit) throw new ApiError(404, 'not_found');
    this.validateEntries(input); const rows: Attachment[] = [];
    for (const entry of input.attachments) {
      const row = await this.accessible(entry.id, true); if (row.unitId !== unit) throw new ApiError(404, 'not_found');
      const exported = receipt.manifest.find((a) => a.id === row.id);
      if (!exported || exported.version !== entry.version || exported.sha256 !== row.sha256) throw new ApiError(422, 'attachment_export_required');
      this.version(row, entry.version + (row.purgedAt ? 1 : 0)); rows.push(row);
    }
    for (const row of rows) {
      if (!row.purgedAt) { row.archivedAt ??= new Date().toISOString(); row.purgedAt = new Date().toISOString(); row.version++; row.hasThumbnail = false; }
      this.files.delete(row.id);
    }
    return { items: structuredClone(rows) };
  }); }

  private async selected(unit: number, input: ExportAttachmentsRequest): Promise<Attachment[]> {
    this.validateEntries(input); const result: Attachment[] = [];
    for (const entry of [...input.attachments].sort((a, b) => a.id.localeCompare(b.id))) {
      const row = await this.accessible(entry.id, true); if (row.unitId !== unit) throw new ApiError(404, 'not_found');
      this.editable(row, entry.version); result.push(row);
    }
    return result;
  }
  private validateEntries(input: ExportAttachmentsRequest): void {
    if (!Array.isArray(input.attachments) || !input.attachments.length || input.attachments.length > 100 || new Set(input.attachments.map((a) => a.id)).size !== input.attachments.length) throw invalid('attachments');
    for (const entry of input.attachments) { only(entry, ['id', 'version']); if (!isUuid(entry.id) || !Number.isInteger(entry.version) || entry.version < 1) throw invalid('attachments'); }
  }
  private version(row: Attachment, version: number): void { if (!Number.isInteger(version) || version < 1) throw invalid('version'); if (row.version !== version) throw new ApiError(409, 'version_conflict', { version: row.version }); }
  private editable(row: Attachment, version: number): void { this.version(row, version); if (row.purgedAt) throw new ApiError(410, 'attachment_purged'); }
  private quota(unit: number, type: AttachmentOwnerType, id: number): void { if (this.rows.filter((r) => r.unitId === unit && r.ownerType === type && r.ownerId === id && !r.purgedAt).length >= 100) throw new ApiError(422, 'attachment_limit'); }
  private async accessible(id: string, write: boolean): Promise<Attachment> { const row = this.rows.find((r) => r.id === id); if (!row) throw new ApiError(404, 'not_found'); await this.access(row.unitId, write); return row; }
  private async access(unit: number, write: boolean): Promise<void> {
    const user = this.auth.user(); if (!user) throw new ApiError(401, 'unauthenticated');
    const units = await firstValueFrom(this.organization.units());
    const manage = user.mandates.some((m) => m.kind === 'costumes.manage' && (m.scopeType === 'organization' || m.scopeId === unit));
    const view = manage || user.mandates.some((m) => m.kind === 'costumes.view' && (m.scopeType === 'organization' || m.scopeId === unit));
    if (!view || !units.some((u) => u.id === unit && u.hasCostumeFund && !u.archived)) throw new ApiError(404, 'not_found');
    if (write && !manage) throw new ApiError(403, 'forbidden');
  }
  private async owner(unit: number, type: AttachmentOwnerType | undefined, id: number | undefined): Promise<void> {
    if (!type || !Object.hasOwn(ATTACHMENT_KINDS, type) || !Number.isInteger(id) || !id || id < 1) throw invalid('ownerId');
    if (type === 'archive') { if (id !== unit) throw new ApiError(404, 'not_found'); return; }
    if (type === 'person') { if (!(await firstValueFrom(this.organization.persons())).some((p) => p.id === id)) throw new ApiError(404, 'not_found'); return; }
    if (type === 'series') { if (!(await firstValueFrom(this.catalog.series(unit))).some((s) => s.id === id)) throw new ApiError(404, 'not_found'); return; }
    if (type === 'item' || type === 'kit') {
      const row = type === 'item' ? await firstValueFrom(this.inventory.item(id)) : await firstValueFrom(this.inventory.kit(id));
      if (row.unitId !== unit) throw new ApiError(404, 'not_found'); return;
    }
    for (let offset = 0; ; offset += 200) {
      const page = await firstValueFrom(this.inventory.inventories(unit, { limit: 200, offset }));
      for (const inventory of page.items) {
        for (let start = 0; ; start += 200) {
          const checks = await firstValueFrom(this.inventory.inventoryCollection(inventory.id, 'checks', { limit: 200, offset: start }));
          if (checks.items.some((c) => c.id === id)) return;
          if (start + checks.items.length >= checks.total || !checks.items.length) break;
        }
      }
      if (offset + page.items.length >= page.total || !page.items.length) break;
    }
    throw new ApiError(404, 'not_found');
  }
  private values(input: UploadAttachmentRequest): Pick<Attachment, 'ownerType' | 'ownerId' | 'kind' | 'page' | 'caption' | 'originalDate'> {
    if (!Object.hasOwn(ATTACHMENT_KINDS, input.ownerType) || !ATTACHMENT_KINDS[input.ownerType].includes(input.kind)) throw invalid('kind');
    if (!Number.isInteger(input.ownerId) || input.ownerId < 1) throw invalid('ownerId');
    const page = input.page ?? 1; if (!Number.isInteger(page) || page < 1 || page > 2147483647) throw invalid('page');
    if (input.caption !== undefined && input.caption !== null && (typeof input.caption !== 'string' || Array.from(input.caption).length > 2000)) throw invalid('caption');
    if (input.originalDate !== undefined && input.originalDate !== null && typeof input.originalDate !== 'string') throw invalid('originalDate');
    const originalDate = input.originalDate?.trim() || null;
    if (originalDate && (!/^\d{4}-\d{2}-\d{2}$/.test(originalDate) || Number.isNaN(Date.parse(originalDate)) || new Date(originalDate).toISOString().slice(0, 10) !== originalDate)) throw invalid('originalDate');
    return { ownerType: input.ownerType, ownerId: input.ownerId, kind: input.kind, page, caption: input.caption?.trim() || null, originalDate };
  }
  private async thumbnail(content: Blob): Promise<Blob | null> {
    if (typeof createImageBitmap !== 'function') return null;
    try {
      const image = await createImageBitmap(content);
      try {
        const ratio = Math.min(1, 480 / Math.max(image.width, image.height)); const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * ratio)); canvas.height = Math.max(1, Math.round(image.height * ratio));
        const context = canvas.getContext('2d'); if (!context) return null;
        context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height);
        return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
      } finally { image.close(); }
    } catch { throw new ApiError(422, 'invalid_file'); }
  }
  private run<T>(work: () => T | Promise<T>): Observable<T> {
    return defer(() => { const task = this.queue.then(work); this.queue = task.catch(() => undefined); return from(task); });
  }
}
function invalid(field: string): ApiError { return new ApiError(422, 'validation_failed', { field, reason: 'invalid' }); }
function isUuid(value: unknown): value is string { return typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value); }
function only(input: object, allowed: string[]): void { for (const field of Object.keys(input)) if (!allowed.includes(field)) throw new ApiError(422, 'validation_failed', { field, reason: 'not_allowed' }); }

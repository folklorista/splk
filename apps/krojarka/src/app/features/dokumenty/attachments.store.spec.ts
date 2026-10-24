import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { Attachment } from '@splk/api-contracts';
import { Fund, FundContext } from '../../core/fund/fund-context';
import { ApiError } from '../../data/api-error';
import { AttachmentsApi } from '../../data/attachments/attachments-api';
import { AttachmentsStore } from './attachments.store';

const row = (id = 1, unitId = 1): Attachment => ({ id: `30000000-0000-4000-8000-${String(id).padStart(12, '0')}`, unitId, ownerType: 'person', ownerId: 3,
  kind: 'person_card', mime: 'image/jpeg', size: 123, sha256: 'a'.repeat(64), hasThumbnail: false, page: id, caption: null, originalDate: null,
  uploadedBy: 1, uploadedAt: '2026-10-24T12:00:00Z', archivedAt: null, purgedAt: null, version: 1 });
describe('AttachmentsStore', () => {
  let store: AttachmentsStore, fund: ReturnType<typeof signal<Fund | null>>, api: Record<string, ReturnType<typeof vi.fn>>;
  let url = 0;
  beforeEach(() => {
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:test-${++url}`); vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    fund = signal<Fund | null>({ unitId: 1, name: 'Vonica', canManage: true });
    api = { list: vi.fn(() => of({ items: [row()], total: 1 })), content: vi.fn(() => of(new Blob(['image']))), upload: vi.fn(() => of(row())),
      update: vi.fn(() => of({ ...row(), version: 2 })), archive: vi.fn(() => of({ ...row(), version: 2 })),
      export: vi.fn(() => of({ id: 'receipt', file: new Blob(['zip']) })), purge: vi.fn(() => of({ items: [{ ...row(), version: 2, purgedAt: 'now' }] })) };
    TestBed.configureTestingModule({ providers: [AttachmentsStore, { provide: FundContext, useValue: { current: fund } }, { provide: AttachmentsApi, useValue: api }] });
    store = TestBed.inject(AttachmentsStore); store.setOwner({ ownerType: 'person', ownerId: 3 }); TestBed.tick();
  });
  afterEach(() => { TestBed.resetTestingModule(); vi.restoreAllMocks(); });
  const loaded = async () => { await vi.waitFor(() => expect(store.loading()).toBe(false)); TestBed.tick(); };

  it('loads all metadata pages and keeps owner/fund filters on each request', async () => {
    await loaded(); api['list'].mockImplementation((q) => of({ items: [row(q.offset ? 2 : 1)], total: 2 }));
    await store.load(); expect(store.rows().map((a) => a.page)).toEqual([1, 2]);
    expect(api['list']).toHaveBeenLastCalledWith(expect.objectContaining({ unitId: 1, ownerType: 'person', ownerId: 3, limit: 200, offset: 1 }));
  });
  it('ignores late lists and uploads after a fund change without clearing a new fund state', async () => {
    await loaded(); const delayed = new Subject<{ items: Attachment[]; total: number }>(); api['list'].mockReturnValueOnce(delayed);
    const pending = store.load(); fund.set({ unitId: 2, name: 'Other', canManage: true });
    api['list'].mockReturnValue(of({ items: [row(2, 2)], total: 1 })); TestBed.tick(); await loaded();
    delayed.next({ items: [row()], total: 1 }); delayed.complete(); await pending; expect(store.rows()[0].unitId).toBe(2);
    const upload = new Subject<Attachment>(); api['upload'].mockReturnValueOnce(upload);
    const sending = store.upload(new File(['file'], 'file.jpg'), { unitId: 2, ownerType: 'person', ownerId: 3, kind: 'person_card' });
    fund.set({ unitId: 1, name: 'Vonica', canManage: true }); api['list'].mockReturnValue(of({ items: [row()], total: 1 })); TestBed.tick(); await loaded();
    upload.next(row(3, 2)); upload.complete(); expect(await sending).toBeNull(); expect(store.rows()[0].unitId).toBe(1); expect(store.notice()).toBe('');
  });
  it('rejects returned foreign metadata and malformed partial pagination', async () => {
    await loaded(); api['list'].mockReturnValueOnce(of({ items: [row(1, 2)], total: 1 })); await store.load();
    expect(store.error()).toContain('přístup'); expect(store.rows()[0].unitId).toBe(1);
    api['list'].mockReturnValueOnce(of({ items: [], total: 1 })); await store.load(); expect(store.error()).not.toBeNull();
  });
  it('loads only visible thumbnails, then releases URLs on page changes and destruction', async () => {
    await loaded(); const rows = Array.from({ length: 25 }, (_, i) => ({ ...row(i + 1), hasThumbnail: true }));
    api['list'].mockReturnValue(of({ items: rows, total: 25 })); await store.load(); TestBed.tick();
    await vi.waitFor(() => expect(store.thumbnails().size).toBe(20)); expect(api['content']).toHaveBeenCalledTimes(20);
    store.page.set(1); TestBed.tick(); await vi.waitFor(() => expect(store.thumbnails().size).toBe(5));
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(20); TestBed.resetTestingModule(); expect(URL.revokeObjectURL).toHaveBeenCalledTimes(25);
  });
  it('keeps the current viewer when an earlier original finishes late and revokes it on close', async () => {
    await loaded(); api['list'].mockReturnValue(of({ items: [row(), row(2)], total: 2 })); await store.load();
    const old = new Subject<Blob>(); api['content'].mockReturnValueOnce(old);
    const pending = store.open(row().id); await store.open(row(2).id); expect(store.viewer()?.row.id).toBe(row(2).id);
    old.next(new Blob(['old'])); old.complete(); await pending; expect(store.viewer()?.row.id).toBe(row(2).id); expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    store.rotate(); store.zoom(0.5); expect(store.viewer()?.rotation).toBe(90); expect(store.viewer()?.zoom).toBe(1.5);
    store.closeViewer(); expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
  });
  it('allows viewing for readers but never calls a mutation endpoint', async () => {
    fund.set({ unitId: 1, name: 'Vonica', canManage: false }); TestBed.tick(); await loaded(); await store.open(row().id); expect(store.viewer()).not.toBeNull();
    expect(await store.save(row().id, { version: 1, caption: 'No' })).toBeNull(); expect(await store.exportSelected()).toBe(false);
    expect(api['update']).not.toHaveBeenCalled(); expect(api['export']).not.toHaveBeenCalled();
  });
  it('preserves the edit version and existing data on a conflict', async () => {
    await loaded(); api['update'].mockReturnValueOnce(throwError(() => new ApiError(409, 'version_conflict', { version: 2 })));
    expect(await store.save(row().id, { version: 1, caption: 'Draft' })).toBeNull();
    expect(api['update']).toHaveBeenCalledWith(row().id, { version: 1, caption: 'Draft' }); expect(store.rows()[0].version).toBe(1); expect(store.error()).toContain('rozepsané');
  });
  it('keeps an export receipt through an I/O failure and retries the original versions only after confirmation', async () => {
    await loaded(); store.select(row().id, true); expect(await store.exportSelected()).toBe(true);
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1); expect(store.receipt()?.attachments).toEqual([{ id: row().id, version: 1 }]);
    expect(await store.purgeExported(false)).toBe(false); expect(api['purge']).not.toHaveBeenCalled();
    api['purge'].mockReturnValueOnce(throwError(() => new ApiError(500, 'internal_error')));
    expect(await store.purgeExported(true)).toBe(false); expect(store.receipt()).not.toBeNull();
    api['list'].mockReturnValue(of({ items: [], total: 0 })); expect(await store.purgeExported(true)).toBe(true);
    expect(api['purge']).toHaveBeenLastCalledWith(1, { exportId: 'receipt', attachments: [{ id: row().id, version: 1 }], confirmArchived: true }); expect(store.receipt()).toBeNull();
  });
  it('does not download a late ZIP or retain its receipt after changing the owner', async () => {
    await loaded(); store.select(row().id, true); const delayed = new Subject<{ id: string; file: Blob }>(); api['export'].mockReturnValueOnce(delayed);
    const pending = store.exportSelected(); store.setOwner({ ownerType: 'person', ownerId: 4 }); api['list'].mockReturnValue(of({ items: [], total: 0 })); TestBed.tick();
    delayed.next({ id: 'old', file: new Blob(['old zip']) }); delayed.complete(); expect(await pending).toBe(false); expect(store.receipt()).toBeNull(); expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
  });
});

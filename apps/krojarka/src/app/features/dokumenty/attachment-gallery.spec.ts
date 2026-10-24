import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import type { Attachment } from '@splk/api-contracts';
import { FundContext } from '../../core/fund/fund-context';
import { AttachmentsApi } from '../../data/attachments/attachments-api';
import { MOCK_DATA } from '../../data/api-config';
import { ApiError } from '../../data/api-error';
import { AttachmentGallery } from './attachment-gallery';
import { AttachmentOwnersStore } from './attachment-owners.store';
import { AttachmentsStore } from './attachments.store';
const row: Attachment = { id: '30000000-0000-4000-8000-000000000001', unitId: 1, ownerType: 'person', ownerId: 3, kind: 'person_card', page: 1, caption: null, originalDate: null, mime: 'image/jpeg', size: 10, sha256: 'a'.repeat(64), hasThumbnail: false, uploadedAt: '2026-10-24T12:00:00Z', uploadedBy: 1, archivedAt: null, purgedAt: null, version: 1 };
describe('AttachmentGallery forms', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  beforeEach(async () => {
    api = { list: vi.fn(() => of({ items: [row], total: 1 })), upload: vi.fn(() => of(row)), update: vi.fn(() => throwError(() => new ApiError(409, 'version_conflict'))) };
    TestBed.configureTestingModule({ imports: [AttachmentGallery], providers: [{ provide: FundContext, useValue: { current: signal({ unitId: 1, name: 'Fund', canManage: true }) } }, { provide: AttachmentsApi, useValue: api }, { provide: MOCK_DATA, useValue: false }] });
    TestBed.overrideComponent(AttachmentGallery, { set: { providers: [AttachmentsStore, { provide: AttachmentOwnersStore, useValue: { load: vi.fn(async () => undefined), options: signal([]), loading: signal(false), error: signal('') } }] } });
    await TestBed.compileComponents();
  });
  async function fixture() { const f = TestBed.createComponent(AttachmentGallery); f.componentRef.setInput('ownerType', 'person'); f.componentRef.setInput('ownerId', 3); f.detectChanges(); await f.whenStable(); return f; }
  it('keeps failed files after a partially completed batch and increments page order only for saved files', async () => {
    const f = await fixture(), page = f.componentInstance;
    const files = [new File(['a'], 'a.jpg'), new File(['b'], 'b.jpg')];
    page['files'].set(files); api['upload'].mockReturnValueOnce(of(row)).mockReturnValueOnce(throwError(() => new ApiError(422, 'invalid_file')));
    await page['upload'](); expect(api['upload']).toHaveBeenCalledTimes(2); expect(api['upload'].mock.calls.map((c) => c[1].page)).toEqual([1, 2]);
    expect(page['files']()).toEqual([files[1]]); expect(page['uploadError']()).toContain('zastavilo'); f.destroy();
  });
  it('keeps the version captured at edit start and preserves the form on conflict', async () => {
    const f = await fixture(), page = f.componentInstance; page['edit'](row); page['editForm'].controls.caption.setValue('New caption');
    const store = f.debugElement.injector.get(AttachmentsStore); store.rows.set([{ ...row, version: 2 }]);
    await page['save'](); expect(api['update']).toHaveBeenCalledWith(row.id, expect.objectContaining({ version: 1, caption: 'New caption' })); expect(page['editing']()?.version).toBe(1); expect(page['editForm'].controls.caption.value).toBe('New caption'); f.destroy();
  });
});

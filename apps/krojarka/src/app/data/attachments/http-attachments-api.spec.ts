import { provideHttpClient, HttpHeaders } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../api-config';
import { HttpAttachmentsApi } from './http-attachments-api';

describe('HttpAttachmentsApi', () => {
  let api: HttpAttachmentsApi, backend: HttpTestingController;
  const id = '30000000-0000-4000-8000-000000000001';
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), HttpAttachmentsApi, { provide: API_BASE_URL, useValue: '/v1' }] });
    api = TestBed.inject(HttpAttachmentsApi); backend = TestBed.inject(HttpTestingController);
  });
  afterEach(() => backend.verify());

  it('uses real multipart fields without manually supplying a boundary', async () => {
    const file = new File(['scan'], 'scan.jpg', { type: 'image/jpeg' });
    const pending = firstValueFrom(api.upload(file, { unitId: 2, ownerType: 'person', ownerId: 7, kind: 'person_card', caption: null, page: 1 }));
    const request = backend.expectOne('/v1/attachments'); const form = request.request.body as FormData;
    expect(form.get('file')).toBe(file); expect(form.get('unitId')).toBe('2'); expect(form.get('caption')).toBe('');
    expect(request.request.headers.has('Content-Type')).toBe(false); request.flush({ id }); expect(await pending).toEqual({ id });
  });
  it('keeps fund/owner/pagination filters and canonical metadata/archive paths', async () => {
    const pending = firstValueFrom(api.list({ unitId: 2, ownerType: 'person', ownerId: 7, archived: true, purged: false, offset: 200, limit: 200 }));
    const request = backend.expectOne((r) => r.url === '/v1/attachments');
    expect(request.request.params.get('unitId')).toBe('2'); expect(request.request.params.get('ownerId')).toBe('7');
    expect(request.request.params.get('purged')).toBe('false'); expect(request.request.params.get('offset')).toBe('200');
    request.flush({ items: [], total: 200 }); await pending;
    const update = firstValueFrom(api.update(id, { version: 3, caption: 'Current' }));
    const patch = backend.expectOne(`/v1/attachments/${id}`); expect(patch.request.method).toBe('PATCH'); expect(patch.request.body.version).toBe(3); patch.flush({ id }); await update;
    const archive = firstValueFrom(api.archive(id, 4)); const archived = backend.expectOne(`/v1/attachments/${id}/archive`);
    expect(archived.request.body).toEqual({ version: 4 }); archived.flush({ id }); await archive;
  });
  it('downloads binary content and carries the ZIP receipt into explicit purge', async () => {
    const blob = new Blob(['content'], { type: 'image/jpeg' });
    const content = firstValueFrom(api.content(id, true)); const download = backend.expectOne(`/v1/attachments/${id}/thumbnail`);
    expect(download.request.responseType).toBe('blob'); download.flush(blob); expect(await content).toBe(blob);
    const input = { attachments: [{ id, version: 3 }] }; const exported = firstValueFrom(api.export(2, input));
    const zip = backend.expectOne('/v1/funds/2/attachments/export'); expect(zip.request.body).toEqual(input);
    zip.flush(blob, { headers: new HttpHeaders({ 'X-Attachment-Export-Id': id }) }); expect(await exported).toEqual({ id, file: blob });
    const purge = firstValueFrom(api.purge(2, { ...input, exportId: id, confirmArchived: true })); const removed = backend.expectOne('/v1/funds/2/attachments/purge');
    expect(removed.request.body.confirmArchived).toBe(true); expect(removed.request.body.exportId).toBe(id); removed.flush({ items: [] }); await purge;
  });
  it('preserves error codes from JSON errors returned to binary downloads', async () => {
    const pending = firstValueFrom(api.content(id)); const rejected = expect(pending).rejects.toMatchObject({ status: 410, code: 'attachment_purged' });
    backend.expectOne(`/v1/attachments/${id}/content`).flush(new Blob([JSON.stringify({ error: { code: 'attachment_purged', message: 'Gone' } })], { type: 'application/json' }), { status: 410, statusText: 'Gone' });
    await rejected;
  });
});

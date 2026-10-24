import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { Attachment, UploadAttachmentRequest } from '@splk/api-contracts';
import { AuthService, CurrentUser } from '../../core/auth/auth.service';
import { CatalogApi } from '../catalog/catalog-api';
import { MockCatalogApi } from '../catalog/mock-catalog-api';
import { InventoryApi } from '../inventory/inventory-api';
import { MockInventoryApi } from '../inventory/mock-inventory-api';
import { OrganizationApi } from '../organization/organization-api';
import { MockAttachmentsApi } from './mock-attachments-api';

describe('MockAttachmentsApi', () => {
  let api: MockAttachmentsApi, inventory: InventoryApi, user: ReturnType<typeof signal<CurrentUser | null>>;
  let people: { id: number }[];
  const input: UploadAttachmentRequest = { unitId: 1, ownerType: 'person', ownerId: 3, kind: 'person_card' };
  const file = () => new File(['%PDF-1.7\nOriginal card\n%%EOF\n'], 'card.pdf', { type: 'text/plain' });
  const versions = (rows: Attachment[]) => rows.map(({ id, version }) => ({ id, version }));
  beforeEach(() => {
    people = [{ id: 3 }];
    user = signal<CurrentUser | null>({ account: { id: 1, loginEmail: 'mock@example.test', status: 'active' }, person: { id: 1, firstName: 'Test', lastName: 'Mock', nickname: null },
      mandates: [{ id: 1, kind: 'costumes.manage', scopeType: 'unit', scopeId: 1, scopeName: 'Vonica' }, { id: 2, kind: 'costumes.view', scopeType: 'unit', scopeId: 2, scopeName: 'Malá Vonica' }] });
    TestBed.configureTestingModule({ providers: [MockAttachmentsApi, { provide: AuthService, useValue: { user } },
      { provide: OrganizationApi, useValue: { persons: () => of(people), units: () => of([{ id: 1, hasCostumeFund: true, archived: false }, { id: 2, hasCostumeFund: true, archived: false }]) } },
      { provide: CatalogApi, useClass: MockCatalogApi }, { provide: InventoryApi, useClass: MockInventoryApi }] });
    api = TestBed.inject(MockAttachmentsApi); inventory = TestBed.inject(InventoryApi);
  });

  it('checks actual content, keeps independent metadata and never manufactures loan/check history', async () => {
    const row = await firstValueFrom(api.upload(file(), input)); expect(row.mime).toBe('application/pdf'); expect(row.hasThumbnail).toBe(false);
    expect(row.sha256).toMatch(/^[a-f0-9]{64}$/); const original = await firstValueFrom(api.content(row.id)); expect(await original.text()).toContain('Original card');
    row.caption = 'Local change'; expect((await firstValueFrom(api.metadata(row.id))).caption).toBeNull();
    expect((await firstValueFrom(inventory.loans(1))).total).toBe(0); expect((await firstValueFrom(inventory.inventories(1))).total).toBe(0);
  });
  it('resolves newly added people from the shared registry and physical owners from the same inventory', async () => {
    await expect(firstValueFrom(api.upload(file(), { ...input, ownerId: 4 }))).rejects.toMatchObject({ status: 404 });
    people.push({ id: 4 }); expect((await firstValueFrom(api.upload(file(), { ...input, ownerId: 4 }))).ownerId).toBe(4);
    const series = (await firstValueFrom(TestBed.inject(CatalogApi).series(1))).find((s) => s.kind === 'part')!;
    const item = await firstValueFrom(inventory.createItem(1, { seriesId: series.id, number: '17' }));
    const photo = new File([Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAIAAAB7QOjdAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAAD0lEQVQImWNgYGBgYGAAAAAHAAHV3tbYAAAAAElFTkSuQmCC'), (c) => c.charCodeAt(0))], 'photo.png');
    const row = await firstValueFrom(api.upload(photo, { unitId: 1, ownerType: 'item', ownerId: item.id, kind: 'item_photo' })); expect(row.ownerId).toBe(item.id);
    expect((await firstValueFrom(inventory.item(item.id))).kitId).toBeNull();
  });
  it('retains reader access to personal scans and rejects writes, foreign funds and admin-only access', async () => {
    const row = await firstValueFrom(api.upload(file(), input));
    user.update((u) => ({ ...u!, mandates: [{ id: 8, kind: 'costumes.view', scopeType: 'unit', scopeId: 1, scopeName: 'Vonica' }] }));
    expect((await firstValueFrom(api.content(row.id))).size).toBe(row.size);
    await expect(firstValueFrom(api.archive(row.id, 1))).rejects.toMatchObject({ status: 403 });
    await expect(firstValueFrom(api.export(1, { attachments: versions([row]) }))).rejects.toMatchObject({ status: 403 });
    user.update((u) => ({ ...u!, mandates: [{ id: 9, kind: 'costumes.manage', scopeType: 'unit', scopeId: 2, scopeName: 'Other' }] }));
    await expect(firstValueFrom(api.metadata(row.id))).rejects.toMatchObject({ status: 404 });
    user.update((u) => ({ ...u!, mandates: [{ id: 10, kind: 'organization.admin', scopeType: 'organization', scopeId: null, scopeName: null }] }));
    await expect(firstValueFrom(api.metadata(row.id))).rejects.toMatchObject({ status: 404 });
    user.set(null); await expect(firstValueFrom(api.list({ unitId: 1 }))).rejects.toMatchObject({ status: 401 });
  });
  it('enforces versions, owner changes, archive filters and full pagination totals', async () => {
    const a = await firstValueFrom(api.upload(file(), { ...input, page: 2 })); const b = await firstValueFrom(api.upload(file(), { ...input, page: 1 }));
    const page = await firstValueFrom(api.list({ unitId: 1, limit: 1 })); expect(page.total).toBe(2); expect(page.items[0].id).toBe(b.id);
    const updated = await firstValueFrom(api.update(a.id, { version: 1, caption: 'Compared to original' })); expect(updated.version).toBe(2);
    await expect(firstValueFrom(api.archive(a.id, 1))).rejects.toMatchObject({ code: 'version_conflict' });
    await firstValueFrom(api.archive(a.id, 2)); expect((await firstValueFrom(api.list({ unitId: 1 }))).total).toBe(1);
    expect((await firstValueFrom(api.list({ unitId: 1, archived: true }))).total).toBe(2);
    await expect(firstValueFrom(api.update(b.id, { version: 1, ownerType: 'archive', ownerId: 2, kind: 'loose_slip' }))).rejects.toMatchObject({ status: 404 });
    expect((await firstValueFrom(api.metadata(b.id))).ownerType).toBe('person');
  });
  it('creates a real ZIP and requires an unchanged receipt and explicit external-archive confirmation', async () => {
    const row = await firstValueFrom(api.upload(file(), input)); const exported = await firstValueFrom(api.export(1, { attachments: versions([row]) }));
    expect(exported.file.type).toBe('application/zip'); const buffer = await exported.file.arrayBuffer(); expect(new DataView(buffer).getUint32(0, true)).toBe(0x04034b50);
    const request = { attachments: versions([row]), exportId: exported.id, confirmArchived: true as const };
    await expect(firstValueFrom(api.purge(1, { ...request, confirmArchived: false as never }))).rejects.toMatchObject({ code: 'attachment_export_required' });
    const result = await firstValueFrom(api.purge(1, request)); expect(result.items[0].purgedAt).not.toBeNull(); expect(result.items[0].version).toBe(2);
    await expect(firstValueFrom(api.content(row.id))).rejects.toMatchObject({ status: 410 });
    expect((await firstValueFrom(api.purge(1, request))).items[0].version).toBe(2);
    expect((await firstValueFrom(api.list({ unitId: 1, archived: true, purged: true }))).total).toBe(1);
  });
  it('validates an entire purge batch before removing any content and invalidates exports after edits', async () => {
    const row = await firstValueFrom(api.upload(file(), input)); const exported = await firstValueFrom(api.export(1, { attachments: versions([row]) }));
    const later = await firstValueFrom(api.upload(file(), input));
    await expect(firstValueFrom(api.purge(1, { attachments: versions([row, later]), exportId: exported.id, confirmArchived: true }))).rejects.toMatchObject({ code: 'attachment_export_required' });
    expect((await firstValueFrom(api.content(row.id))).size).toBe(row.size);
    const updated = await firstValueFrom(api.update(row.id, { version: 1, page: 3 }));
    await expect(firstValueFrom(api.purge(1, { attachments: versions([updated]), exportId: exported.id, confirmArchived: true }))).rejects.toMatchObject({ code: 'attachment_export_required' });
    expect((await firstValueFrom(api.content(later.id))).size).toBe(later.size);
  });
  it('rejects malformed metadata/files and serializes simultaneous changes', async () => {
    await expect(firstValueFrom(api.upload(new File(['<svg/>'], 'fake.png', { type: 'image/png' }), input))).rejects.toMatchObject({ code: 'invalid_file' });
    await expect(firstValueFrom(api.upload(file(), { ...input, originalDate: '2026-02-31' }))).rejects.toMatchObject({ code: 'validation_failed' });
    const row = await firstValueFrom(api.upload(file(), input));
    const results = await Promise.allSettled([firstValueFrom(api.update(row.id, { version: 1, caption: 'First' })), firstValueFrom(api.update(row.id, { version: 1, caption: 'Second' }))]);
    expect(results[0].status).toBe('fulfilled'); expect(results[1].status).toBe('rejected'); expect((await firstValueFrom(api.metadata(row.id))).caption).toBe('First');
  });
});

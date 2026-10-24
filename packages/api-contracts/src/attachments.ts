import type { Page } from './inventory';

export type AttachmentOwnerType = 'person' | 'kit' | 'series' | 'item' | 'inventory_check' | 'archive';
export type AttachmentKind = 'person_card' | 'kit_card' | 'kit_label' | 'series_card' | 'loan_book' | 'loose_slip' | 'item_photo' | 'check_photo';
export type AttachmentMime = 'image/jpeg' | 'image/png' | 'application/pdf';
export interface AttachmentOwner {
  unitId: number;
  ownerType: AttachmentOwnerType;
  /** For the fund's document archive, ownerId equals unitId. */
  ownerId: number;
}
/** Public identifiers are opaque UUIDs; storage paths never leave the API. */
export interface Attachment extends AttachmentOwner {
  id: string;
  kind: AttachmentKind;
  mime: AttachmentMime;
  size: number;
  /** Digest of sanitized stored content, never of the discarded GPS-bearing upload. */
  sha256: string;
  hasThumbnail: boolean;
  page: number;
  caption: string | null;
  originalDate: string | null;
  uploadedBy: number;
  uploadedAt: string;
  archivedAt: string | null;
  purgedAt: string | null;
  version: number;
}
/** Metadata parts of POST /v1/attachments; the file is a separate multipart part. */
export interface UploadAttachmentRequest extends AttachmentOwner {
  kind: AttachmentKind;
  page?: number;
  caption?: string | null;
  originalDate?: string | null;
}
export interface UpdateAttachmentRequest {
  version: number;
  ownerType?: AttachmentOwnerType;
  ownerId?: number;
  kind?: AttachmentKind;
  page?: number;
  caption?: string | null;
  originalDate?: string | null;
}
export interface AttachmentVersion { id: string; version: number }
export interface ExportAttachmentsRequest { attachments: AttachmentVersion[] }
/** ZIP download returns its receipt in X-Attachment-Export-Id. */
export interface AttachmentExport { id: string; file: Blob }
export interface PurgeAttachmentsRequest {
  exportId: string;
  /** Explicit confirmation that the exported ZIP was saved outside the application (D-40). */
  confirmArchived: true;
  attachments: AttachmentVersion[];
}
export interface AttachmentListQuery {
  unitId: number;
  /** Supply ownerType and ownerId together; omit both for the fund's document overview. */
  ownerType?: AttachmentOwnerType;
  ownerId?: number;
  archived?: boolean;
  purged?: boolean;
  limit?: number;
  offset?: number;
}
export type AttachmentPage = Page<Attachment>;

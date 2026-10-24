import { Observable } from 'rxjs';
import { Attachment, AttachmentExport, AttachmentListQuery, AttachmentPage, ExportAttachmentsRequest, PurgeAttachmentsRequest, UpdateAttachmentRequest, UploadAttachmentRequest } from '@splk/api-contracts';

export abstract class AttachmentsApi {
  abstract list(query: AttachmentListQuery): Observable<AttachmentPage>;
  abstract metadata(id: string): Observable<Attachment>;
  abstract upload(file: File, input: UploadAttachmentRequest): Observable<Attachment>;
  abstract update(id: string, input: UpdateAttachmentRequest): Observable<Attachment>;
  abstract archive(id: string, version: number): Observable<Attachment>;
  abstract content(id: string, thumbnail?: boolean): Observable<Blob>;
  abstract export(unitId: number, input: ExportAttachmentsRequest): Observable<AttachmentExport>;
  abstract purge(unitId: number, input: PurgeAttachmentsRequest): Observable<{ items: Attachment[] }>;
}

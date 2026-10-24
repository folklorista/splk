import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, from, map, mergeMap, Observable, throwError } from 'rxjs';
import { Attachment, AttachmentListQuery, AttachmentPage, ExportAttachmentsRequest, PurgeAttachmentsRequest, UpdateAttachmentRequest, UploadAttachmentRequest } from '@splk/api-contracts';
import { API_BASE_URL } from '../api-config';
import { ApiError } from '../api-error';
import { AttachmentsApi } from './attachments-api';
import { unpackError } from '../http/unpack-error';

@Injectable()
export class HttpAttachmentsApi extends AttachmentsApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);
  list(query: AttachmentListQuery) {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) if (value !== undefined) params = params.set(key, String(value));
    return this.wrap(this.http.get<AttachmentPage>(`${this.base}/attachments`, { params }));
  }
  metadata(id: string) { return this.wrap(this.http.get<Attachment>(this.path(id))); }
  upload(file: File, input: UploadAttachmentRequest) {
    const form = new FormData();
    form.set('file', file);
    for (const [key, value] of Object.entries(input)) if (value !== undefined) form.set(key, value === null ? '' : String(value));
    // Let the browser set the multipart boundary; existing interceptors provide credentials/CSRF.
    return this.wrap(this.http.post<Attachment>(`${this.base}/attachments`, form));
  }
  update(id: string, input: UpdateAttachmentRequest) { return this.wrap(this.http.patch<Attachment>(this.path(id), input)); }
  archive(id: string, version: number) { return this.wrap(this.http.post<Attachment>(`${this.path(id)}/archive`, { version })); }
  content(id: string, thumbnail = false) { return this.wrap(this.http.get(`${this.path(id)}/${thumbnail ? 'thumbnail' : 'content'}`, { responseType: 'blob' })); }
  export(unitId: number, input: ExportAttachmentsRequest) {
    return this.wrap(this.http.post(`${this.base}/funds/${unitId}/attachments/export`, input, { responseType: 'blob', observe: 'response' }).pipe(map((response) => {
      const id = response.headers.get('X-Attachment-Export-Id');
      if (!id || !response.body) throw new ApiError(500, 'internal_error');
      return { id, file: response.body };
    })));
  }
  purge(unitId: number, input: PurgeAttachmentsRequest) { return this.wrap(this.http.post<{ items: Attachment[] }>(`${this.base}/funds/${unitId}/attachments/purge`, input)); }
  private path(id: string) { return `${this.base}/attachments/${encodeURIComponent(id)}`; }
  private wrap<T>(request: Observable<T>): Observable<T> {
    return request.pipe(catchError((error: unknown) => from(unpackError(error)).pipe(mergeMap((decoded) => throwError(() => ApiError.from(decoded))))));
  }
}

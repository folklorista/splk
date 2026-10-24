import { HttpErrorResponse } from '@angular/common/http';

/** Binary downloads still return the API's JSON error envelope, including CSRF failures. */
export async function unpackError(error: unknown): Promise<unknown> {
  if (!(error instanceof HttpErrorResponse) || !(error.error instanceof Blob) || error.error.size > 65536) return error;
  try {
    const body: unknown = JSON.parse(await error.error.text());
    return new HttpErrorResponse({ error: body, status: error.status, statusText: error.statusText, headers: error.headers, url: error.url ?? undefined });
  } catch { return error; }
}

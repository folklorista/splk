import { HttpErrorResponse } from '@angular/common/http';
import { ApiErrorBody, ApiErrorCode } from '@splk/api-contracts';

/** API error as seen by feature services, the same for HTTP and mock adapters. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode | 'network_error',
    readonly details: Record<string, unknown> = {},
  ) {
    super(code);
  }

  static from(error: unknown): ApiError {
    if (error instanceof ApiError) {
      return error;
    }
    if (error instanceof HttpErrorResponse) {
      const body = error.error as Partial<ApiErrorBody> | null;
      if (body?.error?.code) {
        return new ApiError(error.status, body.error.code, body.error.details ?? {});
      }
      return new ApiError(error.status, error.status === 0 ? 'network_error' : 'internal_error');
    }
    return new ApiError(0, 'internal_error');
  }

  /** `details.reason` of validation_failed */
  get reason(): string | undefined {
    const reason = this.details['reason'];
    return typeof reason === 'string' ? reason : undefined;
  }
}

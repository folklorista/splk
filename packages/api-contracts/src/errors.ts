/** Error body of every non-2xx response (api-v1 chap. 2.2). */
export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

/** Stable error codes; the frontend translates them, `message` is only for developers. */
export type ApiErrorCode =
  | 'invalid_json'
  | 'validation_failed'
  | 'not_found'
  | 'method_not_allowed'
  | 'origin_not_allowed'
  | 'origin_required'
  | 'cross_site_request'
  | 'unsupported_media_type'
  | 'unauthenticated'
  | 'csrf_token_invalid'
  | 'invalid_credentials'
  | 'too_many_attempts'
  | 'reset_token_invalid'
  | 'internal_error';

/** `details.reason` of `validation_failed`. */
export type ValidationReason =
  | 'required'
  | 'too_long'
  | 'invalid_email'
  | 'password_too_short'
  | 'password_incorrect';

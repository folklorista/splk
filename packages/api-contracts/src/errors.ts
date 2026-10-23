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
  | 'forbidden'
  | 'duplicate_name'
  | 'part_type_not_numbered'
  | 'account_exists'
  | 'email_taken'
  | 'account_not_invited'
  | 'account_not_disabled'
  | 'cannot_disable_self'
  | 'mandate_exists'
  | 'last_admin'
  | 'version_conflict'
  | 'number_already_used'
  | 'duplicate_stock'
  | 'insufficient_stock'
  | 'item_retired'
  | 'composition_conflict'
  | 'internal_error';

/** `details.reason` of `validation_failed`. */
export type ValidationReason =
  | 'required'
  | 'too_long'
  | 'invalid_email'
  | 'password_too_short'
  | 'password_incorrect'
  | 'invalid'
  | 'immutable'
  | 'not_allowed'
  | 'region_has_children'
  | 'organization_scope_only'
  | 'not_a_costume_fund';

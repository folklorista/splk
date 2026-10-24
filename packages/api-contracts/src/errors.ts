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
  | 'possible_duplicate'
  | 'duplicate_stock'
  | 'insufficient_stock'
  | 'item_unavailable'
  | 'kit_unavailable'
  | 'loan_line_closed'
  | 'item_retired'
  | 'composition_conflict'
  | 'inventory_closed'
  | 'inventory_has_issues'
  | 'inventory_target_exists'
  | 'inventory_slot_full'
  | 'inventory_visit_exists'
  | 'inventory_visit_closed'
  | 'inventory_busy'
  | 'group_membership_exists'
  | 'invalid_file'
  | 'file_too_large'
  | 'attachment_limit'
  | 'attachment_purged'
  | 'attachment_export_required'
  | 'paper_migration_busy'
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

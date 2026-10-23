/** /v1/auth/* (api-v1 chap. 4.1). */

export type MandateKind = 'costumes.manage' | 'costumes.view' | 'costs.view' | 'organization.admin';
export type MandateScopeType = 'organization' | 'unit';
export type AccountStatus = 'invited' | 'active' | 'disabled';

export interface Mandate {
  id: number;
  kind: MandateKind;
  scopeType: MandateScopeType;
  scopeId: number | null;
  /** unit name for scopeType "unit" */
  scopeName: string | null;
}

/** Response of GET /v1/auth/me and POST /v1/auth/login. */
export interface MeResponse {
  account: { id: number; loginEmail: string; status: AccountStatus };
  person: { id: number; firstName: string; lastName: string; nickname: string | null };
  mandates: Mandate[];
  /** sent back in X-CSRF-Token with every write; kept in memory only */
  csrfToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirmRequest {
  token: string;
  password: string;
}

export interface SessionInfo {
  id: number;
  createdAt: string;
  lastSeenAt: string;
  userAgent: string | null;
  current: boolean;
}

export interface SessionsResponse {
  items: SessionInfo[];
}

/** Minimal password length enforced by the API. */
export const PASSWORD_MIN_LENGTH = 10;

import { AccountStatus, Mandate, MandateKind } from './auth';

/** /v1/units, /v1/persons, /v1/accounts, /v1/mandates (api-v1 chap. 4.2, organization.admin). */

export interface Unit {
  id: number;
  name: string;
  shortName: string | null;
  hasCostumeFund: boolean;
  archived: boolean;
}

export interface ManagedMandate extends Mandate {
  validFrom: string;
}

export interface ManagedPerson {
  id: number;
  firstName: string;
  lastName: string;
  nickname: string | null;
  contact: string | null;
  note: string | null;
  account: { id: number; loginEmail: string; status: AccountStatus; lastLoginAt: string | null } | null;
  mandates: ManagedMandate[];
}

export interface PersonInput {
  firstName: string;
  lastName: string;
  nickname?: string | null;
  contact?: string | null;
  note?: string | null;
}

export interface CreateAccountRequest {
  personId: number;
  email: string;
}

export interface CreateAccountResponse {
  person: ManagedPerson;
  /** false when the e-mail could not be sent; the invitation can be repeated */
  invitationSent: boolean;
}

export interface GrantMandateRequest {
  personId: number;
  kind: MandateKind;
  /** null = whole organization */
  unitId: number | null;
}

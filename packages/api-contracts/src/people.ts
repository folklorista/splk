import type { CostumeLoan, LoanMovement } from './loans';
import { Page, PageQuery } from './inventory';

export type DefaultCostume = 'male' | 'female' | 'unspecified';
export type PaperState = 'paper' | 'migrating' | 'digital';
export interface PersonAffiliation { unitId: number; unitName: string; status: 'interested' | 'active'; validFrom: string; validTo: string | null }
export interface PersonSummary {
  id: number;
  firstName: string;
  lastName: string;
  nickname: string | null;
  /** Shared by costumes.manage (D-60); null with contactVisible=false for read-only viewers. */
  contact: string | null;
  contactVisible: boolean;
  affiliations: PersonAffiliation[];
}
export interface HolderProfile {
  id: number;
  unitId: number;
  personId: number;
  paperState: PaperState;
  paperCheckedAt: string | null;
  migratedAt: string | null;
  migratedBy: number | null;
  note: string | null;
}
export interface PersonIdentity extends PersonSummary { defaultCostume: DefaultCostume }
export interface PersonInFund extends PersonSummary {
  /** Only the explicitly selected, authorized fund. null means no profile recorded. */
  profile: HolderProfile | null;
}
export interface PeopleQuery extends PageQuery {
  q?: string;
  unit?: number;
  fund?: number;
  paperState?: PaperState;
  /** Requires an explicit authorized fund. */
  hasLoans?: boolean;
}
export interface PersonCreateInput {
  firstName: string;
  lastName: string;
  nickname?: string | null;
  contact?: string | null;
  defaultCostume?: DefaultCostume;
  /** Explicit confirmation of the duplicate warning; does not merge people. */
  confirmDuplicate?: boolean;
}
export type PersonPatch = Partial<Pick<PersonCreateInput, 'firstName' | 'lastName' | 'nickname' | 'contact' | 'defaultCostume'>>;
export interface PersonCard {
  openLoans: Page<CostumeLoan>;
  movements: Page<LoanMovement>;
  person: PersonIdentity;
  profile: HolderProfile | null;
}
export interface HolderProfileInput {
  /** Explicit comparison with the paper original, never physical verification of a costume. */
  originalChecked?: boolean;
  paperState: PaperState;
  note?: string | null;
}

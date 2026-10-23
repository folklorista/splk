/** /v1/funds/{unitId}/regions|part-types|series (api-v1 chap. 4.4). Lists contain archived rows too. */

export type Gender = 'male' | 'female';
export type SeriesKind = 'part' | 'kit';

export interface Region {
  id: number;
  name: string;
  /** region → area, two levels (Slovensko → Zemplín) */
  parentId: number | null;
  archived: boolean;
}

export interface PartType {
  id: number;
  name: string;
  /** null = both */
  gender: Gender | null;
  /** null = universal (e.g. soft shoes) */
  regionId: number | null;
  /** false = counted, never numbered (kytička, korále, mašle) */
  numbered: boolean;
  archived: boolean;
}

export interface Series {
  id: number;
  kind: SeriesKind;
  name: string;
  /** set for kind "part", null for kits; never changes */
  partTypeId: number | null;
  regionId: number | null;
  gender: Gender | null;
  /** null = the variant is only an attribute of items */
  variant: string | null;
  allowNumberReuse: boolean;
  archived: boolean;
}

export interface ListResponse<T> {
  items: T[];
}

export interface RegionInput {
  name: string;
  parentId: number | null;
}

export interface PartTypeInput {
  name: string;
  gender: Gender | null;
  regionId: number | null;
  numbered: boolean;
}

export interface SeriesCreateInput {
  kind: SeriesKind;
  partTypeId?: number;
  /** defaults to the part type name for kind "part" */
  name?: string;
  regionId?: number | null;
  gender?: Gender | null;
  variant?: string | null;
  allowNumberReuse?: boolean;
}

export type RegionPatch = Partial<RegionInput & { archived: boolean }>;
export type PartTypePatch = Partial<PartTypeInput & { archived: boolean }>;
export type SeriesPatch = Partial<{
  name: string;
  regionId: number | null;
  gender: Gender | null;
  variant: string | null;
  allowNumberReuse: boolean;
  archived: boolean;
}>;

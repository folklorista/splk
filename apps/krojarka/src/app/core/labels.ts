import { Gender, Mandate, MandateKind, SeriesKind } from '@splk/api-contracts';

export const MANDATE_KIND_LABELS: Record<MandateKind, string> = {
  'costumes.manage': 'Správa krojů',
  'costumes.view': 'Náhled do správy krojů',
  'costs.view': 'Náklady na kroje',
  'organization.admin': 'Správa organizace',
};

export const GENDER_LABELS: Record<Gender, string> = { male: 'mužský', female: 'ženský' };

export const SERIES_KIND_LABELS: Record<SeriesKind, string> = { part: 'součástky', kit: 'komplety' };

export function genderLabel(gender: Gender | null): string {
  return gender ? GENDER_LABELS[gender] : 'oba';
}

export function mandateLabel(mandate: Mandate): string {
  const scope = mandate.scopeType === 'organization' ? 'celá organizace' : (mandate.scopeName ?? `složka ${mandate.scopeId}`);
  return `${MANDATE_KIND_LABELS[mandate.kind]} – ${scope}`;
}

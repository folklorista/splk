import { Mandate, MandateKind } from '@splk/api-contracts';

const KIND_LABELS: Record<MandateKind, string> = {
  'costumes.manage': 'Správa krojů',
  'costumes.view': 'Náhled do správy krojů',
  'costs.view': 'Náklady na kroje',
  'organization.admin': 'Správa organizace',
};

export function mandateLabel(mandate: Mandate): string {
  const scope = mandate.scopeType === 'organization' ? 'celá organizace' : (mandate.scopeName ?? `složka ${mandate.scopeId}`);
  return `${KIND_LABELS[mandate.kind]} – ${scope}`;
}

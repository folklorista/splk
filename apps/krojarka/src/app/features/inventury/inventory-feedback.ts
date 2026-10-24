import { InventoryCheckOutcome, InventoryIssue, InventoryResult } from '@splk/api-contracts';

export const CHECK_RESULTS: Record<InventoryResult, string> = { presented: 'Fyzicky předložen', not_presented: 'Nepředložen', found: 'Fyzicky nalezen', not_found: 'Nenalezen' };
export const ISSUE_LABELS: Record<InventoryIssue['kind'], string> = {
  unverified: 'Zatím fyzicky neověřeno', not_presented: 'Nepředloženo', not_found: 'Nenalezeno', quantity_mismatch: 'Rozdíl v počtu', bulk_not_counted: 'Počet zatím nezapsán',
  damaged: 'Poškozeno', needs_adjustment: 'Vyžaduje úpravu', open_work_order: 'Otevřený pracovní úkol', composition_mismatch: 'Rozpor v určeném složení', location_mismatch: 'Rozpor v evidovaném umístění',
};
export function checkFeedback(code: InventoryCheckOutcome['code']): string {
  return {
    ok: 'Kontrola je zapsaná.', already_checked: 'Už fyzicky ověřeno. Nové zjištění zapište jako opakovanou kontrolu.', unknown_number: 'Číslo neodpovídá aktivnímu kusu ve zmrazeném rozsahu.',
    loaned_to: 'Součástka je vedena ve výpůjčce jiného držitele nebo mimo tento komplet. Případné vrácení je samostatná operace.',
    not_in_store: 'Součástka je evidovaná mimo sklad. Jednotlivé fyzické zjištění lze potvrdit s poznámkou k rozporu.',
    not_in_kit: 'Součástka není určena tomuto kompletu. Skutečný nález lze výslovně potvrdit s poznámkou, bez změny určeného složení.',
    item_retired: 'Součástka je vyřazená a tato kontrola se nezapsala.',
  }[code];
}

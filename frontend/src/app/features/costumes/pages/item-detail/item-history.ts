import { Member } from '../../../../core/models/member.model';
import { CostumeState } from '../../models/costume.model';
import { INVENTORY_RESULT_LABELS, borrowerKey, borrowerLabel } from '../../utils/costume-logic';

export interface HistoryEntry {
  at: string;
  text: string;
  note?: string;
  // Kdo záznam provedl (krojárka)
  by?: string;
  loanId?: number;
  personKey?: string;
  inventoryId?: number;
}

// Jméno uživatele podle userId člena; 0 = záznam z úvodního naplnění evidence
export function userName(members: Member[], userId: number | undefined): string {
  if (userId === undefined) return '';
  return members.find((m) => m.userId === userId)?.nickname ?? (userId === 0 ? 'evidence' : `uživatel #${userId}`);
}

// Historie jedné fyzické součásti (podle id) – změny evidence, zápůjčky, vrácení a inventury.
// Znovu použité číslo v řadě má novou součást, takže se historie nespojují.
export function itemHistory(state: CostumeState, itemId: number, members: Member[]): HistoryEntry[] {
  const entries: HistoryEntry[] = [];

  for (const log of state.log) {
    if (log.itemId !== itemId) continue;
    entries.push({ at: log.at, text: log.text, note: log.note, by: userName(members, log.byUserId) });
  }

  for (const loan of state.loans) {
    for (const line of loan.lines) {
      if (line.itemId !== itemId) continue;
      const borrower = borrowerLabel(loan.borrower, members, state.externals);
      const ref = { loanId: loan.id, personKey: borrowerKey(loan.borrower) };
      entries.push({
        at: loan.issuedAt,
        text: `Zapůjčeno: ${borrower}${loan.kitId !== undefined ? ' (s kompletem)' : ''}`,
        note: loan.note,
        by: userName(members, loan.issuedByUserId),
        ...ref,
      });
      for (const ret of line.returns) {
        entries.push({
          at: ret.at,
          text: `Vráceno od: ${borrower} – ${ret.ready ? 'připraveno k zapůjčení' : 'nepřipraveno k zapůjčení'}`,
          note: ret.note,
          by: userName(members, ret.byUserId),
          ...ref,
        });
      }
      if (line.settled) {
        entries.push({
          at: line.settled.at,
          text: `Zápůjčka vypořádána (${borrower})`,
          note: line.settled.note,
          by: userName(members, line.settled.byUserId),
          ...ref,
        });
      }
    }
  }

  for (const inventory of state.inventories) {
    for (const line of inventory.lines) {
      if (line.itemId !== itemId) continue;
      const result = line.result ? INVENTORY_RESULT_LABELS[line.result] : 'zatím nezkontrolováno';
      entries.push({
        at: line.checkedAt ?? inventory.startedAt,
        text: `Inventura „${inventory.name}“: ${result}`,
        note: line.note,
        by: userName(members, line.checkedByUserId),
        inventoryId: inventory.id,
      });
    }
  }

  return entries.sort((a, b) => a.at.localeCompare(b.at));
}


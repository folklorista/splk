import { EXTERNAL_DETAIL, auditText } from './audit-text';
import { AuditEntry } from './audit.model';

describe('auditText – ukončení a obnovení osoby', () => {
  const ctx = { memberName: () => 'Externista', groupName: () => '', eventTitle: () => '' };
  const entry = (action: AuditEntry['action'], details?: string): AuditEntry => ({ id: 1, at: '2026-10-20T10:00:00', actorId: 1, action, groupIds: [], memberId: 9, details });

  it('u externisty píše o vyřazení z evidence, ne o členství', () => {
    expect(auditText(entry('person-deactivated', EXTERNAL_DETAIL), ctx)).toBe('Externista: externista vyřazen z evidence');
    expect(auditText(entry('person-reactivated', EXTERNAL_DETAIL), ctx)).toBe('Externista: externista vrácen do evidence');
  });

  it('u člena zůstává ukončení a obnovení členství', () => {
    expect(auditText(entry('person-deactivated'), ctx)).toBe('Externista: ukončeno aktivní členství v souboru');
  });
});

import { AppEvent } from '../models/event.model';
import { AttendanceRecord } from '../../attendance/models/attendance.model';

// Zobrazení detailu a důležité změny (docs/07 kap. 18, docs/08 kap. 11.3). Nejde o právní důkaz přečtení:
// rozlišujeme jen otevření detailu před/po důležité změně a případné výslovné potvrzení.

export function lastViewedAt(record: AttendanceRecord | undefined): string | undefined {
  return record?.lastViewedAt ?? record?.firstViewedAt;
}

// Otevřel člen detail (po poslední důležité změně, pokud nějaká je)?
export function viewedSinceChange(event: Pick<AppEvent, 'importantChange'>, record: AttendanceRecord | undefined): boolean {
  const viewed = lastViewedAt(record);
  if (!viewed) return false;
  return !event.importantChange || viewed >= event.importantChange.at;
}

export function confirmedChange(event: Pick<AppEvent, 'importantChange'>, record: AttendanceRecord | undefined): boolean {
  return !!event.importantChange && !!record?.confirmedAt && record.confirmedAt >= event.importantChange.at;
}

// Co člen ještě dluží k poslední důležité změně: přečíst (otevřít detail), potvrdit, nebo nic
export function changeAcknowledgement(event: Pick<AppEvent, 'importantChange'>, record: AttendanceRecord | undefined): 'view' | 'confirm' | null {
  if (!event.importantChange) return null;
  if (event.importantChange.requiresConfirmation) return confirmedChange(event, record) ? null : 'confirm';
  return viewedSinceChange(event, record) ? null : 'view';
}

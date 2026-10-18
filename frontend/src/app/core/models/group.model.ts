import { IconName } from '../../shared/icon/icon.component';

// Otevřená: obsah čtou všichni přihlášení členové souboru, psát mohou členové skupiny.
// Soukromá: skupina je dohledatelná, obsah čtou jen členové, lze požádat o vstup.
// Skrytá: nečlenové ji nevidí, vstup jen na pozvání.
export type GroupVisibility = 'open' | 'private' | 'hidden';

export type GroupTab = 'chat' | 'board';

export interface Group {
  id: number;
  ensembleId: number;
  name: string;
  slug: string;
  icon?: IconName;
  description?: string;
  // Chybějící hodnota = soukromá
  visibility?: GroupVisibility;
  // Nástěnka a chat skupiny; chybějící hodnota = zapnuto
  boardEnabled?: boolean;
  chatEnabled?: boolean;
  // Která záložka se otevře, když má skupina chat i nástěnku; chybějící = nástěnka
  defaultTab?: GroupTab;
  // Archivovaná skupina: jen ke čtení, bez upozornění, mimo menu; smazat lze jen archivovanou (docs/08 kap. 10.5)
  archivedAt?: string;
}

export function isGroupArchived(group: Pick<Group, 'archivedAt'> | undefined): boolean {
  return !!group?.archivedAt;
}

export const GROUP_VISIBILITY_LABELS: Record<GroupVisibility, string> = {
  open: 'Otevřená',
  private: 'Soukromá',
  hidden: 'Skrytá',
};

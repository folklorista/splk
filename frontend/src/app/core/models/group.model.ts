import { IconName } from '../../shared/icon/icon.component';

// Otevřená: obsah čtou všichni přihlášení členové souboru, psát mohou členové skupiny.
// Soukromá: skupina je dohledatelná, obsah čtou jen členové, lze požádat o vstup.
// Skrytá: nečlenové ji nevidí, vstup jen na pozvání.
export type GroupVisibility = 'open' | 'private' | 'hidden';

export type GroupTab = 'chat' | 'board';

// Historie chatu pro nové členy: otevřená, nebo jen od vstupu (docs/08 kap. 10.3)
export type ChatHistoryMode = 'open' | 'from-join';

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
  // Aktuální režim historie chatu; chybí = otevřená
  chatHistory?: ChatHistoryMode;
  // Odkdy který režim platil – zprávy zůstávají pod pravidlem období, kdy vznikly
  chatHistoryLog?: { from: string; mode: ChatHistoryMode }[];
  // Archivovaná skupina: jen ke čtení, bez upozornění, mimo menu; smazat lze jen archivovanou (docs/08 kap. 10.5)
  archivedAt?: string;
}

export function isGroupArchived(group: Pick<Group, 'archivedAt'> | undefined): boolean {
  return !!group?.archivedAt;
}

export const CHAT_HISTORY_LABELS: Record<ChatHistoryMode, string> = {
  open: 'Otevřená – nový člen vidí i starší chat',
  'from-join': 'Od vstupu – nový člen vidí chat až od přijetí',
};

export const GROUP_VISIBILITY_LABELS: Record<GroupVisibility, string> = {
  open: 'Otevřená',
  private: 'Soukromá',
  hidden: 'Skrytá',
};

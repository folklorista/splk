import { GroupTab, GroupVisibility } from './group.model';

// Kdo smí zakládat skupiny (docs/08 kap. 4.3); „návrh a schválení“ přijde později
export type GroupCreationPolicy = 'admins' | 'members';

export interface EnsembleSettings {
  name: string;
  // Volitelné moduly; skupiny a členství patří do jádra a vypnout nejdou
  modules: {
    events: boolean;
    costumes: boolean;
  };
  groupCreation: GroupCreationPolicy;
  newGroupDefaults: {
    visibility: GroupVisibility;
    chatEnabled: boolean;
    boardEnabled: boolean;
    defaultTab: GroupTab;
  };
  // Seskupování komentářů v chatu: od kolika komentářů jednoho příspěvku, mezi nimiž není delší pauza
  chatGrouping: {
    minComments: number;
    windowMinutes: number;
  };
}

export const DEFAULT_ENSEMBLE_SETTINGS: EnsembleSettings = {
  name: 'Vonica',
  modules: { events: true, costumes: true },
  groupCreation: 'admins',
  newGroupDefaults: { visibility: 'private', chatEnabled: true, boardEnabled: true, defaultTab: 'chat' },
  chatGrouping: { minComments: 3, windowMinutes: 10 },
};

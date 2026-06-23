export type EventType = 'rehearsal' | 'performance' | 'camp' | 'meeting' | 'other';

export interface AppEvent {
  id: number;
  ensembleId: number;
  title: string;
  type: EventType;
  startsAt: string;
  endsAt: string;
  location: string;
  description?: string;
  targetGroupIds: number[];
}

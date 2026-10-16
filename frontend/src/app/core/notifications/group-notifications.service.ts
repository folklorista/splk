import { Injectable, signal } from '@angular/core';
import { loadDemoData, saveDemoData } from '../data/demo-storage';
import { GroupNotifyMode } from './group-notifications';

type Prefs = Record<string, GroupNotifyMode>;
const key = (memberId: number, groupId: number) => `${memberId}:${groupId}`;

// Předvolby upozornění po skupinách. V demu v prohlížeči, s backendem u účtu (platí na všech zařízeních).
@Injectable({ providedIn: 'root' })
export class GroupNotificationsService {
  private readonly _prefs = signal<Prefs>(loadDemoData<Prefs>('group-notify', () => ({})));
  readonly prefs = this._prefs.asReadonly();

  modeFor(memberId: number | null, groupId: number): GroupNotifyMode {
    return (memberId && this._prefs()[key(memberId, groupId)]) || 'all';
  }

  setMode(memberId: number, groupId: number, mode: GroupNotifyMode): void {
    const next = { ...this._prefs(), [key(memberId, groupId)]: mode };
    this._prefs.set(next);
    saveDemoData('group-notify', next);
  }
}

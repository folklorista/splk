import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { CostumeState } from './models/costume.model';
import { seedCostumeState } from './data/mock-costumes';
import { loadDemoData, saveDemoData } from '../../core/data/demo-storage';
import { AccessService } from '../../core/access/access.service';
import { AccessDeniedError } from '../../core/access/mandate-rules';
import { MembersService } from '../members/members.service';
import { OpContext } from './utils/costume-ops';

const MOCK_DELAY = 150;

// Sdílený mock stav krojového fondu pro CostumesService a InventoryService (in-memory + localStorage
// přes demo-storage). Komponenty sem nepřistupují – jen přes feature services. Zápis ověřuje pověření
// stejně, jako to bude dělat server; skrytá tlačítka nestačí.
@Injectable({ providedIn: 'root' })
export class CostumeStoreService {
  private readonly subject: BehaviorSubject<CostumeState>;

  constructor(
    private access: AccessService,
    membersService: MembersService,
  ) {
    this.subject = new BehaviorSubject(loadDemoData('costumes', () => seedCostumeState(membersService.members())));
    this.subject.subscribe((state) => saveDemoData('costumes', state));
  }

  get state$(): Observable<CostumeState> {
    return this.subject.asObservable();
  }

  get snapshot(): CostumeState {
    return this.subject.value;
  }

  // `self` = zápis člena za sebe (rezervace termínu); `profile` = údaj o osobě (výchozí kroj), smí i Správa
  // souboru; jinak jen pověřené krojařky (Správa krojů)
  mutate<T>(change: (state: CostumeState, ctx: OpContext) => T, options: { self?: boolean; profile?: boolean } = {}): Observable<T> {
    const actorId = this.access.memberId();
    const allowed = options.self ? actorId !== null : this.access.canManageCostumes() || (!!options.profile && this.access.isEnsembleAdmin());
    if (!allowed) {
      return throwError(() => new AccessDeniedError('Krojový fond mění jen pověřené krojařky.'));
    }
    const draft: CostumeState = structuredClone(this.subject.value);
    try {
      const result = change(draft, { now: this.now(), actorId: actorId ?? 0, ensembleId: 1 });
      this.subject.next(draft);
      return of(structuredClone(result)).pipe(delay(MOCK_DELAY));
    } catch (error) {
      return throwError(() => error);
    }
  }

  canManage(): boolean {
    return this.access.canManageCostumes();
  }

  currentMemberId(): number | null {
    return this.access.memberId();
  }

  protected now(): string {
    return new Date().toISOString();
  }
}

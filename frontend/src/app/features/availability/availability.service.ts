import { Injectable, computed, signal } from '@angular/core';
import { Observable, defer, of } from 'rxjs';
import { AccessService } from '../../core/access/access.service';
import { canCreateEvents, canEditEvent, canRecordAttendance, EventScope } from '../../core/access/access.utils';
import { AccessDeniedError, RuleViolationError } from '../../core/access/mandate-rules';
import { loadDemoData, saveDemoData } from '../../core/data/demo-storage';
import { Unavailability, UnavailabilityInput } from './unavailability.model';
import { unavailableDuring } from './unavailability.utils';
import { seedUnavailability } from './data/mock-unavailability';

const STORAGE = 'unavailability';

// Dlouhodobá nedostupnost členů (mock). Člen spravuje jen svou; organizátoři ji vidí jen u akcí,
// které smějí upravovat nebo na nich evidovat docházku, a při plánování nové akce.
@Injectable({ providedIn: 'root' })
export class AvailabilityService {
  private readonly items = signal<Unavailability[]>(loadDemoData(STORAGE, seedUnavailability));

  // Moje nedostupnosti (včetně proběhlých – filtruje komponenta)
  readonly mine = computed(() => {
    const me = this.access.memberId();
    return this.items().filter((u) => u.memberId === me);
  });

  constructor(private access: AccessService) {}

  private commit(next: Unavailability[]): void {
    this.items.set(next);
    saveDemoData(STORAGE, next);
  }

  add(input: UnavailabilityInput): Observable<Unavailability> {
    return defer(() => {
      const me = this.access.memberId();
      if (!me) throw new AccessDeniedError('Nejste přihlášeni.');
      if (!input.from || !input.to) throw new RuleViolationError('Vyplňte datum od a do.');
      if (input.to < input.from) throw new RuleViolationError('Datum „do“ musí být stejné nebo pozdější než „od“.');
      const item: Unavailability = {
        id: Math.max(0, ...this.items().map((u) => u.id)) + 1,
        ensembleId: 1,
        memberId: me,
        from: input.from,
        to: input.to,
        note: input.note?.trim() || undefined,
        createdAt: new Date().toISOString(),
        createdById: me,
      };
      this.commit([...this.items(), item]);
      return of(item);
    });
  }

  remove(id: number): Observable<void> {
    return defer(() => {
      const item = this.items().find((u) => u.id === id);
      if (!item) return of(undefined);
      if (item.memberId !== this.access.memberId()) throw new AccessDeniedError('Smazat můžete jen vlastní nedostupnost.');
      this.commit(this.items().filter((u) => u.id !== id));
      return of(undefined);
    });
  }

  // U existující akce jen pro pověřené organizátory (úprava akce nebo evidence docházky)
  forEvent(event: EventScope & { startsAt: string; endsAt: string }): Unavailability[] {
    const s = this.access.subject();
    if (!canEditEvent(s, event) && !canRecordAttendance(s, event)) return [];
    return unavailableDuring(this.items(), event.startsAt, event.endsAt);
  }

  // Při plánování nové akce – kdo z oslovených členů je v termínu nedostupný
  forPlanning(startsAt: string, endsAt: string, memberIds: number[]): Unavailability[] {
    if (!canCreateEvents(this.access.subject()) || !startsAt) return [];
    return unavailableDuring(this.items(), startsAt, endsAt || startsAt, memberIds);
  }
}

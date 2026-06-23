import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { EventsService } from './events.service';
import { MOCK_EVENTS } from './data/mock-events';
import { AppEvent } from './models/event.model';

describe('EventsService', () => {
  let service: EventsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(EventsService);
    service.resetCache();
  });

  it('getEvents vrátí všechny akce', fakeAsync(() => {
    let result: unknown;
    service.getEvents().subscribe((events) => (result = events));
    tick(300);
    expect(Array.isArray(result)).toBeTrue();
    expect((result as unknown[]).length).toBe(MOCK_EVENTS.length);
  }));

  it('getEvents vrátí kopii pole, ne referenci na mock data', fakeAsync(() => {
    let result: unknown[];
    service.getEvents().subscribe((events) => (result = events));
    tick(300);
    expect(result!).not.toBe(MOCK_EVENTS);
  }));

  it('getEvent vrátí akci se správným id', fakeAsync(() => {
    let result: unknown;
    service.getEvent(2).subscribe((event) => (result = event));
    tick(300);
    expect((result as { id: number }).id).toBe(2);
  }));

  it('getEvent vrátí undefined pro neexistující id', fakeAsync(() => {
    let result: unknown = 'not-called';
    service.getEvent(9999).subscribe((event) => (result = event));
    tick(300);
    expect(result).toBeUndefined();
  }));

  it('getEvents obsahuje akce různých typů', fakeAsync(() => {
    let result: { type: string }[] = [];
    service.getEvents().subscribe((events) => (result = events));
    tick(300);
    const types = new Set(result.map((e) => e.type));
    expect(types.size).toBeGreaterThan(1);
  }));

  it('createEvent přidá novou akci', fakeAsync(() => {
    const newEvent: Omit<AppEvent, 'id'> = {
      ensembleId: 1,
      title: 'Nová akce',
      type: 'meeting',
      startsAt: '2026-07-01T18:00:00',
      endsAt: '2026-07-01T20:00:00',
      location: 'Sál',
      description: 'Popis',
      targetGroupIds: [],
    };
    let created: AppEvent | undefined;
    service.createEvent(newEvent).subscribe((e) => (created = e));
    tick(300);
    expect(created).toBeDefined();
    expect(created?.id).toBeGreaterThan(0);
    expect(created?.title).toBe('Nová akce');

    let allEvents: AppEvent[] = [];
    service.getEvents().subscribe((e) => (allEvents = e));
    tick(300);
    expect(allEvents.length).toBeGreaterThan(MOCK_EVENTS.length);
  }));

  it('updateEvent upraví existující akci', fakeAsync(() => {
    const updated: Omit<AppEvent, 'id'> = {
      ensembleId: 1,
      title: 'Upravená akce',
      type: 'rehearsal',
      startsAt: '2026-06-25T20:00:00',
      endsAt: '2026-06-25T22:00:00',
      location: 'Nová lokalita',
      targetGroupIds: [],
    };
    let result: AppEvent | undefined;
    service.updateEvent(1, updated).subscribe((e) => (result = e));
    tick(300);
    expect(result?.id).toBe(1);
    expect(result?.title).toBe('Upravená akce');
    expect(result?.location).toBe('Nová lokalita');
  }));

  it('updateEvent vrátí undefined pro neexistující id', fakeAsync(() => {
    const updated: Omit<AppEvent, 'id'> = {
      ensembleId: 1,
      title: 'Něco',
      type: 'meeting',
      startsAt: '2026-07-01T18:00:00',
      endsAt: '2026-07-01T20:00:00',
      location: 'Sál',
      targetGroupIds: [],
    };
    let result: AppEvent | undefined = {} as AppEvent;
    service.updateEvent(9999, updated).subscribe((e) => (result = e));
    tick(300);
    expect(result).toBeUndefined();
  }));

  it('deleteEvent odstraní akci', fakeAsync(() => {
    let deleted: boolean = false;
    service.deleteEvent(1).subscribe((success) => (deleted = success));
    tick(300);
    expect(deleted).toBeTrue();

    let events: AppEvent[] = [];
    service.getEvents().subscribe((e) => (events = e));
    tick(300);
    expect(events.find((e) => e.id === 1)).toBeUndefined();
  }));

  it('deleteEvent vrátí false pro neexistující id', fakeAsync(() => {
    let deleted: boolean = true;
    service.deleteEvent(9999).subscribe((success) => (deleted = success));
    tick(300);
    expect(deleted).toBeFalse();
  }));
});

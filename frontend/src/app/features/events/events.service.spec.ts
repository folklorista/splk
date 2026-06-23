import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { EventsService } from './events.service';
import { MOCK_EVENTS } from './data/mock-events';

describe('EventsService', () => {
  let service: EventsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(EventsService);
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
});

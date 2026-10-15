import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActualAttendanceService } from './actual-attendance.service';
import { AttendanceService } from './attendance.service';
import { ActualAttendance } from './models/actual-attendance.model';
import { AttendanceRecord } from './models/attendance.model';
import { clearDemoData } from '../../core/data/demo-storage';

describe('ActualAttendanceService', () => {
  const EVENT_ID = 9999;
  let service: ActualAttendanceService;

  beforeEach(() => {
    clearDemoData();
    TestBed.configureTestingModule({});
    service = TestBed.inject(ActualAttendanceService);
  });

  function load(eventId: number): ActualAttendance[] {
    let result: ActualAttendance[] = [];
    const sub = service.getForEvent(eventId).subscribe((records) => (result = records));
    tick(300);
    sub.unsubscribe();
    return result;
  }

  it('mark zapíše přítomnost včetně toho, kdo a kdy ji zapsal', fakeAsync(() => {
    service.mark(EVENT_ID, 1, true, 2).subscribe();
    tick(300);

    const [record] = load(EVENT_ID);
    expect(record.memberId).toBe(1);
    expect(record.present).toBeTrue();
    expect(record.recordedByMemberId).toBe(2);
    expect(Date.parse(record.recordedAt)).not.toBeNaN();
  }));

  it('mark opraví existující záznam místo přidání druhého', fakeAsync(() => {
    service.mark(EVENT_ID, 1, true, 2).subscribe();
    tick(300);
    service.mark(EVENT_ID, 1, false, 3).subscribe();
    tick(300);

    const records = load(EVENT_ID);
    expect(records.length).toBe(1);
    expect(records[0].present).toBeFalse();
    expect(records[0].recordedByMemberId).toBe(3);
  }));

  it('markMany zapíše více členů najednou a přepíše jejich dřívější záznam', fakeAsync(() => {
    service.mark(EVENT_ID, 1, true, 2).subscribe();
    tick(300);
    service.markMany(EVENT_ID, [1, 3, 4], false, 2).subscribe();
    tick(300);

    const records = load(EVENT_ID);
    expect(records.length).toBe(3);
    expect(records.every((r) => !r.present)).toBeTrue();
  }));

  it('clear záznam smaže (člen je znovu nezkontrolovaný)', fakeAsync(() => {
    service.markMany(EVENT_ID, [1, 3], true, 2).subscribe();
    tick(300);
    service.clear(EVENT_ID, 1).subscribe();
    tick(300);

    expect(load(EVENT_ID).map((r) => r.memberId)).toEqual([3]);
  }));

  it('záznamy jiných akcí zůstanou beze změny', fakeAsync(() => {
    service.mark(EVENT_ID, 1, true, 2).subscribe();
    service.mark(EVENT_ID + 1, 1, false, 2).subscribe();
    tick(300);
    service.clear(EVENT_ID, 1).subscribe();
    tick(300);

    expect(load(EVENT_ID + 1).length).toBe(1);
  }));

  it('nahlášenou účast (RSVP) nikdy nepřepíše', fakeAsync(() => {
    const attendance = TestBed.inject(AttendanceService);
    attendance.updateAttendance({ eventId: EVENT_ID, memberId: 1, status: 'yes', note: 'Přijdu' }).subscribe();
    tick(300);

    let before: AttendanceRecord[] = [];
    attendance.records$.subscribe((r) => (before = r)).unsubscribe();

    service.mark(EVENT_ID, 1, false, 2).subscribe();
    service.markMany(EVENT_ID, [1, 3], false, 2).subscribe();
    service.clear(EVENT_ID, 1).subscribe();
    tick(300);

    let after: AttendanceRecord[] = [];
    attendance.records$.subscribe((r) => (after = r)).unsubscribe();
    expect(after).toEqual(before);
    expect(after.find((r) => r.eventId === EVENT_ID && r.memberId === 1)?.status).toBe('yes');
  }));

  it('getForEvent vrací jen záznamy dané akce', fakeAsync(() => {
    service.mark(EVENT_ID, 5, true, 2).subscribe();
    service.mark(EVENT_ID + 1, 5, true, 2).subscribe();
    tick(300);
    const records = load(EVENT_ID);
    expect(records.length).toBe(1);
    expect(records[0].eventId).toBe(EVENT_ID);
  }));
});

import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { AttendanceService } from './attendance.service';
import { AttendanceRecord } from './models/attendance.model';

describe('AttendanceService', () => {
  let service: AttendanceService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AttendanceService);
  });

  it('getAttendance vrátí záznamy pro daný eventId', fakeAsync(() => {
    let result: AttendanceRecord[] = [];
    service.getAttendance(1).subscribe((records) => (result = records));
    tick(300);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((r) => r.eventId === 1)).toBeTrue();
  }));

  it('getAttendance vrátí prázdné pole pro neexistující eventId', fakeAsync(() => {
    let result: AttendanceRecord[] = [];
    service.getAttendance(9999).subscribe((records) => (result = records));
    tick(300);
    expect(result.length).toBe(0);
  }));

  it('getMemberAttendance vrátí záznamy pro daného člena', fakeAsync(() => {
    let result: AttendanceRecord[] = [];
    service.getMemberAttendance(1).subscribe((records) => (result = records));
    tick(300);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((r) => r.memberId === 1)).toBeTrue();
  }));

  it('updateAttendance aktualizuje existující záznam', fakeAsync(() => {
    const updated: AttendanceRecord = { eventId: 1, memberId: 1, status: 'no', note: 'Nemohu' };
    service.updateAttendance(updated).subscribe();
    tick(300);

    let result: AttendanceRecord[] = [];
    service.getAttendance(1).subscribe((records) => (result = records));
    tick(300);

    const record = result.find((r) => r.memberId === 1);
    expect(record?.status).toBe('no');
    expect(record?.note).toBe('Nemohu');
  }));

  it('updateAttendance přidá nový záznam, pokud neexistuje', fakeAsync(() => {
    const newRecord: AttendanceRecord = { eventId: 3, memberId: 1, status: 'yes' };
    service.updateAttendance(newRecord).subscribe();
    tick(300);

    let result: AttendanceRecord[] = [];
    service.getAttendance(3).subscribe((records) => (result = records));
    tick(300);

    expect(result.some((r) => r.memberId === 1 && r.status === 'yes')).toBeTrue();
  }));

  it('updateAttendance vrátí aktualizovaný záznam', fakeAsync(() => {
    const record: AttendanceRecord = { eventId: 1, memberId: 2, status: 'maybe' };
    let returned: AttendanceRecord | undefined;
    service.updateAttendance(record).subscribe((r) => (returned = r));
    tick(300);
    expect(returned?.status).toBe('maybe');
  }));

  it('markViewed vytvoří pending záznam s firstViewedAt, pokud neexistuje', fakeAsync(() => {
    service.markViewed(3, 8).subscribe();
    tick(300);

    let result: AttendanceRecord[] = [];
    service.getAttendance(3).subscribe((records) => (result = records));
    tick(300);

    const record = result.find((r) => r.memberId === 8);
    expect(record?.status).toBe('pending');
    expect(record?.firstViewedAt).toBeTruthy();
  }));

  it('markViewed doplní firstViewedAt k existujícímu záznamu beze změny stavu', fakeAsync(() => {
    service.updateAttendance({ eventId: 1, memberId: 1, status: 'yes' }).subscribe();
    tick(300);

    service.markViewed(1, 1).subscribe();
    tick(300);

    let result: AttendanceRecord[] = [];
    service.getAttendance(1).subscribe((records) => (result = records));
    tick(300);

    const record = result.find((r) => r.memberId === 1);
    expect(record?.status).toBe('yes');
    expect(record?.firstViewedAt).toBeTruthy();
  }));

  it('markViewed podruhé nepřepíše už nastavený firstViewedAt', fakeAsync(() => {
    service.markViewed(5, 9).subscribe();
    tick(300);

    let firstResult: AttendanceRecord[] = [];
    service.getAttendance(5).subscribe((records) => (firstResult = records));
    tick(300);
    const firstViewedAt = firstResult.find((r) => r.memberId === 9)?.firstViewedAt;

    service.markViewed(5, 9).subscribe();
    tick(300);

    let secondResult: AttendanceRecord[] = [];
    service.getAttendance(5).subscribe((records) => (secondResult = records));
    tick(300);

    expect(secondResult.find((r) => r.memberId === 9)?.firstViewedAt).toBe(firstViewedAt);
  }));
});

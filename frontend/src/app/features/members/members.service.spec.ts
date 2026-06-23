import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { MembersService } from './members.service';
import { Member } from '../../core/models/member.model';
import { MOCK_MEMBERS } from './data/mock-members';

describe('MembersService', () => {
  let service: MembersService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MembersService);
  });

  it('getMembers vrátí všechny členy', fakeAsync(() => {
    let result: Member[] = [];
    service.getMembers().subscribe((members) => (result = members));
    tick(300);
    expect(result.length).toBe(MOCK_MEMBERS.length);
  }));

  it('getMembers vrátí kopii pole, ne referenci na mock data', fakeAsync(() => {
    let result: Member[] = [];
    service.getMembers().subscribe((members) => (result = members));
    tick(300);
    expect(result).not.toBe(MOCK_MEMBERS);
  }));

  it('getActiveMembers vrátí pouze aktivní členy', fakeAsync(() => {
    let result: Member[] = [];
    service.getActiveMembers().subscribe((members) => (result = members));
    tick(300);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((m) => m.isActive)).toBeTrue();
    expect(result.length).toBeLessThan(MOCK_MEMBERS.length);
  }));

  it('getMember vrátí člena se správným id', fakeAsync(() => {
    let result: Member | undefined;
    service.getMember(1).subscribe((member) => (result = member));
    tick(300);
    expect(result?.id).toBe(1);
    expect(result?.name).toBeTruthy();
  }));

  it('getMember vrátí undefined pro neexistující id', fakeAsync(() => {
    let result: Member | undefined = { id: 0 } as Member;
    service.getMember(9999).subscribe((member) => (result = member));
    tick(300);
    expect(result).toBeUndefined();
  }));
});

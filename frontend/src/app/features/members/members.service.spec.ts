import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { MembersService } from './members.service';
import { Member } from '../../core/models/member.model';
import { MOCK_MEMBERS } from './data/mock-members';

describe('MembersService', () => {
  let service: MembersService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MembersService);
    service.resetCache();
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

  it('createMember přidá nového člena', fakeAsync(() => {
    const newMember: Omit<Member, 'id'> = {
      ensembleId: 1,
      userId: 99,
      name: 'Nový člen',
      email: 'novy@soubor.cz',
      phone: '777 999 999',
      groupIds: [1],
      isActive: true,
    };
    let created: Member | undefined;
    service.createMember(newMember).subscribe((m) => (created = m));
    tick(300);
    expect(created).toBeDefined();
    expect(created?.id).toBeGreaterThan(0);
    expect(created?.name).toBe('Nový člen');

    let allMembers: Member[] = [];
    service.getMembers().subscribe((m) => (allMembers = m));
    tick(300);
    expect(allMembers.length).toBeGreaterThan(MOCK_MEMBERS.length);
  }));

  it('updateMember upraví existujícího člena', fakeAsync(() => {
    const updated: Omit<Member, 'id'> = {
      ensembleId: 1,
      userId: 1,
      name: 'Jana Upravená',
      email: 'jana-updated@soubor.cz',
      phone: '601 000 000',
      groupIds: [2, 3],
      isActive: true,
    };
    let result: Member | undefined;
    service.updateMember(1, updated).subscribe((m) => (result = m));
    tick(300);
    expect(result?.id).toBe(1);
    expect(result?.name).toBe('Jana Upravená');
    expect(result?.email).toBe('jana-updated@soubor.cz');
  }));

  it('updateMember vrátí undefined pro neexistující id', fakeAsync(() => {
    const updated: Omit<Member, 'id'> = {
      ensembleId: 1,
      userId: 1,
      name: 'Někdo',
      email: 'nekdo@soubor.cz',
      groupIds: [],
      isActive: true,
    };
    let result: Member | undefined = {} as Member;
    service.updateMember(9999, updated).subscribe((m) => (result = m));
    tick(300);
    expect(result).toBeUndefined();
  }));

  it('deleteMember odstraní člena', fakeAsync(() => {
    let deleted: boolean = false;
    service.deleteMember(1).subscribe((success) => (deleted = success));
    tick(300);
    expect(deleted).toBeTrue();

    let members: Member[] = [];
    service.getMembers().subscribe((m) => (members = m));
    tick(300);
    expect(members.find((m) => m.id === 1)).toBeUndefined();
  }));

  it('deleteMember vrátí false pro neexistující id', fakeAsync(() => {
    let deleted: boolean = true;
    service.deleteMember(9999).subscribe((success) => (deleted = success));
    tick(300);
    expect(deleted).toBeFalse();
  }));
});

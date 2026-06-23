import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { GroupsService } from './groups.service';
import { Group } from '../../core/models/group.model';
import { MOCK_GROUPS } from './data/mock-groups';

describe('GroupsService', () => {
  let service: GroupsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GroupsService);
    service.resetCache();
  });

  it('getGroups vrátí všechny skupiny', fakeAsync(() => {
    let result: Group[] = [];
    service.getGroups().subscribe((groups) => (result = groups));
    tick(300);
    expect(result.length).toBe(MOCK_GROUPS.length);
  }));

  it('getGroups vrátí kopii pole, ne referenci na mock data', fakeAsync(() => {
    let result: Group[] = [];
    service.getGroups().subscribe((groups) => (result = groups));
    tick(300);
    expect(result).not.toBe(MOCK_GROUPS);
  }));

  it('getGroup vrátí skupinu se správným id', fakeAsync(() => {
    let result: Group | undefined;
    service.getGroup(1).subscribe((group) => (result = group));
    tick(300);
    expect(result?.id).toBe(1);
    expect(result?.name).toBe('Dospělí');
  }));

  it('getGroup vrátí undefined pro neexistující id', fakeAsync(() => {
    let result: Group | undefined = {} as Group;
    service.getGroup(9999).subscribe((group) => (result = group));
    tick(300);
    expect(result).toBeUndefined();
  }));

  it('createGroup přidá novou skupinu', fakeAsync(() => {
    const newGroup: Omit<Group, 'id'> = {
      ensembleId: 1,
      name: 'Nová skupina',
      slug: 'nova-skupina',
    };
    let created: Group | undefined;
    service.createGroup(newGroup).subscribe((g) => (created = g));
    tick(300);
    expect(created).toBeDefined();
    expect(created?.id).toBeGreaterThan(0);
    expect(created?.name).toBe('Nová skupina');

    let allGroups: Group[] = [];
    service.getGroups().subscribe((g) => (allGroups = g));
    tick(300);
    expect(allGroups.length).toBeGreaterThan(MOCK_GROUPS.length);
  }));

  it('updateGroup upraví existující skupinu', fakeAsync(() => {
    const updated: Omit<Group, 'id'> = {
      ensembleId: 1,
      name: 'Upravená skupina',
      slug: 'upravena-skupina',
    };
    let result: Group | undefined;
    service.updateGroup(1, updated).subscribe((g) => (result = g));
    tick(300);
    expect(result?.id).toBe(1);
    expect(result?.name).toBe('Upravená skupina');
    expect(result?.slug).toBe('upravena-skupina');
  }));

  it('updateGroup vrátí undefined pro neexistující id', fakeAsync(() => {
    const updated: Omit<Group, 'id'> = {
      ensembleId: 1,
      name: 'Něco',
      slug: 'neco',
    };
    let result: Group | undefined = {} as Group;
    service.updateGroup(9999, updated).subscribe((g) => (result = g));
    tick(300);
    expect(result).toBeUndefined();
  }));

  it('deleteGroup odstraní skupinu', fakeAsync(() => {
    let deleted: boolean = false;
    service.deleteGroup(1).subscribe((success) => (deleted = success));
    tick(300);
    expect(deleted).toBeTrue();

    let groups: Group[] = [];
    service.getGroups().subscribe((g) => (groups = g));
    tick(300);
    expect(groups.find((g) => g.id === 1)).toBeUndefined();
  }));

  it('deleteGroup vrátí false pro neexistující id', fakeAsync(() => {
    let deleted: boolean = true;
    service.deleteGroup(9999).subscribe((success) => (deleted = success));
    tick(300);
    expect(deleted).toBeFalse();
  }));
});

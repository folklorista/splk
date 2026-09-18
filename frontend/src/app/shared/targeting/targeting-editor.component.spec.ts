import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { TargetingEditorComponent } from './targeting-editor.component';
import { GroupsService } from '../../features/groups/groups.service';
import { MembersService } from '../../features/members/members.service';
import { Group } from '../../core/models/group.model';
import { Member } from '../../core/models/member.model';

describe('TargetingEditorComponent', () => {
  let groupsSpy: jasmine.SpyObj<GroupsService>;
  let membersSpy: jasmine.SpyObj<MembersService>;

  const groups: Group[] = [
    { id: 1, ensembleId: 1, name: 'Tanečníci', slug: 'tanecnici' },
    { id: 2, ensembleId: 1, name: 'Muzikanti', slug: 'muzikanti' },
  ];

  const members: Member[] = [
    { id: 1, ensembleId: 1, userId: 1, name: 'Jana Nováková', email: 'jana@soubor.cz', groupIds: [1], isActive: true },
    { id: 2, ensembleId: 1, userId: 2, name: 'Petr Novák', email: 'petr@soubor.cz', groupIds: [1], isActive: true },
    { id: 3, ensembleId: 1, userId: 3, name: 'Eva Svobodová', email: 'eva@soubor.cz', groupIds: [2], isActive: true },
  ];

  function configure(): void {
    groupsSpy = jasmine.createSpyObj('GroupsService', ['getGroups']);
    groupsSpy.getGroups.and.returnValue(of(groups));

    membersSpy = jasmine.createSpyObj('MembersService', ['getMembers']);
    membersSpy.getMembers.and.returnValue(of(members));

    TestBed.configureTestingModule({
      imports: [TargetingEditorComponent],
      providers: [
        { provide: GroupsService, useValue: groupsSpy },
        { provide: MembersService, useValue: membersSpy },
      ],
    });
  }

  it('toggleGroup přidá a znovu odebere skupinu a emituje změnu', () => {
    configure();
    const fixture = TestBed.createComponent(TargetingEditorComponent);
    fixture.detectChanges();
    const emitted: number[][] = [];
    fixture.componentInstance.selectedGroupIdsChange.subscribe((v) => emitted.push(v));

    fixture.componentInstance.toggleGroup(1);
    expect(fixture.componentInstance.selectedGroupIds).toEqual([1]);

    fixture.componentInstance.toggleGroup(1);
    expect(fixture.componentInstance.selectedGroupIds).toEqual([]);

    expect(emitted).toEqual([[1], []]);
  });

  it('addMember přidá člena jen jednou a removeMember ho odebere', () => {
    configure();
    const fixture = TestBed.createComponent(TargetingEditorComponent);
    fixture.detectChanges();

    fixture.componentInstance.addMember(2);
    fixture.componentInstance.addMember(2);
    expect(fixture.componentInstance.selectedMemberIds).toEqual([2]);

    fixture.componentInstance.removeMember(2);
    expect(fixture.componentInstance.selectedMemberIds).toEqual([]);
  });

  it('bulkAddFromGroup přidá všechny aktuální členy skupiny bez duplicit', () => {
    configure();
    const fixture = TestBed.createComponent(TargetingEditorComponent);
    fixture.detectChanges();

    fixture.componentInstance.addMember(1);
    fixture.componentInstance.bulkAddFromGroup(1);

    expect(fixture.componentInstance.selectedMemberIds.sort()).toEqual([1, 2]);
  });

  it('selectedMembers a availableMembers reagují na vstupní pole', () => {
    configure();
    const fixture = TestBed.createComponent(TargetingEditorComponent);
    fixture.componentInstance.selectedMemberIds = [3];
    fixture.detectChanges();

    expect(fixture.componentInstance.selectedMembers().map((m) => m.id)).toEqual([3]);
    expect(fixture.componentInstance.availableMembers().map((m) => m.id).sort()).toEqual([1, 2]);
  });
});

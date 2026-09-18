import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { AdminGroupFormComponent } from './admin-group-form.component';
import { GroupsService } from '../../../../features/groups/groups.service';
import { MembersService } from '../../../../features/members/members.service';
import { Group } from '../../../../core/models/group.model';
import { Member } from '../../../../core/models/member.model';

describe('AdminGroupFormComponent', () => {
  let groupsSpy: jasmine.SpyObj<GroupsService>;
  let membersSpy: jasmine.SpyObj<MembersService>;

  const group: Group = { id: 1, ensembleId: 1, name: 'Tanečníci', slug: 'tanecnici', icon: 'footprints' };

  const memberInGroup: Member = {
    id: 1, ensembleId: 1, userId: 1, name: 'Jana Nováková', email: 'jana@soubor.cz', groupIds: [1], isActive: true,
  };
  const memberNotInGroup: Member = {
    id: 2, ensembleId: 1, userId: 2, name: 'Petr Novák', email: 'petr@soubor.cz', groupIds: [], isActive: true,
  };

  function configure(paramMap: Record<string, string>): void {
    groupsSpy = jasmine.createSpyObj('GroupsService', ['getGroup', 'updateGroup', 'createGroup']);
    groupsSpy.getGroup.and.returnValue(of(group));
    groupsSpy.updateGroup.and.returnValue(of(group));

    membersSpy = jasmine.createSpyObj('MembersService', ['getMembers', 'updateMember']);
    membersSpy.getMembers.and.returnValue(of([memberInGroup, memberNotInGroup]));
    membersSpy.updateMember.and.returnValue(of(memberNotInGroup));

    TestBed.configureTestingModule({
      imports: [AdminGroupFormComponent],
      providers: [
        provideRouter([]),
        { provide: GroupsService, useValue: groupsSpy },
        { provide: MembersService, useValue: membersSpy },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: (key: string) => paramMap[key] ?? null } } },
        },
      ],
    });
  }

  it('rozdělí členy na ty ve skupině a ty dostupné k přidání', () => {
    configure({ id: '1' });
    const fixture = TestBed.createComponent(AdminGroupFormComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.groupMembers()).toEqual([memberInGroup]);
    expect(fixture.componentInstance.availableMembers()).toEqual([memberNotInGroup]);
  });

  it('addMember/removeMember jen přeskupí lokální seznamy, nic hned neuloží', () => {
    configure({ id: '1' });
    const fixture = TestBed.createComponent(AdminGroupFormComponent);
    fixture.detectChanges();

    fixture.componentInstance.addMember(memberNotInGroup.id);
    expect(fixture.componentInstance.groupMembers()).toEqual([memberInGroup, memberNotInGroup]);
    expect(fixture.componentInstance.availableMembers()).toEqual([]);

    fixture.componentInstance.removeMember(memberInGroup.id);
    expect(fixture.componentInstance.groupMembers()).toEqual([memberNotInGroup]);
    expect(fixture.componentInstance.availableMembers()).toEqual([memberInGroup]);

    expect(membersSpy.updateMember).not.toHaveBeenCalled();
  });

  it('onSubmit uloží přidané i odebrané členy až po odeslání formuláře', () => {
    configure({ id: '1' });
    const fixture = TestBed.createComponent(AdminGroupFormComponent);
    fixture.detectChanges();

    fixture.componentInstance.addMember(memberNotInGroup.id);
    fixture.componentInstance.removeMember(memberInGroup.id);

    fixture.componentInstance.onSubmit();

    expect(groupsSpy.updateGroup).toHaveBeenCalled();
    expect(membersSpy.updateMember).toHaveBeenCalledWith(
      memberNotInGroup.id,
      jasmine.objectContaining({ groupIds: [1] }),
    );
    expect(membersSpy.updateMember).toHaveBeenCalledWith(
      memberInGroup.id,
      jasmine.objectContaining({ groupIds: [] }),
    );
  });

  it('onSubmit nevolá updateMember, když se členství nezměnilo', () => {
    configure({ id: '1' });
    const fixture = TestBed.createComponent(AdminGroupFormComponent);
    fixture.detectChanges();

    fixture.componentInstance.onSubmit();

    expect(groupsSpy.updateGroup).toHaveBeenCalled();
    expect(membersSpy.updateMember).not.toHaveBeenCalled();
  });

  it('v režimu vytvoření nenačítá členy skupiny', () => {
    configure({});
    const fixture = TestBed.createComponent(AdminGroupFormComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.isEditMode).toBeFalse();
    expect(membersSpy.getMembers).not.toHaveBeenCalled();
  });
});

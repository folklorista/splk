import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { TargetingEditorComponent } from './targeting-editor.component';
import { GroupsService } from '../../features/groups/groups.service';
import { Group } from '../../core/models/group.model';

describe('TargetingEditorComponent', () => {
  let groupsSpy: jasmine.SpyObj<GroupsService>;

  const groups: Group[] = [
    { id: 1, ensembleId: 1, name: 'Tanečníci', slug: 'tanecnici' },
    { id: 2, ensembleId: 1, name: 'Muzikanti', slug: 'muzikanti' },
  ];

  function configure(): void {
    groupsSpy = jasmine.createSpyObj('GroupsService', ['getGroups']);
    groupsSpy.getGroups.and.returnValue(of(groups));

    TestBed.configureTestingModule({
      imports: [TargetingEditorComponent],
      providers: [{ provide: GroupsService, useValue: groupsSpy }],
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

  it('isGroupSelected reaguje na vstupní pole', () => {
    configure();
    const fixture = TestBed.createComponent(TargetingEditorComponent);
    fixture.componentInstance.selectedGroupIds = [2];
    fixture.detectChanges();

    expect(fixture.componentInstance.isGroupSelected(2)).toBeTrue();
    expect(fixture.componentInstance.isGroupSelected(1)).toBeFalse();
  });
});

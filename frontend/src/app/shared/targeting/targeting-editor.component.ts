import { Component, EventEmitter, Input, OnInit, Output, signal } from '@angular/core';
import { GroupsService } from '../../features/groups/groups.service';
import { Group } from '../../core/models/group.model';
import { IconComponent } from '../icon/icon.component';

// Cílení na konkrétní lidi se neřeší – pro jednorázovou příležitost se založí vlastní skupina
@Component({
  selector: 'app-targeting-editor',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="targeting-editor">
      <div class="targeting-editor__field">
        <label>Cílové skupiny</label>
        <p class="targeting-editor__hint">Nic nevybráno = viditelné pro všechny.</p>
        @if (groups().length === 0) {
          <p class="member-column__empty">Žádné skupiny.</p>
        } @else {
          <div class="targeting-editor__group-grid">
            @for (group of groups(); track group.id) {
              <label class="targeting-editor__group-option">
                <input type="checkbox" [checked]="isGroupSelected(group.id)" (change)="toggleGroup(group.id)" />
                @if (group.icon) {
                  <app-icon [name]="group.icon" [size]="14" />
                }
                {{ group.name }}
              </label>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .targeting-editor { display: flex; flex-direction: column; gap: var(--spacing-md); }
    .targeting-editor__field { display: flex; flex-direction: column; gap: var(--spacing-xs); }
    .targeting-editor__hint { margin: 0; font-size: var(--font-size-sm); color: var(--color-text-muted); }
    .targeting-editor__group-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: var(--spacing-xs); }
    .targeting-editor__group-option { display: flex; align-items: center; gap: 4px; font-size: var(--font-size-sm); }
  `],
})
export class TargetingEditorComponent implements OnInit {
  private _selectedGroupIds = signal<number[]>([]);

  @Input()
  set selectedGroupIds(value: number[] | undefined) {
    this._selectedGroupIds.set(value ?? []);
  }
  get selectedGroupIds(): number[] {
    return this._selectedGroupIds();
  }

  @Output() selectedGroupIdsChange = new EventEmitter<number[]>();

  groups = signal<Group[]>([]);

  constructor(private groupsService: GroupsService) {}

  ngOnInit(): void {
    this.groupsService.getGroups().subscribe((groups) => this.groups.set(groups));
  }

  isGroupSelected(groupId: number): boolean {
    return this._selectedGroupIds().includes(groupId);
  }

  toggleGroup(groupId: number): void {
    const current = this._selectedGroupIds();
    const next = current.includes(groupId) ? current.filter((id) => id !== groupId) : [...current, groupId];
    this._selectedGroupIds.set(next);
    this.selectedGroupIdsChange.emit(next);
  }
}

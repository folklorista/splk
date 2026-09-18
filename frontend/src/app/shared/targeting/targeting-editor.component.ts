import { Component, EventEmitter, Input, OnInit, Output, computed, signal } from '@angular/core';
import { GroupsService } from '../../features/groups/groups.service';
import { MembersService } from '../../features/members/members.service';
import { Group } from '../../core/models/group.model';
import { Member } from '../../core/models/member.model';
import { IconComponent } from '../icon/icon.component';

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

      <div class="targeting-editor__field">
        <label>Konkrétní lidé</label>
        <p class="targeting-editor__hint">Uvidí to i mimo cílové skupiny.</p>
        @if (selectedMembers().length === 0) {
          <p class="member-column__empty">Nikdo nepřidán.</p>
        } @else {
          <ul class="targeting-editor__member-list">
            @for (member of selectedMembers(); track member.id) {
              <li>
                <span>{{ member.name }}</span>
                <button type="button" (click)="removeMember(member.id)" title="Odebrat">
                  <app-icon name="close" [size]="10" />
                </button>
              </li>
            }
          </ul>
        }

        @if (availableMembers().length > 0) {
          <div class="targeting-editor__add-row">
            <select #memberSelect>
              @for (m of availableMembers(); track m.id) {
                <option [value]="m.id">{{ m.name }}</option>
              }
            </select>
            <button type="button" class="attendance-btn" (click)="addMember(+memberSelect.value)">+ Přidat</button>
          </div>
        }

        @if (groups().length > 0) {
          <div class="targeting-editor__add-row">
            <select #bulkGroupSelect>
              @for (g of groups(); track g.id) {
                <option [value]="g.id">{{ g.name }}</option>
              }
            </select>
            <button type="button" class="attendance-btn" (click)="bulkAddFromGroup(+bulkGroupSelect.value)">
              Přidat všechny ze skupiny
            </button>
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
    .targeting-editor__member-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
    .targeting-editor__member-list li { display: flex; align-items: center; justify-content: space-between; font-size: var(--font-size-sm); }
    .targeting-editor__member-list button { display: flex; color: var(--color-text-muted); }
    .targeting-editor__member-list button:hover { color: #d32f2f; }
    .targeting-editor__add-row { display: flex; gap: var(--spacing-sm); align-items: center; flex-wrap: wrap; }
    .targeting-editor__add-row select { padding: 6px var(--spacing-sm); border: 1px solid var(--color-border); border-radius: 6px; font-size: var(--font-size-sm); font-family: inherit; }
  `],
})
export class TargetingEditorComponent implements OnInit {
  private _selectedGroupIds = signal<number[]>([]);
  private _selectedMemberIds = signal<number[]>([]);

  @Input()
  set selectedGroupIds(value: number[] | undefined) {
    this._selectedGroupIds.set(value ?? []);
  }
  get selectedGroupIds(): number[] {
    return this._selectedGroupIds();
  }

  @Input()
  set selectedMemberIds(value: number[] | undefined) {
    this._selectedMemberIds.set(value ?? []);
  }
  get selectedMemberIds(): number[] {
    return this._selectedMemberIds();
  }

  @Output() selectedGroupIdsChange = new EventEmitter<number[]>();
  @Output() selectedMemberIdsChange = new EventEmitter<number[]>();

  groups = signal<Group[]>([]);
  allMembers = signal<Member[]>([]);

  readonly selectedMembers = computed(() =>
    this.allMembers().filter((m) => this._selectedMemberIds().includes(m.id)),
  );
  readonly availableMembers = computed(() =>
    this.allMembers().filter((m) => !this._selectedMemberIds().includes(m.id)),
  );

  constructor(
    private groupsService: GroupsService,
    private membersService: MembersService,
  ) {}

  ngOnInit(): void {
    this.groupsService.getGroups().subscribe((groups) => this.groups.set(groups));
    this.membersService.getMembers().subscribe((members) => this.allMembers.set(members));
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

  addMember(memberId: number): void {
    if (!memberId || this._selectedMemberIds().includes(memberId)) return;
    const next = [...this._selectedMemberIds(), memberId];
    this._selectedMemberIds.set(next);
    this.selectedMemberIdsChange.emit(next);
  }

  removeMember(memberId: number): void {
    const next = this._selectedMemberIds().filter((id) => id !== memberId);
    this._selectedMemberIds.set(next);
    this.selectedMemberIdsChange.emit(next);
  }

  bulkAddFromGroup(groupId: number): void {
    if (!groupId) return;
    const groupMemberIds = this.allMembers()
      .filter((m) => m.groupIds.includes(groupId))
      .map((m) => m.id);
    const next = [...new Set([...this._selectedMemberIds(), ...groupMemberIds])];
    this._selectedMemberIds.set(next);
    this.selectedMemberIdsChange.emit(next);
  }
}

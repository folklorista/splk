import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { GroupInput, GroupPatch, GroupMemberInput, ManagedGroup } from '@splk/api-contracts';
import { OrganizationApi } from '../../data/organization/organization-api';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../data/api-error';
import { errorMessage } from '../../core/auth/error-messages';

/** Organization administration; holding a costume mandate never grants group editing. */
@Injectable()
export class GroupsStore {
  private readonly api = inject(OrganizationApi);
  private readonly auth = inject(AuthService);
  readonly groups = signal<ManagedGroup[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  private request = 0;

  async load(): Promise<void> {
    const request = ++this.request;
    this.loading.set(true); this.error.set(null);
    try {
      this.requireAdmin();
      const rows = await firstValueFrom(this.api.groups());
      this.requireAdmin();
      if (request === this.request) this.groups.set(rows);
    } catch (e) { if (request === this.request) { this.groups.set([]); this.error.set(errorMessage(e)); } }
    finally { if (request === this.request) this.loading.set(false); }
  }
  create(input: GroupInput) { return this.write(() => this.api.createGroup(input)); }
  update(id: number, input: GroupPatch) { return this.write(() => this.api.updateGroup(id, input)); }
  add(id: number, input: GroupMemberInput) { return this.write(() => this.api.addGroupMember(id, input)); }
  revoke(id: number, membership: number) { return this.write(() => this.api.revokeGroupMember(id, membership)); }

  private async write(action: () => Observable<ManagedGroup>): Promise<ManagedGroup> {
    this.requireAdmin();
    if (this.saving()) throw new ApiError(409, 'version_conflict');
    this.saving.set(true); ++this.request; this.loading.set(false);
    try {
      const row = await firstValueFrom(action()); this.requireAdmin();
      this.groups.update((rows) => [...rows.filter((g) => g.id !== row.id), row].sort((a, b) => a.name.localeCompare(b.name, 'cs')));
      return row;
    } finally { this.saving.set(false); }
  }
  private requireAdmin(): void { if (!this.auth.hasMandate('organization.admin')) throw new ApiError(403, 'forbidden'); }
}

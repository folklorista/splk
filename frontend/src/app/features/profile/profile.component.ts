import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { MembersService } from '../members/members.service';
import { GroupsService } from '../groups/groups.service';
import { EventsService } from '../events/events.service';
import { getUnconfirmedEventsCount } from '../../core/utils/visibility.utils';
import { Group } from '../../core/models/group.model';
import { IconComponent, IconName } from '../../shared/icon/icon.component';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent],
  templateUrl: './profile.component.html',
  styles: [`
    .profile-page {
      padding: 1rem;
      max-width: 600px;
      margin: 0 auto;
    }

    .profile-header {
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid #ddd;
    }

    .profile-header h1 {
      margin: 0 0 0.5rem;
      font-size: 1.5rem;
      color: #333;
    }

    .profile-section {
      margin-bottom: 2rem;
    }

    .profile-section h2 {
      margin: 0 0 1rem;
      font-size: 1rem;
      font-weight: 600;
      color: #555;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .profile-field {
      padding: 0.75rem;
      margin-bottom: 0.75rem;
      background: #f9f9f9;
      border-radius: 4px;
      border-left: 3px solid #0066cc;
    }

    .profile-field-label {
      font-size: 0.85rem;
      color: #666;
      margin-bottom: 0.25rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .profile-field-value {
      font-size: 0.95rem;
      color: #333;
      font-weight: 500;
    }

    .role-badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      margin-right: 0.5rem;
      margin-bottom: 0.5rem;
      background: #e3f2fd;
      color: #0066cc;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: 500;
    }

    .role-badge.admin {
      background: #ffebee;
      color: #c94a3a;
    }

    .role-badge.leader {
      background: #f3e5f5;
      color: #7b1fa2;
    }

    .group-badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      margin-right: 0.5rem;
      margin-bottom: 0.5rem;
      background: #e8f5e9;
      color: #2e7d32;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: 500;
    }

    .pending-events {
      display: block;
      padding: 1rem;
      background: #fff3cd;
      border: 1px solid #ffc107;
      border-radius: 4px;
      margin-bottom: 1rem;
      color: inherit;
      text-decoration: none;
    }

    .pending-events:hover {
      border-color: #856404;
    }

    .pending-events-count {
      font-weight: 600;
      color: #856404;
    }

    .logout-btn {
      display: block;
      width: 100%;
      padding: 0.85rem;
      margin-top: 2rem;
      background: #c94a3a;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 1rem;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    }

    .logout-btn:hover {
      background: #a73a2a;
    }

    .no-pending {
      padding: 1rem;
      background: #e8f5e9;
      border: 1px solid #4caf50;
      border-radius: 4px;
      color: #2e7d32;
      font-weight: 500;
    }
  `],
})
export class ProfileComponent {
  memberName = '';
  memberPhone = '';
  pendingEventCount = 0;
  private groupsById = new Map<number, Group>();

  constructor(
    private auth: AuthService,
    private members: MembersService,
    private groups: GroupsService,
    private events: EventsService,
    private router: Router,
  ) {
    this.loadMemberData();
    this.loadGroups();
  }

  get currentUser() {
    return this.auth.currentUser;
  }

  private loadMemberData(): void {
    const user = this.auth.currentUser();
    if (!user) return;

    this.members.getMembers().subscribe((members) => {
      const member = members.find((m) => m.email === user.email);
      if (!member) return;

      this.memberName = member.name;
      this.memberPhone = member.phone || '—';

      this.events.getEvents().subscribe((events) => {
        this.pendingEventCount = getUnconfirmedEventsCount(events, user, member.id);
      });
    });
  }

  private loadGroups(): void {
    this.groups.getGroups().subscribe((groups) => {
      this.groupsById = new Map(groups.map((group) => [group.id, group]));
    });
  }

  getGroupLabel(groupId: number): string {
    return this.groupsById.get(groupId)?.name || `Neznámá skupina (ID: ${groupId})`;
  }

  getGroupIcon(groupId: number): IconName | undefined {
    return this.groupsById.get(groupId)?.icon;
  }

  getRoleLabel(role: string): string {
    const labels: Record<string, string> = {
      admin: 'Administrátor',
      leader: 'Vedoucí',
      member: 'Člen',
    };
    return labels[role] || role;
  }

  getRoleBadgeClass(role: string): string {
    if (role === 'admin') return 'admin';
    if (role === 'leader') return 'leader';
    return '';
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}

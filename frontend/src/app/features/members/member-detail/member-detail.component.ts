import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Member } from '../../../core/models/member.model';
import { Group } from '../../../core/models/group.model';
import { MembersService } from '../members.service';
import { GroupsService } from '../../../core/services/groups.service';

@Component({
  selector: 'app-member-detail',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './member-detail.component.html',
})
export class MemberDetailComponent implements OnInit {
  member = signal<Member | null>(null);
  groups = signal<Group[]>([]);
  groupNames = () => this.groups().map((g) => g.name).join(', ');
  loading = signal(true);
  notFound = signal(false);

  constructor(
    private route: ActivatedRoute,
    private membersService: MembersService,
    private groupsService: GroupsService,
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.membersService.getMember(id).subscribe((member) => {
      if (!member) { this.notFound.set(true); this.loading.set(false); return; }
      this.member.set(member);
      this.groupsService.getGroupsByIds(member.groupIds).subscribe((groups) => {
        this.groups.set(groups);
        this.loading.set(false);
      });
    });
  }
}

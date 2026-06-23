import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Member } from '../../core/models/member.model';
import { MembersService } from './members.service';

@Component({
  selector: 'app-members',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './members.component.html',
})
export class MembersComponent implements OnInit {
  members = signal<Member[]>([]);
  loading = signal(true);

  constructor(private membersService: MembersService) {}

  ngOnInit(): void {
    this.membersService.getActiveMembers().subscribe((members) => {
      this.members.set(members);
      this.loading.set(false);
    });
  }
}

import { Injectable, inject } from '@angular/core';
import { Observable, defer, of } from 'rxjs';
import { AccessService } from '../../core/access/access.service';
import { isEnsembleAdmin } from '../../core/access/access.utils';
import { AccessDeniedError, RuleViolationError, deactivationProblem } from '../../core/access/mandate-rules';
import { getFullName } from '../../core/utils/member.utils';
import { MembersService } from '../members/members.service';
import { MandatesService } from '../mandates/mandates.service';
import { GroupsService } from '../groups/groups.service';
import { JoinRequestsService } from '../groups/join-requests.service';
import { AttendanceService } from '../attendance/attendance.service';
import { ActualAttendanceService } from '../attendance/actual-attendance.service';
import { PostsService } from '../posts/posts.service';
import { CommentsService } from '../posts/comments.service';
import { ChatService } from '../chat/chat.service';
import { EventChatService } from '../events/event-chat/event-chat.service';
import { EventsService } from '../events/events.service';
import { CostumeStoreService } from '../costumes/costume-store.service';
import { AvailabilityService } from '../availability/availability.service';
import { AuditService } from '../audit/audit.service';
import { PersonFootprint, costumeReferencesMember, deletionBlockers, hasOwnHistory } from './person-deletion';

// Trvalé smazání „čisté“ osoby (založené omylem). Osobu se stopou v evidenci smazat nelze –
// zůstává ukončení členství / vyřazení externisty (docs/08 kap. 4.1).
@Injectable({ providedIn: 'root' })
export class PersonDeletionService {
  private readonly access = inject(AccessService);
  private readonly members = inject(MembersService);
  private readonly mandates = inject(MandatesService);
  private readonly groups = inject(GroupsService);
  private readonly requests = inject(JoinRequestsService);
  private readonly attendance = inject(AttendanceService);
  private readonly actualAttendance = inject(ActualAttendanceService);
  private readonly posts = inject(PostsService);
  private readonly comments = inject(CommentsService);
  private readonly chat = inject(ChatService);
  private readonly eventChat = inject(EventChatService);
  private readonly events = inject(EventsService);
  private readonly costumes = inject(CostumeStoreService);
  private readonly availability = inject(AvailabilityService);
  private readonly audit = inject(AuditService);

  footprint(memberId: number): PersonFootprint {
    return {
      self: memberId === this.access.memberId(),
      responses: this.attendance.hasResponses(memberId),
      actualAttendance: this.actualAttendance.hasRecords(memberId),
      posts: this.posts.hasAuthored(memberId),
      comments: this.comments.isAuthor(memberId),
      chat: this.chat.isAuthor(memberId) || this.eventChat.isAuthor(memberId),
      mentions: this.posts.mentions(memberId) || this.comments.mentions(memberId) || this.chat.mentions(memberId) || this.eventChat.mentions(memberId),
      eventGuest: this.events.isGuest(memberId),
      costumes: costumeReferencesMember(this.costumes.snapshot, memberId),
      history: hasOwnHistory(this.audit.entries(), memberId),
    };
  }

  // Proč osobu nelze smazat; prázdné pole = lze
  blockers(memberId: number): string[] {
    return deletionBlockers(this.footprint(memberId));
  }

  deletePerson(memberId: number): Observable<void> {
    return defer(() => {
      const actor = this.access.subject();
      if (!actor || !isEnsembleAdmin(actor)) throw new AccessDeniedError('Osoby maže jen Správa souboru.');
      const member = this.members.findMember(memberId);
      if (!member) throw new RuleViolationError('Osoba neexistuje.');
      const blockers = this.blockers(memberId);
      if (blockers.length) throw new RuleViolationError(`Osobu nelze smazat: ${blockers.join(', ')}.`);
      const problem = deactivationProblem(memberId, this.mandates.mandates(), this.members.members(), (id) => this.groups.findGroup(id)?.name ?? `#${id}`);
      if (problem) throw new RuleViolationError(problem);

      this.mandates.mandates().filter((m) => m.memberId === memberId).forEach((m) => this.mandates.remove(m.id));
      this.requests.removeForMember(memberId);
      this.availability.removeAllFor(memberId);
      this.costumes.mutate((state) => void delete state.defaultCostumes[`member-${memberId}`], { profile: true }).subscribe();
      this.members.remove(memberId);
      // Jméno do historie – osoba už v evidenci nebude, aby šel záznam přečíst
      this.audit.record({ action: 'person-deleted', actorId: actor.memberId, groupIds: [], details: `${member.nickname} (${getFullName(member)})` });
      return of(undefined);
    });
  }
}

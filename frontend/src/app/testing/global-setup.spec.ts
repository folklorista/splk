import { clearDemoData } from '../core/data/demo-storage';
import { AUTH_STORAGE_KEY } from '../core/auth/auth.service';
import { MembersService } from '../features/members/members.service';
import { resetPostsCache } from '../features/posts/posts.service';
import { MandatesService } from '../features/mandates/mandates.service';
import { JoinRequestsService } from '../features/groups/join-requests.service';
import { AuditService } from '../features/audit/audit.service';
import { GroupsService } from '../features/groups/groups.service';
import { SETTINGS_STORAGE_KEY } from '../core/settings/settings.service';

// Globální beforeEach (mimo describe): každý test začíná s prázdným úložištěm a výchozími
// mock daty. Mock cache členů/příspěvků/skupin žijí na úrovni modulu, takže by si je jinak
// testy (spouštěné v náhodném pořadí) navzájem měnily.
beforeEach(() => {
  clearDemoData();
  localStorage.removeItem(AUTH_STORAGE_KEY);
  localStorage.removeItem(SETTINGS_STORAGE_KEY);
  new MembersService().resetCache();
  resetPostsCache();
  new MandatesService().resetCache();
  new JoinRequestsService().resetCache();
  new AuditService().resetCache();
  new GroupsService().resetCache();
});

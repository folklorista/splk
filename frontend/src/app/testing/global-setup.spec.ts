import { clearDemoData } from '../core/data/demo-storage';
import { AUTH_STORAGE_KEY } from '../core/auth/auth.service';
import { MembersService } from '../features/members/members.service';
import { PostsService } from '../features/posts/posts.service';
import { GroupsService } from '../features/groups/groups.service';

// Globální beforeEach (mimo describe): každý test začíná s prázdným úložištěm a výchozími
// mock daty. Mock cache členů/příspěvků/skupin žijí na úrovni modulu, takže by si je jinak
// testy (spouštěné v náhodném pořadí) navzájem měnily.
beforeEach(() => {
  clearDemoData();
  localStorage.removeItem(AUTH_STORAGE_KEY);
  new MembersService().resetCache();
  new PostsService().resetCache();
  new GroupsService().resetCache();
});

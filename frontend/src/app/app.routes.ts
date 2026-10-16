import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { attendanceGuard, ensembleAdminGuard, eventCreateGuard, groupCreateGuard, moduleGuard } from './core/access/access.guards';
import { boardGuard } from './features/boards/board.guard';
import { costumeManagerGuard, costumeStockGuard } from './features/costumes/costumes.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'app',
    loadComponent: () =>
      import('./core/layout/main-layout/main-layout.component').then(
        (m) => m.MainLayoutComponent,
      ),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent,
          ),
      },
      {
        path: 'boards',
        loadComponent: () =>
          import('./features/boards/boards.component').then(
            (m) => m.BoardsComponent,
          ),
      },
      {
        path: 'boards/:slug',
        loadComponent: () =>
          import('./features/groups/group-space/group-space.component').then(
            (m) => m.GroupSpaceComponent,
          ),
      },
      {
        path: 'boards/:slug/new',
        canActivate: [boardGuard],
        loadComponent: () =>
          import('./features/posts/post-form/post-form.component').then(
            (m) => m.PostFormComponent,
          ),
      },
      {
        path: 'posts/:id/edit',
        loadComponent: () =>
          import('./features/posts/post-form/post-form.component').then(
            (m) => m.PostFormComponent,
          ),
      },
      {
        path: 'posts/:id',
        loadComponent: () =>
          import('./features/posts/post-detail/post-detail.component').then(
            (m) => m.PostDetailComponent,
          ),
      },
      {
        path: 'events',
        canActivate: [moduleGuard('events')],
        loadComponent: () =>
          import('./features/events/events.component').then(
            (m) => m.EventsComponent,
          ),
      },
      {
        path: 'events/new',
        canActivate: [eventCreateGuard],
        loadComponent: () =>
          import('./features/events/event-form/event-form.component').then(
            (m) => m.EventFormComponent,
          ),
      },
      {
        path: 'events/:id/edit',
        canActivate: [moduleGuard('events')],
        loadComponent: () =>
          import('./features/events/event-form/event-form.component').then(
            (m) => m.EventFormComponent,
          ),
      },
      {
        path: 'events/:id',
        canActivate: [moduleGuard('events')],
        loadComponent: () =>
          import('./features/events/event-detail/event-detail.component').then(
            (m) => m.EventDetailComponent,
          ),
      },
      {
        path: 'attendance',
        canActivate: [attendanceGuard],
        loadComponent: () =>
          import('./features/attendance/attendance-report/attendance-report.component').then(
            (m) => m.AttendanceReportComponent,
          ),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings.component').then(
            (m) => m.SettingsComponent,
          ),
      },
      {
        path: 'changelog',
        loadComponent: () =>
          import('./features/changelog/changelog.component').then(
            (m) => m.ChangelogComponent,
          ),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/profile/profile.component').then(
            (m) => m.ProfileComponent,
          ),
      },
      {
        path: 'groups/new',
        canActivate: [groupCreateGuard],
        loadComponent: () =>
          import('./features/manage/manage-group.component').then((m) => m.ManageGroupComponent),
      },
      {
        path: 'costumes',
        canActivate: [moduleGuard('costumes')],
        loadComponent: () =>
          import('./features/costumes/costumes.component').then(
            (m) => m.CostumesComponent,
          ),
      },
      {
        path: 'costumes/items',
        canActivate: [costumeStockGuard],
        loadComponent: () =>
          import('./features/costumes/pages/items/items.component').then(
            (m) => m.CostumeItemsComponent,
          ),
      },
      {
        path: 'costumes/items/new',
        canActivate: [costumeManagerGuard],
        loadComponent: () =>
          import('./features/costumes/pages/item-form/item-form.component').then(
            (m) => m.CostumeItemFormComponent,
          ),
      },
      {
        path: 'costumes/items/:id/edit',
        canActivate: [costumeManagerGuard],
        loadComponent: () =>
          import('./features/costumes/pages/item-form/item-form.component').then(
            (m) => m.CostumeItemFormComponent,
          ),
      },
      {
        path: 'costumes/items/:id',
        canActivate: [costumeStockGuard],
        loadComponent: () =>
          import('./features/costumes/pages/item-detail/item-detail.component').then(
            (m) => m.CostumeItemDetailComponent,
          ),
      },
      {
        path: 'costumes/kits',
        canActivate: [costumeStockGuard],
        loadComponent: () =>
          import('./features/costumes/pages/kits/kits.component').then(
            (m) => m.CostumeKitsComponent,
          ),
      },
      {
        path: 'costumes/kits/:id',
        canActivate: [costumeStockGuard],
        loadComponent: () =>
          import('./features/costumes/pages/kit-detail/kit-detail.component').then(
            (m) => m.CostumeKitDetailComponent,
          ),
      },
      {
        path: 'costumes/loans',
        canActivate: [costumeStockGuard],
        loadComponent: () =>
          import('./features/costumes/pages/loans/loans.component').then(
            (m) => m.CostumeLoansComponent,
          ),
      },
      {
        path: 'costumes/loans/new',
        canActivate: [costumeManagerGuard],
        loadComponent: () =>
          import('./features/costumes/pages/loan-form/loan-form.component').then(
            (m) => m.CostumeLoanFormComponent,
          ),
      },
      {
        path: 'costumes/loans/:id',
        canActivate: [costumeStockGuard],
        loadComponent: () =>
          import('./features/costumes/pages/loan-detail/loan-detail.component').then(
            (m) => m.CostumeLoanDetailComponent,
          ),
      },
      {
        path: 'costumes/people',
        canActivate: [costumeStockGuard],
        loadComponent: () =>
          import('./features/costumes/pages/people/people.component').then(
            (m) => m.CostumePeopleComponent,
          ),
      },
      {
        path: 'costumes/people/:key',
        canActivate: [costumeStockGuard],
        loadComponent: () =>
          import('./features/costumes/pages/person/person.component').then(
            (m) => m.CostumePersonComponent,
          ),
      },
      {
        path: 'costumes/inventories',
        canActivate: [costumeStockGuard],
        loadComponent: () =>
          import('./features/costumes/pages/inventories/inventories.component').then(
            (m) => m.CostumeInventoriesComponent,
          ),
      },
      {
        path: 'costumes/inventories/:id',
        canActivate: [costumeStockGuard],
        loadComponent: () =>
          import('./features/costumes/pages/inventory-detail/inventory-detail.component').then(
            (m) => m.CostumeInventoryDetailComponent,
          ),
      },
      // Dřívější Administrace – staré odkazy vedou do Správy
      { path: 'admin', redirectTo: 'manage', pathMatch: 'prefix' },
      {
        path: 'manage',
        canActivate: [ensembleAdminGuard],
        loadComponent: () =>
          import('./features/manage/manage-layout.component').then((m) => m.ManageLayoutComponent),
        children: [
          { path: '', redirectTo: 'members', pathMatch: 'full' },
          {
            path: 'members',
            loadComponent: () =>
              import('./features/manage/manage-members.component').then((m) => m.ManageMembersComponent),
          },
          {
            path: 'members/new',
            loadComponent: () =>
              import('./features/manage/manage-person.component').then((m) => m.ManagePersonComponent),
          },
          {
            path: 'members/:id',
            loadComponent: () =>
              import('./features/manage/manage-person.component').then((m) => m.ManagePersonComponent),
          },
          {
            path: 'groups',
            loadComponent: () =>
              import('./features/manage/manage-groups.component').then((m) => m.ManageGroupsComponent),
          },
          {
            path: 'groups/new',
            loadComponent: () =>
              import('./features/manage/manage-group.component').then((m) => m.ManageGroupComponent),
          },
          {
            path: 'groups/:id',
            loadComponent: () =>
              import('./features/manage/manage-group.component').then((m) => m.ManageGroupComponent),
          },
          {
            path: 'config',
            loadComponent: () =>
              import('./features/manage/manage-config.component').then((m) => m.ManageConfigComponent),
          },
          {
            path: 'history',
            loadComponent: () =>
              import('./features/manage/manage-history.component').then((m) => m.ManageHistoryComponent),
          },
        ],
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
  { path: '', redirectTo: '/app/dashboard', pathMatch: 'full' },
  { path: '**', redirectTo: '/login' },
];

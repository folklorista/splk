import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { adminGuard } from './core/auth/admin.guard';
import { leaderGuard } from './core/auth/leader.guard';
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
        canActivate: [boardGuard],
        loadComponent: () =>
          import('./features/posts/posts.component').then(
            (m) => m.PostsComponent,
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
        loadComponent: () =>
          import('./features/events/events.component').then(
            (m) => m.EventsComponent,
          ),
      },
      {
        path: 'events/:id',
        loadComponent: () =>
          import('./features/events/event-detail/event-detail.component').then(
            (m) => m.EventDetailComponent,
          ),
      },
      {
        path: 'attendance',
        canActivate: [leaderGuard],
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
        path: 'costumes',
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
      {
        path: 'admin',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./admin/layout/admin-layout/admin-layout.component').then(
            (m) => m.AdminLayoutComponent,
          ),
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./admin/pages/admin-dashboard/admin-dashboard.component').then(
                (m) => m.AdminDashboardComponent,
              ),
          },
          {
            path: 'posts',
            children: [
              {
                path: '',
                loadComponent: () =>
                  import('./admin/pages/admin-posts/admin-posts.component').then(
                    (m) => m.AdminPostsComponent,
                  ),
              },
              {
                path: 'new',
                loadComponent: () =>
                  import('./admin/pages/admin-posts/admin-post-form/admin-post-form.component').then(
                    (m) => m.AdminPostFormComponent,
                  ),
              },
              {
                path: ':id/edit',
                loadComponent: () =>
                  import('./admin/pages/admin-posts/admin-post-form/admin-post-form.component').then(
                    (m) => m.AdminPostFormComponent,
                  ),
              },
            ],
          },
          {
            path: 'events',
            children: [
              {
                path: '',
                loadComponent: () =>
                  import('./admin/pages/admin-events/admin-events.component').then(
                    (m) => m.AdminEventsComponent,
                  ),
              },
              {
                path: 'new',
                loadComponent: () =>
                  import('./admin/pages/admin-events/admin-event-form/admin-event-form.component').then(
                    (m) => m.AdminEventFormComponent,
                  ),
              },
              {
                path: ':id/edit',
                loadComponent: () =>
                  import('./admin/pages/admin-events/admin-event-form/admin-event-form.component').then(
                    (m) => m.AdminEventFormComponent,
                  ),
              },
            ],
          },
          {
            path: 'members',
            children: [
              {
                path: '',
                loadComponent: () =>
                  import('./admin/pages/admin-members/admin-members.component').then(
                    (m) => m.AdminMembersComponent,
                  ),
              },
              {
                path: 'new',
                loadComponent: () =>
                  import('./admin/pages/admin-members/admin-member-form/admin-member-form.component').then(
                    (m) => m.AdminMemberFormComponent,
                  ),
              },
              {
                path: ':id/edit',
                loadComponent: () =>
                  import('./admin/pages/admin-members/admin-member-form/admin-member-form.component').then(
                    (m) => m.AdminMemberFormComponent,
                  ),
              },
            ],
          },
          {
            path: 'groups',
            children: [
              {
                path: '',
                loadComponent: () =>
                  import('./admin/pages/admin-groups/admin-groups.component').then(
                    (m) => m.AdminGroupsComponent,
                  ),
              },
              {
                path: 'new',
                loadComponent: () =>
                  import('./admin/pages/admin-groups/admin-group-form/admin-group-form.component').then(
                    (m) => m.AdminGroupFormComponent,
                  ),
              },
              {
                path: ':id/edit',
                loadComponent: () =>
                  import('./admin/pages/admin-groups/admin-group-form/admin-group-form.component').then(
                    (m) => m.AdminGroupFormComponent,
                  ),
              },
            ],
          },
        ],
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
  { path: '', redirectTo: '/app/dashboard', pathMatch: 'full' },
  { path: '**', redirectTo: '/login' },
];

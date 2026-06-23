import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

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
        path: 'posts',
        loadComponent: () =>
          import('./features/posts/posts.component').then(
            (m) => m.PostsComponent,
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
        path: 'members/:id',
        loadComponent: () =>
          import('./features/members/member-detail/member-detail.component').then(
            (m) => m.MemberDetailComponent,
          ),
      },
      {
        path: 'attendance',
        loadComponent: () =>
          import('./features/attendance/attendance.component').then(
            (m) => m.AttendanceComponent,
          ),
      },
      {
        path: 'members',
        loadComponent: () =>
          import('./features/members/members.component').then(
            (m) => m.MembersComponent,
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
        path: 'admin',
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
            loadComponent: () =>
              import('./admin/pages/admin-posts/admin-posts.component').then(
                (m) => m.AdminPostsComponent,
              ),
          },
          {
            path: 'events',
            loadComponent: () =>
              import('./admin/pages/admin-events/admin-events.component').then(
                (m) => m.AdminEventsComponent,
              ),
          },
          {
            path: 'members',
            loadComponent: () =>
              import('./admin/pages/admin-members/admin-members.component').then(
                (m) => m.AdminMembersComponent,
              ),
          },
          {
            path: 'groups',
            loadComponent: () =>
              import('./admin/pages/admin-groups/admin-groups.component').then(
                (m) => m.AdminGroupsComponent,
              ),
          },
        ],
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
  { path: '', redirectTo: '/app/dashboard', pathMatch: 'full' },
  { path: '**', redirectTo: '/login' },
];

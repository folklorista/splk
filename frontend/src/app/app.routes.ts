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
        path: 'search',
        loadComponent: () =>
          import('./features/search/search.component').then((m) => m.SearchComponent),
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
      // Moje kroje – osobní karta každého člena
      {
        path: 'costumes',
        canActivate: [moduleGuard('costumes')],
        loadComponent: () => import('./features/costumes/my-costumes/my-costumes-page.component').then((m) => m.MyCostumesPageComponent),
      },
      // Správa krojů – správa fondu (prohlížení: Náhled do správy krojů, zápis: Správa krojů)
      { path: 'wardrobe', pathMatch: 'full', redirectTo: 'wardrobe/stock' },
      {
        path: 'wardrobe/stock',
        canActivate: [costumeStockGuard],
        loadComponent: () => import('./features/costumes/wardrobe/stock/stock.component').then((m) => m.WardrobeStockComponent),
      },
      {
        path: 'wardrobe/stock/new',
        canActivate: [costumeManagerGuard],
        loadComponent: () => import('./features/costumes/wardrobe/stock/item-form.component').then((m) => m.WardrobeItemFormComponent),
      },
      {
        path: 'wardrobe/stock/:id/edit',
        canActivate: [costumeManagerGuard],
        loadComponent: () => import('./features/costumes/wardrobe/stock/item-form.component').then((m) => m.WardrobeItemFormComponent),
      },
      {
        path: 'wardrobe/stock/:id',
        canActivate: [costumeStockGuard],
        loadComponent: () => import('./features/costumes/wardrobe/stock/item-detail.component').then((m) => m.WardrobeItemDetailComponent),
      },
      {
        path: 'wardrobe/cards',
        canActivate: [costumeStockGuard],
        loadComponent: () => import('./features/costumes/wardrobe/cards/cards.component').then((m) => m.WardrobeCardsComponent),
      },
      {
        path: 'wardrobe/cards/:key',
        canActivate: [costumeStockGuard],
        loadComponent: () => import('./features/costumes/wardrobe/cards/card-detail.component').then((m) => m.WardrobeCardDetailComponent),
      },
      {
        path: 'wardrobe/loans',
        canActivate: [costumeStockGuard],
        loadComponent: () => import('./features/costumes/wardrobe/loans/loans.component').then((m) => m.WardrobeLoansComponent),
      },
      {
        path: 'wardrobe/loans/new',
        canActivate: [costumeManagerGuard],
        loadComponent: () => import('./features/costumes/wardrobe/loans/loan-form.component').then((m) => m.WardrobeLoanFormComponent),
      },
      {
        path: 'wardrobe/inventories',
        canActivate: [costumeStockGuard],
        loadComponent: () => import('./features/costumes/wardrobe/inventories/inventories.component').then((m) => m.WardrobeInventoriesComponent),
      },
      {
        path: 'wardrobe/inventories/new',
        canActivate: [costumeManagerGuard],
        loadComponent: () => import('./features/costumes/wardrobe/inventories/inventory-new.component').then((m) => m.WardrobeInventoryNewComponent),
      },
      {
        path: 'wardrobe/inventories/:id',
        canActivate: [costumeStockGuard],
        loadComponent: () => import('./features/costumes/wardrobe/inventories/inventory-detail.component').then((m) => m.WardrobeInventoryDetailComponent),
      },
      {
        path: 'wardrobe/inventories/:id/visit/:key',
        canActivate: [costumeStockGuard],
        loadComponent: () => import('./features/costumes/wardrobe/inventories/inventory-visit.component').then((m) => m.WardrobeInventoryVisitComponent),
      },
      {
        path: 'wardrobe/inventories/:id/stock/:seriesId',
        canActivate: [costumeStockGuard],
        loadComponent: () => import('./features/costumes/wardrobe/inventories/inventory-series.component').then((m) => m.WardrobeInventorySeriesComponent),
      },
      {
        path: 'wardrobe/settings',
        canActivate: [costumeStockGuard],
        loadComponent: () => import('./features/costumes/wardrobe/settings/settings.component').then((m) => m.WardrobeSettingsComponent),
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

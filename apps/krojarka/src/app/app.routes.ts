import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guards';
import { ForgotPasswordPage } from './core/auth/forgot-password-page';
import { LoginPage } from './core/auth/login-page';
import { ResetPasswordPage } from './core/auth/reset-password-page';
import { MENU } from './core/layout/menu';
import { PlaceholderPage } from './core/layout/placeholder-page';
import { Shell } from './core/layout/shell';
import { fundGuard, organizationAdminGuard, settingsHomeGuard } from './core/auth/mandate.guards';
import { CatalogPage } from './features/nastaveni/catalog-page';
import { SeriesPage } from './features/nastaveni/series-page';
import { SettingsLayout, SettingsNoAccess } from './features/nastaveni/settings-layout';
import { UsersPage } from './features/nastaveni/users-page';
import { AccountPage } from './features/ucet/account-page';

const IMPLEMENTED = ['ucet', 'nastaveni', 'soucastky', 'lide', 'krojove-karty', 'vypujcky'];

const placeholders: Routes = MENU.filter((item) => !IMPLEMENTED.includes(item.path)).map((item) => ({
  path: item.path,
  pathMatch: 'full',
  component: PlaceholderPage,
  title: `${item.label} · Krojařka`,
  data: { title: item.label, description: item.description },
}));

export const routes: Routes = [
  { path: 'prihlaseni', component: LoginPage, canActivate: [guestGuard], title: 'Přihlášení · Krojařka' },
  { path: 'zapomenute-heslo', component: ForgotPasswordPage, canActivate: [guestGuard], title: 'Nastavení hesla · Krojařka' },
  // reachable signed in as well: the link from the e-mail may be opened in a browser with a session
  { path: 'obnova-hesla', component: ResetPasswordPage, title: 'Nové heslo · Krojařka' },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      ...placeholders,
      { path: 'vypujcky', canActivate: [fundGuard], loadComponent: () => import('./features/vypujcky/loans-layout').then((m) => m.LoansLayout), children: [
        { path: '', pathMatch: 'full', loadComponent: () => import('./features/vypujcky/loans-page').then((m) => m.LoansPage), title: 'Výpůjčky · Krojařka' },
        { path: 'vydat', loadComponent: () => import('./features/vypujcky/issue-page').then((m) => m.IssuePage), title: 'Výdej · Krojařka' },
        { path: ':id', loadComponent: () => import('./features/vypujcky/loan-page').then((m) => m.LoanPage), title: 'Předání · Krojařka' },
      ] },
      { path: 'lide', loadComponent: () => import('./features/lide/people-layout').then((m) => m.PeopleLayout), canActivate: [fundGuard], children: [
        { path: '', pathMatch: 'full', loadComponent: () => import('./features/lide/people-page').then((m) => m.PeoplePage), title: 'Lidé · Krojařka' },
        { path: ':id', loadComponent: () => import('./features/lide/person-card-page').then((m) => m.PersonCardPage), title: 'Krojová karta osoby · Krojařka' },
      ] },
      { path: 'krojove-karty', loadComponent: () => import('./features/lide/cards-page').then((m) => m.CardsPage), canActivate: [fundGuard], title: 'Krojové karty · Krojařka' },
      { path: 'soucastky', loadComponent: () => import('./features/soucastky/inventory-layout').then((m) => m.InventoryLayout), canActivate: [fundGuard], children: [
        { path: '', pathMatch: 'full', loadComponent: () => import('./features/soucastky/inventory-page').then((m) => m.InventoryPage), title: 'Součástky · Krojařka' },
        { path: 'nova', loadComponent: () => import('./features/soucastky/item-page').then((m) => m.ItemPage), title: 'Nová součástka · Krojařka' },
        { path: 'kusy/:id', loadComponent: () => import('./features/soucastky/item-page').then((m) => m.ItemPage), title: 'Součástka · Krojařka' },
        { path: 'komplety/:id', loadComponent: () => import('./features/soucastky/kit-page').then((m) => m.KitPage), title: 'Komplet · Krojařka' },
      ] },
      { path: 'ucet', component: AccountPage, title: 'Můj účet · Krojařka' },
      {
        path: 'nastaveni',
        component: SettingsLayout,
        children: [
          { path: '', pathMatch: 'full', component: SettingsNoAccess, canActivate: [settingsHomeGuard], title: 'Nastavení · Krojařka' },
          { path: 'katalog', component: CatalogPage, canActivate: [fundGuard], title: 'Katalog · Nastavení · Krojařka' },
          { path: 'rady', component: SeriesPage, canActivate: [fundGuard], title: 'Evidenční řady · Nastavení · Krojařka' },
          { path: 'uzivatele', component: UsersPage, canActivate: [organizationAdminGuard], title: 'Uživatelé a pověření · Krojařka' },
        ],
      },
    ],
  },
  { path: '**', redirectTo: '' },
];

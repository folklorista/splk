import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guards';
import { ForgotPasswordPage } from './core/auth/forgot-password-page';
import { LoginPage } from './core/auth/login-page';
import { ResetPasswordPage } from './core/auth/reset-password-page';
import { MENU } from './core/layout/menu';
import { PlaceholderPage } from './core/layout/placeholder-page';
import { Shell } from './core/layout/shell';
import { AccountPage } from './features/ucet/account-page';

const placeholders: Routes = MENU.filter((item) => item.path !== 'ucet').map((item) => ({
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
      { path: 'ucet', component: AccountPage, title: 'Můj účet · Krojařka' },
    ],
  },
  { path: '**', redirectTo: '' },
];

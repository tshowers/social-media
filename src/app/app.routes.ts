import { Routes } from '@angular/router';

import { environment } from '../environments/environment';
import { authGuard } from './services/auth.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'command',
  },
  {
    path: 'calendar',
    loadComponent: () =>
      import( './features/social/calendar/calendar.component' ).then( ( m ) => m.SocialOutreachCalendarComponent ),
    canActivate: [authGuard],
    title: environment.COMPANY_NAME + ' – Calendar',
  },
  {
    path: 'accounts',
    loadComponent: () =>
      import( './features/social/accounts/accounts.component' ).then( ( m ) => m.SocialOutreachAccountsComponent ),
    canActivate: [authGuard],
    title: environment.COMPANY_NAME + ' – Accounts',
  },
  {
    path: 'login',
    loadComponent: () =>
      import( './features/sign-in/sign-in.component' ).then( ( m ) => m.SignInComponent ),
  },
  {
    path: 'auth/callback',
    loadComponent: () =>
      import( './features/auth-callback/auth-callback.component' ).then( ( m ) => m.AuthCallbackComponent ),
  },
  {
    path: 'not-found',
    loadComponent: () =>
      import( './features/not-found/not-found.component' ).then( ( m ) => m.NotFoundComponent ),
  },
  {
    path: '**',
    loadComponent: () =>
      import( './features/not-found/not-found.component' ).then( ( m ) => m.NotFoundComponent ),
  },
];

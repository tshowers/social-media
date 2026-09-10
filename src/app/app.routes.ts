import { Routes } from '@angular/router';

import { environment } from '../environments/environment';
import { authGuard } from './services/auth.guard';
import { landingRedirectGuard } from './services/landing-redirect.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canActivate: [landingRedirectGuard],
    loadComponent: () =>
      import( './features/landing/landing.component' ).then( ( m ) => m.LandingComponent ),
    title: environment.COMPANY_NAME + ' – Social outreach, in motion',
  },
  {
    path: 'command',
    loadComponent: () =>
      import( './features/social/command/command.component' ).then( ( m ) => m.SocialOutreachComponent ),
    canActivate: [authGuard],
    title: environment.COMPANY_NAME + ' – Command',
  },
  {
    path: 'ios',
    loadComponent: () =>
      import( './features/app-showcase/app-showcase.component' ).then( ( m ) => m.AppShowcaseComponent ),
    title: environment.COMPANY_NAME + ' – Social for iOS',
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
    path: 'strategy',
    loadComponent: () =>
      import( './features/social/strategy/strategy.component' ).then( ( m ) => m.SocialOutreachStrategyComponent ),
    canActivate: [authGuard],
    title: environment.COMPANY_NAME + ' – Strategy',
  },
  {
    path: 'queue',
    loadComponent: () =>
      import( './features/social/queue/queue.component' ).then( ( m ) => m.SocialOutreachQueueComponent ),
    canActivate: [authGuard],
    title: environment.COMPANY_NAME + ' – Approved',
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

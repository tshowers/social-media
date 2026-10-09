import { Routes } from '@angular/router';

import { appGuard, entryGuard, strategyGuard, welcomeGuard } from './maya-social/guards';

/**
 * Maya Social (design_handoff_maya_social and _entry). `header` in route
 * data picks the header (see maya-social/header.component.ts); Help and
 * About draw their own.
 */
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canActivate: [entryGuard],
    data: { header: 'doorway' },
    loadComponent: () => import( './maya-social/pages/doorway.component' ).then( ( m ) => m.DoorwayComponent ),
    title: 'Maya Social: Maya runs your social media',
  },
  {
    path: 'welcome',
    canActivate: [welcomeGuard],
    data: { header: 'welcome' },
    loadComponent: () => import( './maya-social/pages/welcome.component' ).then( ( m ) => m.WelcomeComponent ),
    title: 'Welcome to Maya Social',
  },
  {
    path: 'today',
    canActivate: [appGuard],
    data: { header: 'app', pageTitle: 'Today' },
    loadComponent: () => import( './maya-social/pages/today.component' ).then( ( m ) => m.TodayComponent ),
    title: 'Today · Maya Social',
  },
  {
    path: 'calendar',
    canActivate: [appGuard, strategyGuard],
    data: { header: 'app', pageTitle: 'Calendar' },
    loadComponent: () => import( './maya-social/pages/calendar.component' ).then( ( m ) => m.CalendarComponent ),
    title: 'Calendar · Maya Social',
  },
  {
    path: 'strategy',
    canActivate: [appGuard],
    data: { header: 'app', pageTitle: 'Strategy' },
    loadComponent: () => import( './maya-social/pages/strategy.component' ).then( ( m ) => m.StrategyComponent ),
    title: 'Strategy · Maya Social',
  },
  {
    path: 'profile',
    canActivate: [appGuard],
    data: { header: 'app', pageTitle: 'Profile' },
    loadComponent: () => import( './maya-social/pages/profile.component' ).then( ( m ) => m.ProfileComponent ),
    title: 'Profile · Maya Social',
  },
  {
    path: 'new',
    canActivate: [appGuard, strategyGuard],
    data: { header: 'app', pageTitle: 'New post' },
    loadComponent: () => import( './maya-social/pages/new-post.component' ).then( ( m ) => m.NewPostComponent ),
    title: 'New post · Maya Social',
  },
  {
    // One-tap Approve / Hold from Maya's email (gaps 2t): no sign-in.
    path: 'act',
    data: { header: 'welcome' },
    loadComponent: () => import( './maya-social/pages/act.component' ).then( ( m ) => m.ActComponent ),
    title: 'Maya Social',
  },
  {
    path: 'help',
    data: { header: 'none', page: 'help' },
    loadComponent: () => import( './maya-social/pages/help.component' ).then( ( m ) => m.HelpPageComponent ),
  },
  {
    path: 'about',
    data: { header: 'none', page: 'about' },
    loadComponent: () => import( './shared/product-pages/product-pages.component' ).then( ( m ) => m.ProductPagesComponent ),
  },
  // Social isn't sold on its own any more: it comes with Maya.
  { path: 'pricing', redirectTo: '' },
  // Old Social routes, so bookmarks still land somewhere sensible.
  { path: 'command', redirectTo: 'today' },
  { path: 'queue', redirectTo: 'calendar' },
  { path: 'accounts', redirectTo: 'profile' },
  { path: 'ios', redirectTo: '' },
  {
    path: 'login',
    loadComponent: () => import( './features/sign-in/sign-in.component' ).then( ( m ) => m.SignInComponent ),
  },
  {
    path: 'auth/callback',
    loadComponent: () => import( './features/auth-callback/auth-callback.component' ).then( ( m ) => m.AuthCallbackComponent ),
  },
  {
    path: '**',
    data: { header: 'doorway' },
    loadComponent: () => import( './features/not-found/not-found.component' ).then( ( m ) => m.NotFoundComponent ),
  },
];

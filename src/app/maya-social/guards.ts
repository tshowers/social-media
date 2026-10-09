import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs/operators';

import { MayaSocialState } from './state';

/**
 * Routing from design_handoff_maya_social_entry ("Access and routing"):
 *  - signed out, or signed in without Maya → the doorway (1o) at /
 *  - Maya, first visit → /welcome (1p), until set up or "Not now"
 *  - otherwise → /today (no strategy yet: Today's empty state; Strategy
 *    shows 1h/1i)
 */

/** `/`: the doorway, or straight into the app. */
export const entryGuard: CanActivateFn = () => {
  const state = inject( MayaSocialState );
  const router = inject( Router );
  return state.access().pipe( map( ( access ) => {
    if ( access === 'signedOut' || access === 'noMaya' ) return true;
    if ( access === 'firstRun' ) return router.createUrlTree( ['/welcome'] );
    return router.createUrlTree( ['/today'] );
  } ) );
};

/** `/welcome`: only for a Maya subscriber who hasn't set up yet. */
export const welcomeGuard: CanActivateFn = () => {
  const state = inject( MayaSocialState );
  const router = inject( Router );
  return state.access().pipe( map( ( access ) => {
    if ( access === 'signedOut' || access === 'noMaya' ) return router.createUrlTree( ['/'] );
    return state.overview()?.onboardedAt ? router.createUrlTree( ['/today'] ) : true;
  } ) );
};

/** The app's pages: Maya subscribers past the first-run screen. */
export const appGuard: CanActivateFn = () => {
  const state = inject( MayaSocialState );
  const router = inject( Router );
  return state.access().pipe( map( ( access ) => {
    if ( access === 'signedOut' || access === 'noMaya' ) return router.createUrlTree( ['/'] );
    if ( access === 'firstRun' ) return router.createUrlTree( ['/welcome'] );
    return true;
  } ) );
};

/** Pages that need a strategy (New post): without one, Strategy shows 1h/1i. */
export const strategyGuard: CanActivateFn = () => {
  const state = inject( MayaSocialState );
  const router = inject( Router );
  return state.access().pipe( map( ( access ) => ( access === 'ready' ? true : router.createUrlTree( ['/strategy'] ) ) ) );
};

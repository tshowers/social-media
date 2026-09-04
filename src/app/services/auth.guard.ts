import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { map, take } from 'rxjs/operators';

import { SocialAuthService } from './social-auth.service';

/**
 * Every one of Social's 5 live routes carries `canActivate: [authGuard]` in
 * the monorepo (frontend/src/app/features/social-media/social.routes.ts),
 * but the monorepo's own authGuard (frontend/src/app/services/auth.guard.ts)
 * also checks Suite entitlement / subscription status - Social has no
 * paywall today (EntitlementService's Entitlements interface has no
 * `social` field, confirmed against the live component/service code), so
 * this only mirrors the sign-in requirement, not the subscription check.
 * None of Network/Pulse/Lead Vault need a router-level guard at all (their
 * gated pages self-check `isLoggedIn` and render a guest state instead of
 * redirecting), but Social's 5 screens all assume a real signed-in user
 * end-to-end (they call authService.getUserId()/getTenantId() expecting a
 * real value), so an actual redirect-on-signed-out guard is the more
 * faithful port here.
 */
export const authGuard: CanActivateFn = ( route, state ) => {
  const authService = inject( SocialAuthService );
  const router = inject( Router );

  return authService.isLoggedIn().pipe(
    take( 1 ),
    map( isLoggedIn => isLoggedIn
      ? true
      : router.createUrlTree( ['/login'], { queryParams: { returnUrl: state.url } } ) ),
  );
};

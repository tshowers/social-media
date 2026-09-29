import { Injectable, inject } from '@angular/core';
import { Observable, combineLatest, of } from 'rxjs';
import { catchError, debounceTime, map, shareReplay, switchMap, take } from 'rxjs/operators';
import { GetTheAppProductKey } from '@taliferro/ui/platform/get-the-app.model';
import { AccountBillingService } from './account-billing.service';
import { SocialAuthService } from './social-auth.service';

/** Where a visitor stands: browsing signed out, signed in without the app's
 * subscription (browse only), or able to create/edit. */
export type WriteAccessState = 'signedOut' | 'browsing' | 'canWrite';

/**
 * "Browse free, create with the app" (Ty, 2026-09-27): reads
 * /account/summary's `writeAccess` - App Store purchase or master tenant,
 * decided server-side - so the pricing page, the "get the app" banner and
 * disabled actions all agree. Cached per page load; call refresh() after
 * sign-in/out.
 */
@Injectable( { providedIn: 'root' } )
export class WriteAccessService {
  private readonly authService = inject( SocialAuthService );
  private readonly accountBilling = inject( AccountBillingService );
  private cached$: Observable<Record<string, boolean> | null> | null = null;

  state ( product: GetTheAppProductKey ): Observable<WriteAccessState> {
    return this.authService.isLoggedIn().pipe(
      switchMap( ( signedIn ) => {
        if ( !signedIn ) return of<WriteAccessState>( 'signedOut' );
        return this.writeAccess().pipe(
          map( ( access ): WriteAccessState => ( access?.[product] ? 'canWrite' : 'browsing' ) ),
        );
      } ),
    );
  }

  refresh (): void {
    this.cached$ = null;
  }

  private writeAccess (): Observable<Record<string, boolean> | null> {
    if ( !this.cached$ ) {
      this.cached$ = combineLatest( [this.authService.getTenantId(), this.authService.getUser()] ).pipe(
        debounceTime( 0 ),
        take( 1 ),
        switchMap( ( [tenantId, user] ) => {
          if ( !tenantId || !user?.uid ) return of( null );
          return this.accountBilling.getSummary( { tenantId, userId: user.uid, userEmail: user.email ?? '' } ).pipe(
            map( ( res ) => res?.data?.writeAccess ?? null ),
            catchError( () => of( null ) ),
          );
        } ),
        shareReplay( { bufferSize: 1, refCount: false } ),
      );
    }
    return this.cached$;
  }
}

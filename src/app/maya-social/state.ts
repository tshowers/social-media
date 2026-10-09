import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, firstValueFrom, of, tap } from 'rxjs';
import { catchError, map, switchMap, take } from 'rxjs/operators';

import { SocialAuthService } from '../services/social-auth.service';
import { MayaSocialApi, Overview } from './api';

/** Where a visitor stands with Maya Social. */
export type Access = 'signedOut' | 'noMaya' | 'firstRun' | 'noStrategy' | 'ready';

const NOT_NOW_KEY = 'maya-social-not-now';

/**
 * The overview (entitlement, settings, profile, strategy) shared by every
 * screen. Loaded once and refreshed after anything that changes it.
 */
@Injectable( { providedIn: 'root' } )
export class MayaSocialState {
  private readonly api = inject( MayaSocialApi );
  private readonly auth = inject( SocialAuthService );

  readonly overview = signal<Overview | null>( null );
  readonly signedIn = signal( false );
  readonly email = signal( '' );

  readonly strategy = computed( () => this.overview()?.strategy ?? null );
  readonly today = computed( () => this.overview()?.today ?? new Date().toISOString().slice( 0, 10 ) );
  readonly timeZone = computed( () => this.overview()?.timeZone ?? 'America/Los_Angeles' );
  readonly channelNames = computed( () => this.overview()?.channels ?? {} );
  /** Strategy channels with no connected account: their posts can't go out. */
  readonly unconnectedChannels = computed( () => {
    const overview = this.overview();
    if ( !overview?.strategy ) return [];
    return overview.strategy.channels.filter( ( channel ) => !overview.connectedChannels.includes( channel.key ) );
  } );

  private loading: Observable<Overview | null> | null = null;

  /** Loads the overview (once, unless `force`). Null when signed out. */
  load ( force = false ): Observable<Overview | null> {
    if ( this.overview() && !force ) return of( this.overview() );
    if ( this.loading && !force ) return this.loading;
    this.loading = this.auth.isLoggedIn().pipe(
      take( 1 ),
      switchMap( ( signedIn ) => {
        this.signedIn.set( signedIn );
        this.email.set( this.auth.getCurrentUserSync()?.email || '' );
        if ( !signedIn ) return of( null );
        return this.api.overview().pipe( catchError( () => of( null ) ) );
      } ),
      tap( ( overview ) => {
        this.overview.set( overview );
        this.loading = null;
      } ),
    );
    return this.loading;
  }

  refresh (): Promise<Overview | null> {
    return firstValueFrom( this.load( true ) );
  }

  set ( overview: Overview ): void {
    this.overview.set( overview );
  }

  access (): Observable<Access> {
    return this.load().pipe( map( () => this.accessNow() ) );
  }

  accessNow (): Access {
    const overview = this.overview();
    if ( !this.signedIn() ) return 'signedOut';
    if ( !overview?.entitled ) return 'noMaya';
    if ( !overview.onboardedAt && !this.notNow() ) return 'firstRun';
    if ( !overview.strategy ) return 'noStrategy';
    return 'ready';
  }

  /** "Not now" on the first-run screen lasts for this visit only. */
  notNow (): boolean {
    try { return sessionStorage.getItem( NOT_NOW_KEY ) === '1'; } catch { return false; }
  }

  setNotNow (): void {
    try { sessionStorage.setItem( NOT_NOW_KEY, '1' ); } catch { /* private mode */ }
  }

  reset (): void {
    this.overview.set( null );
    this.signedIn.set( false );
  }
}

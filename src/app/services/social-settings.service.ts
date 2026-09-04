import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, filter, Observable, take } from 'rxjs';

import { SocialAuthService } from './social-auth.service';
import { SocialDataService } from './social-data.service';
import { LoggerService } from './logger.service';

/**
 * Trimmed stand-in for TODD's SettingsService
 * (frontend/src/app/services/settings.service.ts, ~300 lines) - that
 * service is a general per-user preferences store with a couple dozen
 * feature-flag getters (isSurveyFeatureEnabled, isTaskFeatureEnabled, ...)
 * that nothing in Social calls. The only thing social-platform-context.
 * service.ts actually uses is the personal settings doc itself:
 * `waitForSettings()` (to read a persisted value once available) and
 * `updateSetting(key, value)` (to persist a change) - both kept here with
 * the same signatures.
 *
 * Persists to `tenants/{tenantId}/settings/{userId}` via SocialDataService,
 * same path convention as the original (DataService's 'SETTINGS' endpoint,
 * keyed by the editing user's id) - distinct from
 * SocialCadenceSettingsService, which deliberately writes to
 * `settings/{tenantId}` instead (tenant-wide, not per-user - see that
 * service's own comment).
 */
@Injectable( { providedIn: 'root' } )
export class SocialSettingsService {
  private readonly authService = inject( SocialAuthService );
  private readonly dataService = inject( SocialDataService );
  private readonly logger = inject( LoggerService );

  private settingsSubject = new BehaviorSubject<any>( {} );
  settings$ = this.settingsSubject.asObservable();
  private userId = '';
  private tenantId = '';

  constructor () {
    this.authService.getUserId().subscribe( userId => {
      if ( !userId || this.hasSettingsBeenLoaded() ) return;
      this.userId = userId;
      this.authService.getTenantId().subscribe( tenantId => {
        this.tenantId = tenantId;
        this.fetchAndSetSettings( tenantId, userId );
      } );
    } );
  }

  getSettings (): any {
    return this.settingsSubject.getValue();
  }

  updateSetting ( key: string, value: any ): void {
    const current = this.getSettings();
    const updated = { ...current, [key]: value };
    this.settingsSubject.next( updated );
    if ( !this.tenantId || !this.userId ) return;
    this.dataService.setSettingsDocument( this.tenantId, this.userId, updated ).catch( err => {
      this.logger.error( 'Auto-saving setting failed', err );
    } );
  }

  waitForSettings (): Observable<any> {
    return this.settings$.pipe(
      filter( settings => !!settings && Object.keys( settings ).length > 1 ),
      take( 1 ),
    );
  }

  private hasSettingsBeenLoaded (): boolean {
    const settings = this.settingsSubject.getValue();
    return settings && Object.keys( settings ).length > 1;
  }

  private fetchAndSetSettings ( tenantId: string, userId: string ): void {
    if ( !tenantId || !userId ) return;
    this.dataService.getSettingsDocument( tenantId, userId ).pipe( take( 1 ) ).subscribe( {
      next: doc => {
        const normalized = doc ? { ...doc, id: doc.id || userId } : { id: userId };
        this.settingsSubject.next( normalized );
      },
      error: () => this.logger.info( "Can't get settings for user not logged in" ),
    } );
  }
}

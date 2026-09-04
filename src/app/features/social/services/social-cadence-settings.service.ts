import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SocialDataService } from '../../../services/social-data.service';
import { SocialStrategyCadence } from '../../../services/social-api.service';

export interface PlatformCadenceConfig {
  cadence: SocialStrategyCadence;
  customTimes: string[];
  useBestTime: boolean;
  smartRandomization: boolean;
  randomizationWindowMinutes: number;
}

export type SocialPlatformCadenceMap = Record<string, PlatformCadenceConfig>;

const SETTINGS_KEY = 'social_cadence_per_platform';

const DEFAULT_CONFIG: PlatformCadenceConfig = {
  cadence: '3x_week',
  customTimes: [],
  useBestTime: true,
  smartRandomization: true,
  randomizationWindowMinutes: 30
};

// Deliberately NOT routed through SocialSettingsService: that service
// persists to a doc keyed by the *editing user's* id
// (tenants/{tenantId}/settings/{userId}), which is fine for personal
// preferences but wrong here - this is tenant-wide posting cadence that a
// scheduled backend job (no "current user") has to read too. The backend
// (social.cadence.js's getLiveTenantCadenceForPlatform/
// getPlatformCadenceSettings) already reads
// tenants/{tenantId}/settings/{tenantId} - doc keyed by tenant id - so this
// writes to that same doc directly instead of the personal-settings one,
// which the backend was never able to see. Copied from the monorepo's
// social-cadence-settings.service.ts unchanged apart from swapping
// DataService for SocialDataService.
@Injectable( { providedIn: 'root' } )
export class SocialCadenceSettingsService {

  private readonly dataService = inject( SocialDataService );
  private subject = new BehaviorSubject<SocialPlatformCadenceMap>( {} );
  cadenceSettings$ = this.subject.asObservable();

  constructor () {
    const tenantId = this.dataService.getTenantId();
    if ( !tenantId ) return;
    this.dataService.getSettingsDocument( tenantId, tenantId ).subscribe( doc => {
      const persisted = doc?.[SETTINGS_KEY];
      if ( persisted && typeof persisted === 'object' ) {
        this.subject.next( persisted as SocialPlatformCadenceMap );
      }
    } );
  }

  get ( platform: string ): PlatformCadenceConfig {
    return this.subject.getValue()[platform] ?? { ...DEFAULT_CONFIG };
  }

  update ( platform: string, config: PlatformCadenceConfig ): void {
    const next = { ...this.subject.getValue(), [platform]: config };
    this.subject.next( next );
    const tenantId = this.dataService.getTenantId();
    if ( !tenantId ) return;
    this.dataService.updateSettingsDocument( tenantId, tenantId, { [SETTINGS_KEY]: next } )
      .catch( () => this.dataService.setSettingsDocument( tenantId, tenantId, { [SETTINGS_KEY]: next } ) );
  }

  getAll (): SocialPlatformCadenceMap {
    return this.subject.getValue();
  }
}

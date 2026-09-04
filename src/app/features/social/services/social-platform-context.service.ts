import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SocialSettingsService } from '../../../services/social-settings.service';

const ALL_PLATFORMS = ['linkedin', 'threads', 'bluesky', 'reddit', 'youtube', 'google_business_profile', 'instagram', 'facebook'] as const;
const SETTINGS_KEY = 'social_platform_context';

const DEFAULTS: Record<string, boolean> = {
  linkedin: true,
  threads: true,
  bluesky: true,
  reddit: false,
  youtube: false,
  google_business_profile: true,
  instagram: false,
  facebook: false
};

@Injectable( { providedIn: 'root' } )
export class SocialPlatformContextService {

  private readonly settingsService = inject( SocialSettingsService );
  private subject = new BehaviorSubject<Record<string, boolean>>( { ...DEFAULTS } );
  selectedPlatforms$ = this.subject.asObservable();

  constructor () {
    this.settingsService.waitForSettings().subscribe( settings => {
      const persisted = settings?.[SETTINGS_KEY];
      if ( persisted && typeof persisted === 'object' ) {
        this.subject.next( { ...DEFAULTS, ...persisted } );
      }
    } );
  }

  get snapshot (): Record<string, boolean> {
    return this.subject.getValue();
  }

  toggle ( platform: string ): void {
    const next = { ...this.snapshot, [platform]: !this.snapshot[platform] };
    this.subject.next( next );
    this.settingsService.updateSetting( SETTINGS_KEY, next );
  }

  selectAll (): void {
    const next = Object.fromEntries( ALL_PLATFORMS.map( p => [p, true] ) );
    this.subject.next( next );
    this.settingsService.updateSetting( SETTINGS_KEY, next );
  }

  isAllSelected (): boolean {
    return ALL_PLATFORMS.every( p => this.snapshot[p] );
  }
}

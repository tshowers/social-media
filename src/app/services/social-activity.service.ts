import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  DocumentData,
  Query,
  collection,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';

export type CockpitActivityDomain = 'signal_engine' | 'momentum' | 'social_media';
export type CockpitActivitySurface = 'outbox-cockpit' | 'daily-momentum' | 'social-outreach';

export interface CockpitActivityItem {
  id?: string;
  tenantId?: string;
  domain?: CockpitActivityDomain | string;
  surface?: CockpitActivitySurface | string;
  type?: string;
  status?: string;
  message?: string;
  detail?: string;
  severity?: string;
  occurredAt?: string;
  createdAt?: string;
  actor?: string;
  entityRefs?: Record<string, unknown>;
  statePatch?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
  frontendVisible?: boolean;
  expiresAt?: string;
  triggerType?: string;
  sourceComponent?: string;
  sourceEntrypoint?: string;
}

export interface CockpitActivityStreamSnapshot {
  items: CockpitActivityItem[];
  newItems: CockpitActivityItem[];
  initial: boolean;
}

/**
 * Trimmed, Firestore-direct reimplementation of TODD's CockpitActivityService
 * (frontend/src/app/services/cockpit-activity.service.ts) - only the one
 * method social-outreach.component.ts actually calls
 * (watchTenantCockpitActivityStream, for the command deck's live activity
 * feed). The original uses `@angular/fire/firestore`'s `Firestore` DI
 * token; this uses the raw `firebase/firestore` SDK instead
 * (`getFirestore()`), matching how every other data access in this app
 * (SocialAuthService, SocialDataService) and Network's own
 * NetworkDataService already talk to Firestore - @angular/fire isn't a
 * dependency here and doesn't need to become one for a single listener.
 */
@Injectable( { providedIn: 'root' } )
export class SocialActivityService {
  watchTenantCockpitActivityStream (
    tenantId: string,
    options?: {
      limit?: number;
      domains?: string[];
      surfaces?: string[];
    }
  ): Observable<CockpitActivityStreamSnapshot> {
    const normalizedTenantId = String( tenantId || '' ).trim();
    if ( !normalizedTenantId ) {
      return new Observable<CockpitActivityStreamSnapshot>( subscriber => {
        subscriber.next( { items: [], newItems: [], initial: true } );
        subscriber.complete();
      } );
    }

    return new Observable<CockpitActivityStreamSnapshot>( subscriber => {
      const perQueryLimit = Math.max( 1, Math.min( Number( options?.limit || 25 ), 100 ) );
      const normalizedDomains = this.normalizeFilters( options?.domains );
      const normalizedSurfaces = this.normalizeFilters( options?.surfaces );
      const fetchLimit = Math.max(
        perQueryLimit,
        Math.min( 100, perQueryLimit * Math.max( 1, normalizedDomains.length || 1 ) * Math.max( 1, normalizedSurfaces.length || 1 ) )
      );
      const baseRef = collection( getFirestore(), `tenants/${normalizedTenantId}/cockpit-activity` );
      const previousById = new Map<string, string>();
      let initialEmissionSent = false;

      const emitSnapshot = ( rawItems: CockpitActivityItem[] ): void => {
        const mergedItems = this.dedupeAndSortItems(
          rawItems.filter( item => this.isFrontendVisible( item ) && this.matchesFilters( item, normalizedDomains, normalizedSurfaces ) ),
          perQueryLimit
        );
        const currentById = new Map<string, string>();
        const newItems: CockpitActivityItem[] = [];

        for ( const item of mergedItems ) {
          const identity = this.getItemIdentity( item );
          const fingerprint = this.getItemFingerprint( item );
          currentById.set( identity, fingerprint );
          if ( initialEmissionSent ) {
            const previous = previousById.get( identity );
            if ( previous !== fingerprint ) newItems.push( item );
          }
        }

        previousById.clear();
        currentById.forEach( ( fingerprint, identity ) => previousById.set( identity, fingerprint ) );

        subscriber.next( {
          items: mergedItems,
          newItems: initialEmissionSent ? newItems : [],
          initial: !initialEmissionSent
        } );

        initialEmissionSent = true;
      };

      const activityQuery: Query<DocumentData> = query(
        baseRef,
        orderBy( 'occurredAt', 'desc' ),
        limit( fetchLimit )
      );

      const unsubscribe = onSnapshot(
        activityQuery,
        snapshot => {
          emitSnapshot(
            snapshot.docs.map( doc => ( { id: doc.id, ...( doc.data() as Record<string, unknown> ) } as CockpitActivityItem ) )
          );
        },
        error => subscriber.error( error ),
      );

      return () => {
        unsubscribe();
      };
    } );
  }

  watchTenantCockpitActivity (
    tenantId: string,
    options?: { limit?: number; domains?: string[]; surfaces?: string[]; }
  ): Observable<CockpitActivityItem[]> {
    return this.watchTenantCockpitActivityStream( tenantId, options ).pipe(
      map( snapshot => snapshot.items )
    );
  }

  private normalizeFilters ( values?: string[] ): string[] {
    return Array.from( new Set( ( values || [] ).map( value => String( value || '' ).trim().toLowerCase() ).filter( Boolean ) ) );
  }

  private matchesFilters ( item: CockpitActivityItem, domains: string[], surfaces: string[] ): boolean {
    const itemDomain = String( item?.domain || '' ).trim().toLowerCase();
    const itemSurface = String( item?.surface || '' ).trim().toLowerCase();
    const domainMatch = domains.length === 0 || domains.includes( itemDomain );
    const surfaceMatch = surfaces.length === 0 || surfaces.includes( itemSurface );
    return domainMatch && surfaceMatch;
  }

  private isFrontendVisible ( item: CockpitActivityItem | null | undefined ): boolean {
    return item?.frontendVisible !== false;
  }

  private dedupeAndSortItems ( items: CockpitActivityItem[], limitCount: number ): CockpitActivityItem[] {
    const byId = new Map<string, CockpitActivityItem>();
    for ( const item of items || [] ) {
      byId.set( this.getItemIdentity( item ), item );
    }

    return Array.from( byId.values() )
      .sort( ( left, right ) => this.getItemTimeValue( right ) - this.getItemTimeValue( left ) )
      .slice( 0, limitCount );
  }

  private getItemIdentity ( item: CockpitActivityItem | null | undefined ): string {
    const id = String( item?.id || '' ).trim();
    if ( id ) return id;
    return [
      String( item?.type || '' ).trim(),
      String( item?.occurredAt || item?.createdAt || '' ).trim(),
      String( item?.message || '' ).trim(),
      String( item?.surface || '' ).trim(),
      String( item?.domain || '' ).trim()
    ].join( '::' );
  }

  private getItemFingerprint ( item: CockpitActivityItem | null | undefined ): string {
    return JSON.stringify( {
      type: String( item?.type || '' ).trim(),
      status: String( item?.status || '' ).trim(),
      severity: String( item?.severity || '' ).trim(),
      message: String( item?.message || '' ).trim(),
      detail: String( item?.detail || '' ).trim(),
      occurredAt: String( item?.occurredAt || '' ).trim(),
      createdAt: String( item?.createdAt || '' ).trim()
    } );
  }

  private getItemTimeValue ( item: CockpitActivityItem | null | undefined ): number {
    const raw = String( item?.occurredAt || item?.createdAt || '' ).trim();
    const value = raw ? Date.parse( raw ) : 0;
    return Number.isFinite( value ) ? value : 0;
  }
}

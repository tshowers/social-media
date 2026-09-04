import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { Observable } from 'rxjs';

import { SocialAuthService } from './social-auth.service';

/**
 * Trimmed, Firestore-direct data layer for the standalone Social app - same
 * convention as Network's NetworkDataService (web-products/network/src/app/
 * services/network-data.service.ts): a from-scratch reimplementation of the
 * slice of TODD's 2000+ line DataService that Social's ported components
 * actually use, not a full port.
 *
 * Two things are needed here, both scoped under `tenants/{tenantId}/...`:
 *  - a `settings` doc, used two ways by ported code:
 *      - SocialCadenceSettingsService reads/writes `settings/{tenantId}`
 *        (a tenant-wide doc, since a scheduled backend job with no "current
 *        user" has to read it too - see that service's own comment).
 *      - SocialSettingsService (personal preference settings, e.g. which
 *        platforms are toggled on) reads/writes `settings/{userId}`.
 *    Both go through the same getSettingsDocument/update/set methods below,
 *    keyed by whatever doc id the caller passes - only the id differs.
 *  - a `contacts/{uid}` doc, used by SocialWritingIdentityService to derive
 *    (and persist back) the signed-in user's writing-identity profile.
 *
 * getTenantId() mirrors the original DataService.getTenantId()'s contract
 * (a synchronous read, because callers like SocialCadenceSettingsService's
 * constructor need one before any async resolution could complete) but
 * sources it from SocialAuthService's cached tenant id instead of a
 * localStorage cache populated by a login flow this app doesn't have -
 * see SocialAuthService.getTenantIdSync() for the tradeoff.
 */
@Injectable( { providedIn: 'root' } )
export class SocialDataService {
  private readonly authService = inject( SocialAuthService );

  private get firestore (): Firestore {
    return getFirestore();
  }

  getTenantId (): string {
    return this.authService.getTenantIdSync();
  }

  private settingsDocRef ( tenantId: string, docId: string ) {
    return doc( collection( this.firestore, `tenants/${tenantId}/settings` ), docId );
  }

  /** One-time read, wrapped as an Observable so call sites (which already
   * `.pipe(take(1))` or `.subscribe()` once) don't need to change shape. */
  getSettingsDocument ( tenantId: string, docId: string ): Observable<any> {
    return new Observable( subscriber => {
      getDoc( this.settingsDocRef( tenantId, docId ) )
        .then( snap => {
          subscriber.next( snap.exists() ? { id: snap.id, ...snap.data() } : null );
          subscriber.complete();
        } )
        .catch( error => subscriber.error( error ) );
    } );
  }

  /** Live counterpart, used where a caller wants to react to later writes
   * from another tab/device rather than only its own first read. */
  getSettingsDocumentRealtime ( tenantId: string, docId: string ): Observable<any> {
    return new Observable( subscriber => {
      const unsubscribe = onSnapshot(
        this.settingsDocRef( tenantId, docId ),
        snap => subscriber.next( snap.exists() ? { id: snap.id, ...snap.data() } : null ),
        error => subscriber.error( error ),
      );
      return unsubscribe;
    } );
  }

  /** Merge-update (Firestore updateDoc) - fails if the doc doesn't exist yet. */
  async updateSettingsDocument ( tenantId: string, docId: string, data: any ): Promise<void> {
    await updateDoc( this.settingsDocRef( tenantId, docId ), data );
  }

  /** Full replace (Firestore setDoc, no merge) - the fallback for the first-ever write. */
  async setSettingsDocument ( tenantId: string, docId: string, data: any ): Promise<void> {
    await setDoc( this.settingsDocRef( tenantId, docId ), data );
  }

  private contactsRef ( tenantId: string ) {
    return collection( this.firestore, `tenants/${tenantId}/contacts` );
  }

  /** Mirrors DataService.getTenantLoggedInContactInfo's own lookup
   * (findTenantContactById(tenantId, uid)): the signed-in user's own
   * contact record is stored with doc id === their auth uid. */
  async getContact ( tenantId: string, contactId: string ): Promise<Record<string, any> | null> {
    if ( !contactId ) return null;
    const snap = await getDoc( doc( this.contactsRef( tenantId ), contactId ) );
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  }

  /** Merge-update, mirrors DataService.updateContact/setDocument('CONTACTS', ...). */
  async updateContact ( tenantId: string, contactId: string, data: Record<string, any> ): Promise<void> {
    await setDoc( doc( this.contactsRef( tenantId ), contactId ), data, { merge: true } );
  }
}

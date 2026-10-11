// Synced from taliferro-ui/write-access - edit there, then run sync.sh.
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';

interface BillingStatus {
  writeAccess?: Record<string, boolean>;
  entitlementSource?: Record<string, string | null>;
}

/**
 * Web billing through todd-backend's /api/billing (Stripe). The ID-token
 * interceptor signs every call; the backend takes the workspace from the
 * token. Access is granted by Stripe's webhook, not by this page, so after
 * checkout we poll /billing/status until it lands.
 */
@Injectable( { providedIn: 'root' } )
export class WebCheckoutService {
  private readonly http = inject( HttpClient );
  private readonly base = environment.backendURL;

  /**
   * Starts Stripe Checkout for a product. `tab` is a window opened
   * synchronously in the click handler (browsers block pop-ups opened after
   * an await); without one, this tab goes to Stripe instead.
   */
  async start ( product: string, tab: Window | null ): Promise<'opened' | 'alreadySubscribed'> {
    const returnUrl = `${location.origin}${location.pathname}`;
    let url = '';
    try {
      const res = await firstValueFrom( this.http.post<{ url: string }>( `${this.base}/billing/checkout`, {
        product,
        returnUrl,
        resume: tab ? 'tab' : '',
      } ) );
      url = res.url;
    } catch ( error ) {
      tab?.close();
      const err = error as HttpErrorResponse;
      if ( err.status === 409 && err.error?.code === 'ALREADY_ENTITLED' ) return 'alreadySubscribed';
      throw new Error( err.error?.message || 'Checkout couldn’t start. Please try again.' );
    }
    if ( tab && !tab.closed ) tab.location.href = url;
    else location.assign( url );
    return 'opened';
  }

  async hasAccess ( product: string ): Promise<boolean> {
    try {
      const status = await firstValueFrom( this.http.get<BillingStatus>( `${this.base}/billing/status` ) );
      return !!status.writeAccess?.[product];
    } catch {
      return false;
    }
  }

  /** Resolves true once the product unlocks, false after `timeoutMs` or when `stop()` returns true. */
  async waitForAccess ( product: string, stop: () => boolean, timeoutMs = 20 * 60 * 1000 ): Promise<boolean> {
    const until = Date.now() + timeoutMs;
    while ( Date.now() < until && !stop() ) {
      if ( await this.hasAccess( product ) ) return true;
      await new Promise( ( resolve ) => setTimeout( resolve, 3000 ) );
    }
    return false;
  }

  /** Stripe's own page to change card, switch or cancel. */
  async openPortal (): Promise<void> {
    const res = await firstValueFrom( this.http.post<{ url: string }>( `${this.base}/billing/portal`, {
      returnUrl: `${location.origin}${location.pathname}`,
    } ) );
    location.assign( res.url );
  }
}

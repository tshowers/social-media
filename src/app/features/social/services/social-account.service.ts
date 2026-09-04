import { Injectable, inject } from '@angular/core';
import {
  SocialApiService,
  SocialAccount,
  SocialAccountHealthRow,
  SocialAccountHealthSummary,
  SocialProviderHealth
} from '../../../services/social-api.service';
import { NotificationService } from '../../../services/notification.service';
import { environment } from '../../../../environments/environment';

export interface SocialAccountRequestContext {
  tenantId?: string;
  userId?: string;
  userEmail?: string;
}

export interface SocialAccountHealthSnapshot {
  accounts: SocialAccountHealthRow[];
  summary: SocialAccountHealthSummary;
}

@Injectable( { providedIn: 'root' } )
export class SocialAccountService {
  private readonly outreachApi = inject( SocialApiService );
  private readonly notificationService = inject( NotificationService );

  loadProviderConfigHealth (
    onSuccess: ( health: Record<string, SocialProviderHealth>, availability: Record<string, { configured: boolean; message?: string; }> ) => void
  ): void {
    this.outreachApi.getSocialProviderConfigHealth().subscribe( {
      next: response => {
        const health = response?.data || {};
        const availability = Object.keys( health ).reduce( ( acc, provider ) => {
          const h = health[provider];
          acc[provider] = {
            configured: !!h?.configured,
            message: h?.missing?.length ? `Missing ${h.missing.join( ', ' )}` : ''
          };
          return acc;
        }, {} as Record<string, { configured: boolean; message?: string; }> );
        onSuccess( health, availability );
      },
      error: () => onSuccess( {}, {} )
    } );
  }

  loadAccounts (
    requestContext: SocialAccountRequestContext,
    onSuccess: ( accounts: SocialAccount[], providerAvailability: Record<string, { configured: boolean; message?: string; }> ) => void,
    onError: () => void
  ): void {
    this.outreachApi.listSocialAccounts( requestContext ).subscribe( {
      next: response => {
        onSuccess( response?.data || [], response?.providerAvailability || {} );
      },
      error: () => onError()
    } );
  }

  loadAccountHealth (
    requestContext: SocialAccountRequestContext,
    onSuccess: ( snapshot: SocialAccountHealthSnapshot ) => void,
    onError: () => void
  ): void {
    this.outreachApi.testConnectedSocialAccounts( requestContext ).subscribe( {
      next: response => {
        onSuccess( {
          accounts: response?.data?.accounts || [],
          summary: response?.data?.summary || this.buildHealthSummary( response?.data?.accounts || [] )
        } );
      },
      error: () => onError()
    } );
  }

  connectProvider (
    provider: string,
    requestContext: SocialAccountRequestContext,
    onBluesky: () => void,
    onGoogle: ( destination: 'youtube' | 'google_business_profile' ) => void,
    platformLabel: ( p: string ) => string
  ): void {
    if ( provider === 'youtube' || provider === 'google_business_profile' ) {
      onGoogle( provider as 'youtube' | 'google_business_profile' );
      return;
    }

    if ( provider === 'google' ) {
      onGoogle( 'youtube' );
      return;
    }

    if ( provider === 'bluesky' ) {
      onBluesky();
      return;
    }

    this.outreachApi.startSocialAuth( provider, {}, requestContext ).subscribe( {
      next: response => {
        const url = response?.data?.authorizationUrl;
        if ( url ) {
          window.location.href = url;
        }
      },
      error: error => {
        this.notificationService.show(
          'Connect Error',
          error?.error?.message || `Unable to start ${platformLabel( provider )} auth.`,
          'error'
        );
      }
    } );
  }

  disconnectAccount (
    account: SocialAccount,
    requestContext: SocialAccountRequestContext,
    platformLabel: ( p: string ) => string,
    onSuccess: ( accountId: string ) => void
  ): void {
    const accountId = String( account?.accountId || '' ).trim();
    if ( !accountId ) return;

    this.outreachApi.disconnectSocialAccount( accountId, requestContext ).subscribe( {
      next: () => {
        onSuccess( accountId );
        this.notificationService.show( 'Disconnected', `${platformLabel( account.provider )} account disconnected.`, 'success' );
      },
      error: error => {
        this.notificationService.show(
          'Disconnect Error',
          error?.error?.message || `Unable to disconnect ${platformLabel( account.provider )}.`,
          'error'
        );
      }
    } );
  }

  testAccountConnection (
    account: SocialAccount,
    requestContext: SocialAccountRequestContext,
    connectionTestState: Partial<Record<string, { busy?: boolean; result?: string; tone?: 'success' | 'warning' | 'error'; }>>,
    platformLabel: ( p: string ) => string,
    onResult?: ( result: SocialAccountHealthRow | null ) => void
  ): void {
    const accountId = String( account?.accountId || '' ).trim();
    if ( !accountId ) return;

    connectionTestState[accountId] = { busy: true, result: 'Testing account connection…', tone: 'warning' };

    this.outreachApi.testSocialAccountConnection( accountId, requestContext ).subscribe( {
      next: response => {
        const data = response?.data;
        connectionTestState[accountId] = {
          busy: false,
          result: data?.connected
            ? `${platformLabel( data.provider )} connection works.`
            : data?.message || data?.reason || `${platformLabel( data?.provider || account.provider )} connection needs attention.`,
          tone: data?.connected ? 'success' : 'warning'
        };
        onResult?.( data || null );
      },
      error: error => {
        connectionTestState[accountId] = {
          busy: false,
          result: error?.error?.message || 'Unable to test this account connection.',
          tone: 'error'
        };
        onResult?.( null );
      }
    } );
  }

  healthStateLabel ( row: SocialAccountHealthRow | null | undefined ): string {
    const state = String( row?.healthState || '' ).trim().toLowerCase();
    if ( state === 'healthy' ) return 'Healthy';
    if ( state === 'needs_reauth' ) return 'Needs reauth';
    if ( state === 'missing_permissions' ) return 'Missing permissions';
    if ( state === 'disconnected' ) return 'Disconnected';
    if ( state === 'failed' ) return 'Test failed';
    return 'Health unknown';
  }

  healthStateTone ( row: SocialAccountHealthRow | null | undefined ): 'on' | 'warning' | 'critical' | 'off' {
    const state = String( row?.healthState || '' ).trim().toLowerCase();
    if ( state === 'healthy' ) return 'on';
    if ( state === 'unknown' ) return 'warning';
    if ( !state ) return 'off';
    return 'critical';
  }

  healthStateSummary ( row: SocialAccountHealthRow | null | undefined, fallbackAccount?: SocialAccount | null ): string {
    if ( !row ) return 'Health not checked yet.';
    if ( row.connected ) return `${this.platformLabel( row.provider || fallbackAccount?.provider )} connection works.`;
    const message = String( row.message || '' ).trim();
    if ( message ) return message;
    const reason = String( row.reason || '' ).trim();
    if ( reason ) return this.formatMachineLabel( reason );
    return `${this.platformLabel( row.provider || fallbackAccount?.provider )} needs attention.`;
  }

  accountHealthIdentityLabel ( row: SocialAccountHealthRow | null | undefined, fallbackAccount?: SocialAccount | null ): string {
    const identity = row?.displayIdentity || row?.accountIdentity || {};
    const label = String(
      identity.displayName ||
      identity.username ||
      identity.email ||
      fallbackAccount?.displayName ||
      fallbackAccount?.username ||
      fallbackAccount?.email ||
      fallbackAccount?.providerUserId ||
      ''
    ).trim();
    const email = String( identity.email || fallbackAccount?.email || '' ).trim();
    return email && label && !label.includes( email ) ? `${label} (${email})` : ( label || email || this.accountDisplayLabel( fallbackAccount as SocialAccount ) );
  }

  accountHealthProfileUrl ( row: SocialAccountHealthRow | null | undefined, fallbackAccount?: SocialAccount | null ): string {
    const profileUrl = String( row?.displayIdentity?.profileUrl || row?.accountIdentity?.profileUrl || '' ).trim();
    if ( profileUrl ) return profileUrl;
    return fallbackAccount ? this.accountProfileUrl( fallbackAccount ) : '';
  }

  buildHealthSummary ( rows: SocialAccountHealthRow[] ): SocialAccountHealthSummary {
    const entries = Array.isArray( rows ) ? rows : [];
    const healthyCount = entries.filter( row => String( row.healthState || '' ) === 'healthy' ).length;
    const warningCount = entries.filter( row => String( row.healthSeverity || '' ) === 'warning' ).length;
    const errorCount = entries.filter( row => String( row.healthSeverity || '' ) === 'error' ).length;
    const unknownCount = entries.filter( row => String( row.healthState || '' ) === 'unknown' ).length;
    return {
      totalAccounts: entries.length,
      healthyCount,
      warningCount,
      errorCount,
      unknownCount,
      problemCount: warningCount + errorCount,
      topBlockers: entries.filter( row => String( row.healthState || '' ) !== 'healthy' ).slice( 0, 3 ).map( row => ( {
        accountId: String( row.accountId || row.accountIdentity?.accountId || '' ).trim(),
        provider: String( row.provider || '' ).trim(),
        authProvider: String( row.authProvider || '' ).trim(),
        reason: row.reason || '',
        message: row.message || '',
        providerStatus: row.providerStatus || '',
        healthState: row.healthState || '',
        healthSeverity: row.healthSeverity || '',
        displayIdentity: row.displayIdentity || row.accountIdentity || {}
      } ) )
    };
  }

  upsertHealthRow (
    rows: SocialAccountHealthRow[],
    nextRow: SocialAccountHealthRow | null | undefined,
    fallbackAccount?: SocialAccount | null
  ): SocialAccountHealthRow[] {
    if ( !nextRow && !fallbackAccount ) return rows.slice();
    const accountId = String( nextRow?.accountId || nextRow?.accountIdentity?.accountId || fallbackAccount?.accountId || '' ).trim();
    if ( !accountId ) return rows.slice();
    const normalized = nextRow ? {
      ...nextRow,
      accountId,
      displayIdentity: nextRow.displayIdentity || nextRow.accountIdentity || {
        accountId,
        displayName: fallbackAccount?.displayName || '',
        username: fallbackAccount?.username || '',
        email: fallbackAccount?.email || '',
        profileUrl: fallbackAccount ? this.accountProfileUrl( fallbackAccount ) : ''
      }
    } as SocialAccountHealthRow : null;
    const filtered = rows.filter( row => String( row.accountId || row.accountIdentity?.accountId || '' ).trim() !== accountId );
    return normalized ? [normalized, ...filtered] : filtered;
  }

  removeHealthRow ( rows: SocialAccountHealthRow[], accountId: string ): SocialAccountHealthRow[] {
    const normalizedId = String( accountId || '' ).trim();
    return rows.filter( row => String( row.accountId || row.accountIdentity?.accountId || '' ).trim() !== normalizedId );
  }

  submitGoogleConnection (
    destination: 'youtube' | 'google_business_profile',
    requestContext: SocialAccountRequestContext,
    platformLabel: ( p: string ) => string,
    onConnecting: ( connecting: boolean ) => void
  ): void {
    onConnecting( true );
    this.outreachApi.startSocialAuth( 'google', {
      destination,
      destinationType: destination,
      youtubeEnabled: destination === 'youtube'
    }, requestContext ).subscribe( {
      next: response => {
        onConnecting( false );
        const url = response?.data?.authorizationUrl;
        if ( url ) {
          window.location.href = url;
          return;
        }
        this.notificationService.show( 'Connect Error', 'Unable to start Google auth.', 'error' );
      },
      error: error => {
        onConnecting( false );
        this.notificationService.show(
          'Connect Error',
          error?.error?.message || `Unable to start ${platformLabel( destination )} auth.`,
          'error'
        );
      }
    } );
  }

  submitBlueskyConnection (
    handle: string,
    appPassword: string,
    requestContext: SocialAccountRequestContext,
    onConnecting: ( connecting: boolean ) => void,
    onSuccess: ( account: SocialAccount ) => void
  ): void {
    const trimmedHandle = handle.trim();
    const trimmedPassword = appPassword.trim();

    if ( !trimmedHandle ) {
      this.notificationService.show( 'Connect Error', 'Missing Bluesky handle', 'error' );
      return;
    }
    if ( !trimmedPassword ) {
      this.notificationService.show( 'Connect Error', 'Missing Bluesky app password', 'error' );
      return;
    }

    onConnecting( true );
    this.outreachApi.startSocialAuth( 'bluesky', { handle: trimmedHandle, appPassword: trimmedPassword }, requestContext ).subscribe( {
      next: response => {
        onConnecting( false );
        const account = response?.data?.account;
        if ( account ) {
          onSuccess( account );
        }
        this.notificationService.show( 'Connected', 'Bluesky connected. TODD can now publish to this account.', 'success' );
      },
      error: error => {
        onConnecting( false );
        this.notificationService.show( 'Connect Error', this.blueskyConnectErrorMessage( error ), 'error' );
      }
    } );
  }

  private blueskyConnectErrorMessage ( error: any ): string {
    const backendMessage = String( error?.error?.message || '' ).trim();
    const status = Number( error?.status || 0 );
    const combined = `${backendMessage} ${String( error?.error?.error || '' )}`.toLowerCase();

    if ( /missing bluesky handle/.test( combined ) ) return 'Missing Bluesky handle';
    if ( /missing bluesky app password/.test( combined ) ) return 'Missing Bluesky app password';
    if (
      /invalid bluesky credentials|invalid credentials|credential|app password|password|identifier|handle/.test( combined ) ||
      status === 400 || status === 401
    ) {
      return 'Invalid Bluesky handle or app password. Use an app password, not your regular Bluesky password. Please create an app password in Bluesky Settings and try again.';
    }
    return 'Unable to connect Bluesky right now. Please create an app password in Bluesky Settings and try again.';
  }

  isProviderConfigured (
    provider: string,
    providerConfigHealth: Record<string, SocialProviderHealth>,
    providerAvailability: Record<string, { configured: boolean; message?: string; }>
  ): boolean {
    const normalized = String( provider || '' ).trim().toLowerCase();
    const health = providerConfigHealth[normalized];
    if ( health ) {
      return health.configured !== false && health.implemented !== false;
    }
    const availability = providerAvailability[normalized];
    return availability ? availability.configured !== false : true;
  }

  connectedAccountsForProvider ( accounts: SocialAccount[], provider: string ): SocialAccount[] {
    return accounts.filter( account => String( account.provider || '' ) === String( provider || '' ) );
  }

  getDefaultAccountIdForProvider ( accounts: SocialAccount[], provider: string ): string {
    const match = this.connectedAccountsForProvider( accounts, provider )[0];
    return match?.accountId || '';
  }

  resolveConnectedAccountIdForProvider ( accounts: SocialAccount[], provider: string, preferredAccountId?: string | null ): string {
    const preferredId = String( preferredAccountId || '' ).trim();
    if ( preferredId ) {
      const preferred = accounts.find( account => String( account.accountId || '' ).trim() === preferredId );
      if ( preferred ) return preferredId;
    }
    return this.getDefaultAccountIdForProvider( accounts, provider );
  }

  platformLabel ( platform?: string ): string {
    if ( platform === 'google' ) return 'Google';
    if ( platform === 'youtube' ) return 'YouTube';
    if ( platform === 'google_business_profile' ) return 'Google Business Profile';
    if ( platform === 'facebook' ) return 'Facebook';
    if ( platform === 'instagram' ) return 'Instagram';
    if ( platform === 'reddit' ) return 'Reddit';
    if ( platform === 'bluesky' ) return 'Bluesky';
    if ( platform === 'threads' ) return 'Threads';
    return 'LinkedIn';
  }

  providerConnectNote (
    provider: string,
    providerConfigHealth: Record<string, SocialProviderHealth>,
    providerAvailability: Record<string, { configured: boolean; message?: string; }>
  ): string {
    const normalized = String( provider || '' ).trim().toLowerCase();
    const health = providerConfigHealth[normalized];
    if ( health?.implemented === false ) {
      return `${this.platformLabel( provider )} publishing is not implemented yet.`;
    }
    if ( health?.configured === false ) {
      return health.missing?.length
        ? `Missing ${health.missing.join( ', ' )}.`
        : `${this.platformLabel( provider )} connection is not configured on this deployment yet.`;
    }
    const availability = providerAvailability[normalized];
    if ( availability?.configured === false ) {
      return availability.message || `${this.platformLabel( provider )} connection is not configured on this deployment yet.`;
    }
    if ( normalized === 'reddit' ) {
      return 'Reddit communities are strict. Posts that feel promotional may be removed.';
    }
    return '';
  }

  providerHealthSummary (
    provider: string,
    providerConfigHealth: Record<string, SocialProviderHealth>,
    providerAvailability: Record<string, { configured: boolean; message?: string; }>
  ): string {
    const normalized = String( provider || '' ).trim().toLowerCase();
    const health = providerConfigHealth[normalized];
    if ( !health ) return this.providerConnectNote( provider, providerConfigHealth, providerAvailability );
    if ( health.implemented === false ) return `${this.platformLabel( provider )} is separate from Threads and is not implemented yet.`;
    if ( health.configured ) return `${this.platformLabel( provider )} config is present.`;
    return this.providerConnectNote( provider, providerConfigHealth, providerAvailability );
  }

  providerConnectButtonLabel ( accounts: SocialAccount[], provider: string ): string {
    const count = this.connectedAccountsForProvider( accounts, provider ).length;
    const label = this.platformLabel( provider );
    if ( count === 1 ) return `Reconnect ${label}`;
    if ( count > 1 ) return `Connect Another ${label} Account`;
    return `Connect ${label}`;
  }

  googleBusinessProfileLocationLabel ( account: SocialAccount | null | undefined ): string {
    const source = ( account || {} ) as unknown as Record<string, any>;
    const metadata = ( source['metadata'] || source['profile'] || source['raw'] || {} ) as Record<string, any>;
    const meta = ( metadata['meta'] || {} ) as Record<string, any>;
    const location = ( source['location'] || metadata['location'] || {} ) as Record<string, any>;
    return String(
      source['locationName'] || source['googleLocationName'] || source['businessLocationName'] || source['locationId'] ||
      metadata['locationName'] || metadata['googleLocationName'] || metadata['businessLocationName'] || metadata['locationId'] ||
      meta['locationName'] || meta['locationId'] ||
      location['name'] || location['locationName'] || location['title'] || ''
    ).trim();
  }

  hasGoogleBusinessProfilePublishLocation ( account: SocialAccount | null | undefined ): boolean {
    return !!this.googleBusinessProfileLocationLabel( account );
  }

  accountDisplayLabel ( account: SocialAccount ): string {
    const provider = String( account.provider || '' ).trim().toLowerCase();
    const labelSource = provider === 'google' || provider === 'youtube' || provider === 'google_business_profile'
      ? ( account.destinationLabel || account.selectedIdentity || account.displayName || account.username || account.providerUserId || '' )
      : ( account.selectedIdentity || account.displayName || account.username || account.providerUserId || account.destinationLabel || '' );
    const label = String( labelSource || '' ).trim();
    const email = String( account.email || '' ).trim();
    return email && label && !label.includes( email ) ? `${label} (${email})` : ( label || email );
  }

  accountProfileUrl ( account: SocialAccount ): string {
    const provider = String( account.provider || '' ).trim().toLowerCase();
    const profileUrl = String( account.profileUrl || '' ).trim();
    if ( profileUrl ) return profileUrl;
    const username = String( account.username || '' ).trim();
    const providerUserId = String( account.providerUserId || '' ).trim();
    if ( provider === 'threads' ) {
      return username ? `https://www.threads.net/@${username.replace( /^@/, '' )}` : '';
    }
    if ( provider === 'bluesky' ) {
      const handle = username || providerUserId;
      return handle ? `https://bsky.app/profile/${handle.replace( /^@/, '' )}` : '';
    }
    if ( provider === 'reddit' ) {
      const handle = username || providerUserId;
      return handle ? `https://www.reddit.com/user/${handle.replace( /^@/, '' )}` : '';
    }
    if ( provider === 'linkedin' ) return '';
    return '';
  }

  loadAddonAccess (
    tenantId: string,
    requestContext: SocialAccountRequestContext,
    onResult: ( hasAccess: boolean ) => void
  ): void {
    if ( tenantId === environment.taliferroTenantId ) {
      onResult( true );
      return;
    }
    const headers: Record<string, string> = { 'x-tenant-id': tenantId };
    if ( requestContext.userId ) headers['x-user-id'] = requestContext.userId;
    if ( requestContext.userEmail ) headers['x-user-email'] = requestContext.userEmail;
    fetch( `${environment.backendURL}/addon-access?tenantId=${encodeURIComponent( tenantId )}`, { headers } )
      .then( r => r.json() )
      .then( ( result: { hasAccess: boolean; } ) => { onResult( result.hasAccess === true ); } )
      .catch( () => { onResult( false ); } );
  }

  private formatMachineLabel ( value: string ): string {
    return String( value || '' )
      .trim()
      .replace( /[_-]+/g, ' ' )
      .replace( /\s+/g, ' ' );
  }
}

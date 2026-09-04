import { AfterViewInit, Component, inject, OnDestroy, OnInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { BackToTopComponent } from '../../../shared/back-to-top/back-to-top.component';
import { PreloaderComponent } from '../../../shared/preloader/preloader.component';

import { SocialAuthService } from '../../../services/social-auth.service';
import { PageViewCountService } from '../../../services/page-view-count.service';
import { NotificationService } from '../../../services/notification.service';
import { SocialAccount, SocialAccountHealthRow, SocialAccountHealthSummary, SocialProviderHealth, SocialStrategyCadence } from '../../../services/social-api.service';
import { AssistantPageContext, ToddAssistantBusService } from '../../../services/social-assistant-signal.service';

import { SocialPlatformContextService } from '../services/social-platform-context.service';
import { SocialCadenceSettingsService, PlatformCadenceConfig, SocialPlatformCadenceMap } from '../services/social-cadence-settings.service';
import { SocialAccountService, SocialAccountHealthSnapshot } from '../services/social-account.service';
import { SocialDemoModeService } from '../services/social-demo-mode.service';
import { ClickSoundDirective } from '../../../shared/directives/click-sound.directive';
import { ArcGaugeComponent } from '../../../shared/arc-gauge/arc-gauge.component';
import { StatusLedComponent } from '../../../shared/status-led/status-led.component';

interface SocialAccountView extends SocialAccount {
  displayLabel: string;
  healthTone: 'on' | 'warning' | 'critical' | 'off';
  healthLabel: string;
  healthSummaryText: string;
  profileUrl: string;
  googleBusinessProfileLocationLabelValue: string;
}

@Component( {
  selector: 'app-social-outreach-accounts',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, BackToTopComponent, PreloaderComponent, ClickSoundDirective, ArcGaugeComponent, StatusLedComponent],
  templateUrl: './accounts.component.html',
  styleUrl: './social-outreach-accounts.component.css'
} )
export class SocialOutreachAccountsComponent implements OnInit, OnDestroy, AfterViewInit {
  private readonly platformId = inject( PLATFORM_ID );
  private readonly isBrowser = isPlatformBrowser( this.platformId );
  private readonly route = inject( ActivatedRoute );
  private readonly authService = inject( SocialAuthService );
  private readonly pageViewCountService = inject( PageViewCountService );
  private readonly notificationService = inject( NotificationService );
  private readonly platformContextService = inject( SocialPlatformContextService );
  private readonly cadenceSettingsService = inject( SocialCadenceSettingsService );
  private readonly accountService = inject( SocialAccountService );
  private readonly demoModeService = inject( SocialDemoModeService );
  private readonly assistantBus = inject( ToddAssistantBusService );
  private readonly router = inject( Router );

  private readonly subscription = new Subscription();

  isLoggedIn = false;
  tenantId: string | null = null;
  userId: string | null = null;
  userEmail: string | null = null;
  demoModeEnabled = false;
  isPaidAddonSubscriber = false;
  showIntro = true;

  // accounts/providerAvailability/providerConfigHealth/accountHealthRows are exposed as
  // accessors so every existing assignment site (scattered through this file) transparently
  // triggers recomputeDerivedAccountState() below, instead of requiring each per-account /
  // per-provider derived value to be recomputed as a method call on every change-detection
  // pass from the template (each of the 8 platform sections previously called a method that
  // filtered the full accounts array from scratch, every check).
  private _accounts: SocialAccountView[] = [];
  get accounts (): SocialAccountView[] { return this._accounts; }
  set accounts ( value: SocialAccount[] ) {
    this._accounts = value as SocialAccountView[];
    this.recomputeDerivedAccountState();
  }

  private _providerAvailability: Record<string, { configured: boolean; message?: string; }> = {};
  get providerAvailability (): Record<string, { configured: boolean; message?: string; }> { return this._providerAvailability; }
  set providerAvailability ( value: Record<string, { configured: boolean; message?: string; }> ) {
    this._providerAvailability = value;
    this.recomputeDerivedAccountState();
  }

  private _providerConfigHealth: Record<string, SocialProviderHealth> = {};
  get providerConfigHealth (): Record<string, SocialProviderHealth> { return this._providerConfigHealth; }
  set providerConfigHealth ( value: Record<string, SocialProviderHealth> ) {
    this._providerConfigHealth = value;
    this.recomputeDerivedAccountState();
  }

  private _accountHealthRows: SocialAccountHealthRow[] = [];
  get accountHealthRows (): SocialAccountHealthRow[] { return this._accountHealthRows; }
  set accountHealthRows ( value: SocialAccountHealthRow[] ) {
    this._accountHealthRows = value;
    this.recomputeDerivedAccountState();
  }

  accountConnectionTestState: Partial<Record<string, { busy?: boolean; result?: string; tone?: 'success' | 'warning' | 'error'; }>> = {};
  accountHealthSummary: SocialAccountHealthSummary | null = null;
  accountHealthLoading = false;
  accountHealthErrorMessage = '';

  // Derived per-provider account lists/copy — recomputed by recomputeDerivedAccountState().
  linkedinAccounts: SocialAccountView[] = [];
  threadsAccounts: SocialAccountView[] = [];
  facebookAccounts: SocialAccountView[] = [];
  instagramAccounts: SocialAccountView[] = [];
  blueskyAccounts: SocialAccountView[] = [];
  redditAccounts: SocialAccountView[] = [];
  youtubeAccountsList: SocialAccountView[] = [];
  googleBusinessProfileAccountsList: SocialAccountView[] = [];

  selectedPlatforms: Record<string, boolean> = {
    linkedin: true,
    threads: true,
    bluesky: true,
    reddit: false,
    youtube: false,
    google_business_profile: true,
    instagram: false,
    facebook: false
  };
  platformCadenceSettings: SocialPlatformCadenceMap = {};

  showBlueskyConnectPanel = false;
  showBlueskyPasswordHelp = false;
  blueskyConnecting = false;
  blueskyHandle = '';
  blueskyAppPassword = '';
  showGoogleConnectPanel = false;
  googleConnecting = false;
  googleDestination: 'youtube' | 'google_business_profile' = 'youtube';

  readonly strategyCadenceOptions: Array<{ value: SocialStrategyCadence; label: string; }> = [
    { value: '5x_day', label: '5x per day' },
    { value: '4x_day', label: '4x per day' },
    { value: '3x_day', label: '3x per day' },
    { value: '2x_day', label: '2x per day' },
    { value: 'daily', label: 'Daily (1x/day)' },
    { value: '5x_week', label: '5x per week' },
    { value: '3x_week', label: '3x per week' },
    { value: '2x_week', label: '2x per week' },
    { value: 'weekly', label: 'Weekly' }
  ];

  get providerConnectionsDisabled (): boolean {
    return !this.isLoggedIn || this.demoModeEnabled;
  }

  get socialPreloaderActive (): boolean {
    return this.googleConnecting || this.blueskyConnecting;
  }

  get socialPreloaderMessage (): string {
    if ( this.googleConnecting ) return `Connecting ${this.platformLabel( this.googleDestination )}.`;
    if ( this.blueskyConnecting ) return 'Connecting Bluesky.';
    return 'Working on social accounts.';
  }

  get platformList (): string[] {
    return ( Object.keys( this.selectedPlatforms ) as Array<keyof typeof this.selectedPlatforms> )
      .filter( p => this.selectedPlatforms[p] )
      .filter( p => this.isProviderConfigured( p ) );
  }

  get currentQueryParams (): Record<string, string | number | boolean> {
    return this.route.snapshot.queryParams;
  }

  get accountsRouteLink (): string[] { return ['/accounts']; }

  private static readonly FIXED_PROVIDERS = ['linkedin', 'threads', 'facebook', 'instagram', 'bluesky', 'reddit', 'youtube', 'google_business_profile'];
  readonly allProviders: string[] = ['linkedin', 'threads', 'bluesky', 'reddit', 'youtube', 'google_business_profile', 'instagram', 'facebook'];

  // The template reads providerSummary[platform].configured (and several
  // other fields) directly, with no *ngIf/safe-navigation guard, for every
  // fixed provider - if a key is ever missing that's a hard crash on every
  // change-detection cycle until recomputeDerivedAccountState() finishes its
  // first real run. Pre-populating every provider with safe defaults here
  // means the template never sees a missing key, even before real account
  // data has loaded.
  private static buildEmptyProviderSummary (): Record<string, { configured: boolean; connectNote: string; connectButtonLabel: string; hasConnected: boolean; connectedCount: number; }> {
    return SocialOutreachAccountsComponent.FIXED_PROVIDERS.reduce( ( summary, provider ) => {
      summary[provider] = { configured: false, connectNote: '', connectButtonLabel: '', hasConnected: false, connectedCount: 0 };
      return summary;
    }, {} as Record<string, { configured: boolean; connectNote: string; connectButtonLabel: string; hasConnected: boolean; connectedCount: number; }> );
  }

  providerSummary: Record<string, { configured: boolean; connectNote: string; connectButtonLabel: string; hasConnected: boolean; connectedCount: number; }> = SocialOutreachAccountsComponent.buildEmptyProviderSummary();

  private recomputeDerivedAccountState (): void {
    this._accounts.forEach( account => this.enrichAccount( account ) );

    const summary: typeof this.providerSummary = {};
    for ( const provider of SocialOutreachAccountsComponent.FIXED_PROVIDERS ) {
      const connected = this.accountService.connectedAccountsForProvider( this._accounts, provider ) as SocialAccountView[];
      summary[provider] = {
        configured: this.isProviderConfigured( provider ),
        connectNote: this.providerConnectNote( provider ),
        connectButtonLabel: this.providerConnectButtonLabel( provider ),
        hasConnected: connected.length > 0,
        connectedCount: connected.length
      };
    }
    this.providerSummary = summary;

    this.linkedinAccounts = this.accountService.connectedAccountsForProvider( this._accounts, 'linkedin' ) as SocialAccountView[];
    this.threadsAccounts = this.accountService.connectedAccountsForProvider( this._accounts, 'threads' ) as SocialAccountView[];
    this.facebookAccounts = this.accountService.connectedAccountsForProvider( this._accounts, 'facebook' ) as SocialAccountView[];
    this.instagramAccounts = this.accountService.connectedAccountsForProvider( this._accounts, 'instagram' ) as SocialAccountView[];
    this.blueskyAccounts = this.accountService.connectedAccountsForProvider( this._accounts, 'bluesky' ) as SocialAccountView[];
    this.redditAccounts = this.accountService.connectedAccountsForProvider( this._accounts, 'reddit' ) as SocialAccountView[];
    this.youtubeAccountsList = this.accountService.connectedAccountsForProvider( this._accounts, 'youtube' ) as SocialAccountView[];
    this.googleBusinessProfileAccountsList = this.accountService.connectedAccountsForProvider( this._accounts, 'google_business_profile' ) as SocialAccountView[];
    this.publishPageContext();
  }

  private publishPageContext (): void {
    const connectedCount = this._accounts.length;
    const healthyCount = this._accounts.filter( account => this.accountHealthTone( account ) === 'on' ).length;
    const attentionCount = this._accounts.filter( account => {
      const tone = this.accountHealthTone( account );
      return tone === 'warning' || tone === 'critical';
    } ).length;

    const context: AssistantPageContext = {
      feature: 'social',
      page: 'social-outreach',
      route: this.router.url,
      mode: 'dashboard',
      title: 'Social Accounts',
      description: 'TODD tracks which social accounts are connected, their health, and posting cadence per platform.',
      allowedActions: ['connect_provider', 'test_account_connection', 'disconnect_account'],
      selectedEntityType: 'social-outreach',
      summary: {
        isAuthenticated: this.isLoggedIn,
        selectedTab: 'accounts',
        connectedCount,
        healthyCount,
        attentionCount,
        demoModeEnabled: this.demoModeEnabled
      },
      dataPreview: {
        providerSummary: this.providerSummary
      }
    };

    this.assistantBus.setPageContext( context );
  }

  private enrichAccount ( account: SocialAccount ): SocialAccountView {
    const view = account as SocialAccountView;
    view.displayLabel = this.accountDisplayLabel( account );
    view.healthTone = this.accountHealthTone( account );
    view.healthLabel = this.accountHealthLabel( account );
    view.healthSummaryText = this.accountHealthSummaryText( account );
    view.profileUrl = this.accountProfileUrl( account );
    view.googleBusinessProfileLocationLabelValue = this.googleBusinessProfileLocationLabel( account );
    return view;
  }

  private get hasAuthenticatedRequestContext (): boolean {
    return !!( this.tenantId || this.userId || this.userEmail );
  }

  ngOnInit (): void {
    const userId = this.authService.getCurrentUserIdSync() || 'anonymous';
    this.showIntro = this.pageViewCountService.trackAndCheck( 'social-accounts', userId );

    this.demoModeEnabled = this.demoModeService.isDemoQueryParamEnabled( this.route.snapshot.queryParamMap );

    this.accountService.loadProviderConfigHealth( ( health, availability ) => {
      this.providerConfigHealth = health;
      this.providerAvailability = { ...this.providerAvailability, ...availability };
    } );

    this.subscription.add(
      this.authService.getTenantId().subscribe( tenantId => {
        this.tenantId = tenantId;
        this.isLoggedIn = tenantId != null && tenantId !== '';
        if ( tenantId ) {
          this.loadAddonAccess( tenantId );
        } else {
          this.isPaidAddonSubscriber = false;
        }
        this.loadAccounts();
      } )
    );

    this.subscription.add(
      this.authService.getUserId().subscribe( userId => {
        this.userId = userId || null;
        this.loadAccounts();
      } )
    );

    this.subscription.add(
      this.authService.getUser().subscribe( user => {
        this.userEmail = user?.email || null;
        this.loadAccounts();
      } )
    );

    this.subscription.add(
      this.platformContextService.selectedPlatforms$.subscribe( platforms => {
        this.selectedPlatforms = platforms;
      } )
    );

    this.subscription.add(
      this.cadenceSettingsService.cadenceSettings$.subscribe( settings => {
        this.platformCadenceSettings = settings;
      } )
    );

    this.subscription.add(
      this.route.queryParamMap.subscribe( params => {
        this.demoModeEnabled = this.demoModeService.isDemoQueryParamEnabled( params );
        const authStatus = String( params.get( 'authStatus' ) || '' ).trim();
        const authProvider = String( params.get( 'authProvider' ) || '' ).trim();
        if ( authStatus === 'success' && authProvider ) {
          this.loadAccounts();
          this.notificationService.show( 'Connected', `${this.platformLabel( authProvider )} account connected.`, 'success' );
        } else if ( authStatus === 'error' && authProvider ) {
          this.notificationService.show( 'Connection Error', `Unable to connect ${this.platformLabel( authProvider )}.`, 'error' );
        }
      } )
    );
  }

  ngOnDestroy (): void {
    this.subscription.unsubscribe();
    this.assistantBus.clearPageContext();
  }

  ngAfterViewInit (): void {
    window.scrollTo( 0, 0 );
  }

  selectAllPlatforms (): void { this.platformContextService.selectAll(); }
  togglePlatform ( platform: string ): void { this.platformContextService.toggle( platform ); }

  platformLabel ( platform?: string ): string {
    return this.accountService.platformLabel( platform );
  }

  isProviderConfigured ( provider: string ): boolean {
    return this.accountService.isProviderConfigured( provider, this.providerConfigHealth, this.providerAvailability );
  }

  providerConnectNote ( provider: string ): string {
    return this.accountService.providerConnectNote( provider, this.providerConfigHealth, this.providerAvailability );
  }

  providerConnectButtonLabel ( provider: string ): string {
    return this.accountService.providerConnectButtonLabel( this.accounts, provider );
  }

  connectedAccountsForProvider ( provider: string ): SocialAccount[] {
    return this.accountService.connectedAccountsForProvider( this.accounts, provider );
  }

  hasConnectedAccount ( provider: string ): boolean {
    return this.connectedAccountsForProvider( provider ).length > 0;
  }

  youtubeAccounts (): SocialAccount[] { return this.connectedAccountsForProvider( 'youtube' ); }
  googleBusinessProfileAccounts (): SocialAccount[] { return this.connectedAccountsForProvider( 'google_business_profile' ); }

  googleBusinessProfileLocationLabel ( account: SocialAccount | null | undefined ): string {
    return this.accountService.googleBusinessProfileLocationLabel( account );
  }

  accountDisplayLabel ( account: SocialAccount ): string {
    return this.accountService.accountDisplayLabel( account );
  }

  accountHealthFor ( account: SocialAccount ): SocialAccountHealthRow | null {
    const accountId = String( account?.accountId || '' ).trim();
    return this.accountHealthRows.find( row => String( row.accountId || row.accountIdentity?.accountId || '' ).trim() === accountId ) || null;
  }

  accountHealthTone ( account: SocialAccount ): 'on' | 'warning' | 'critical' | 'off' {
    return this.accountService.healthStateTone( this.accountHealthFor( account ) );
  }

  accountHealthLabel ( account: SocialAccount ): string {
    return this.accountService.healthStateLabel( this.accountHealthFor( account ) );
  }

  accountHealthSummaryText ( account: SocialAccount ): string {
    return this.accountService.healthStateSummary( this.accountHealthFor( account ), account );
  }

  accountProfileUrl ( account: SocialAccount ): string {
    return this.accountService.accountProfileUrl( account );
  }

  getPlatformCadence ( platform: string ): PlatformCadenceConfig {
    return this.cadenceSettingsService.get( platform );
  }

  updatePlatformCadenceField ( platform: string, field: keyof PlatformCadenceConfig, value: any ): void {
    const config = this.cadenceSettingsService.get( platform );
    this.cadenceSettingsService.update( platform, { ...config, [field]: value } );
    if ( field !== 'randomizationWindowMinutes' ) {
      this.notificationService.show( 'Saved', `${this.platformLabel( platform )} cadence updated.`, 'success' );
    }
  }

  addCustomTime ( platform: string ): void {
    const config = this.cadenceSettingsService.get( platform );
    this.cadenceSettingsService.update( platform, { ...config, customTimes: [...config.customTimes, '09:00'] } );
  }

  removeCustomTime ( platform: string, index: number ): void {
    const config = this.cadenceSettingsService.get( platform );
    this.cadenceSettingsService.update( platform, { ...config, customTimes: config.customTimes.filter( ( _, i ) => i !== index ) } );
  }

  updateCustomTime ( platform: string, index: number, value: string ): void {
    const config = this.cadenceSettingsService.get( platform );
    const times = config.customTimes.slice();
    times[index] = value;
    this.cadenceSettingsService.update( platform, { ...config, customTimes: times } );
  }

  connectProvider ( provider: string ): void {
    if ( this.demoModeEnabled ) { this.notificationService.show( 'Demo Mode', 'Provider connections are disabled while viewing the demo.', 'warning' ); return; }
    if ( !this.isProviderConfigured( provider ) ) { this.notificationService.show( 'Connect Unavailable', this.providerConnectNote( provider ), 'warning' ); return; }
    this.accountService.connectProvider(
      provider, this.buildRequestContext(),
      () => this.openBlueskyConnectPanel(),
      dest => this.openGoogleConnectPanel( dest ),
      p => this.platformLabel( p )
    );
  }

  disconnectAccount ( account: SocialAccount ): void {
    if ( !String( account?.accountId || '' ).trim() ) return;
    if ( this.demoModeEnabled ) { this.notificationService.show( 'Demo Mode', 'Provider disconnect is disabled while viewing the demo.', 'warning' ); return; }
    this.accountService.disconnectAccount(
      account, this.buildRequestContext(),
      p => this.platformLabel( p ),
      accountId => {
        this.accounts = this.accounts.filter( a => String( a.accountId || '' ) !== accountId );
        this.accountHealthRows = this.accountService.removeHealthRow( this.accountHealthRows, accountId );
        this.accountHealthSummary = this.accountService.buildHealthSummary( this.accountHealthRows );
      }
    );
  }

  testAccountConnection ( account: SocialAccount ): void {
    this.accountService.testAccountConnection(
      account,
      this.buildRequestContext(),
      this.accountConnectionTestState,
      p => this.platformLabel( p ),
      result => {
        this.accountHealthRows = this.accountService.upsertHealthRow( this.accountHealthRows, result, account );
        this.accountHealthSummary = this.accountService.buildHealthSummary( this.accountHealthRows );
      }
    );
  }

  openGoogleConnectPanel ( destination: 'youtube' | 'google_business_profile' = 'youtube' ): void {
    this.googleDestination = destination;
    this.showGoogleConnectPanel = true;
  }

  closeGoogleConnectPanel (): void {
    this.showGoogleConnectPanel = false;
    this.googleConnecting = false;
  }

  submitGoogleConnection (): void {
    if ( this.demoModeEnabled ) { this.notificationService.show( 'Demo Mode', 'Google connection is disabled while viewing the demo.', 'warning' ); return; }
    this.accountService.submitGoogleConnection(
      this.googleDestination, this.buildRequestContext(),
      p => this.platformLabel( p ),
      connecting => { this.googleConnecting = connecting; }
    );
  }

  openBlueskyConnectPanel (): void { this.showBlueskyConnectPanel = true; }

  closeBlueskyConnectPanel (): void {
    this.showBlueskyConnectPanel = false;
    this.showBlueskyPasswordHelp = false;
    this.blueskyConnecting = false;
  }

  toggleBlueskyPasswordHelp (): void { this.showBlueskyPasswordHelp = !this.showBlueskyPasswordHelp; }

  openBlueskyInNewTab (): void {
    if ( !this.isBrowser ) return;
    window.open( 'https://bsky.app', '_blank', 'noopener,noreferrer' );
  }

  submitBlueskyConnection (): void {
    if ( this.demoModeEnabled ) { this.notificationService.show( 'Demo Mode', 'Bluesky connection is disabled while viewing the demo.', 'warning' ); return; }
    this.accountService.submitBlueskyConnection(
      this.blueskyHandle, this.blueskyAppPassword, this.buildRequestContext(),
      connecting => { this.blueskyConnecting = connecting; },
      account => {
        this.accounts = [account, ...this.accounts.filter( a => a.accountId !== account.accountId )];
        this.blueskyAppPassword = '';
        this.closeBlueskyConnectPanel();
        this.loadAccountHealth();
      }
    );
  }

  private loadAccounts (): void {
    if ( this.demoModeEnabled ) {
      this.accounts = this.demoModeService.buildDemoSocialAccounts();
      this.providerAvailability = this.demoModeService.buildDemoProviderAvailability();
      this.accountHealthRows = [];
      this.accountHealthSummary = null;
      this.accountHealthErrorMessage = '';
      return;
    }
    if ( !this.hasAuthenticatedRequestContext ) {
      this.accounts = [];
      this.providerAvailability = {};
      this.accountHealthRows = [];
      this.accountHealthSummary = null;
      this.accountHealthErrorMessage = '';
      return;
    }
    this.accountService.loadAccounts(
      this.buildRequestContext(),
      ( accounts, providerAvailability ) => {
        this.accounts = accounts;
        this.providerAvailability = providerAvailability;
        this.loadAccountHealth();
      },
      () => {
        this.accounts = [];
        this.providerAvailability = {};
        this.accountHealthRows = [];
        this.accountHealthSummary = null;
      }
    );
  }

  private loadAccountHealth (): void {
    if ( this.demoModeEnabled || !this.hasAuthenticatedRequestContext || !this.accounts.length ) {
      this.accountHealthLoading = false;
      this.accountHealthRows = [];
      this.accountHealthSummary = this.accounts.length ? this.accountService.buildHealthSummary( [] ) : null;
      this.accountHealthErrorMessage = '';
      return;
    }
    this.accountHealthLoading = true;
    this.accountHealthErrorMessage = '';
    this.accountService.loadAccountHealth(
      this.buildRequestContext(),
      ( snapshot: SocialAccountHealthSnapshot ) => {
        this.accountHealthLoading = false;
        this.accountHealthRows = snapshot.accounts || [];
        this.accountHealthSummary = snapshot.summary || this.accountService.buildHealthSummary( this.accountHealthRows );
      },
      () => {
        this.accountHealthLoading = false;
        this.accountHealthRows = [];
        this.accountHealthSummary = null;
        this.accountHealthErrorMessage = 'Unable to load live account health right now.';
      }
    );
  }

  private loadAddonAccess ( tenantId: string ): void {
    this.accountService.loadAddonAccess( tenantId, this.buildRequestContext(), hasAccess => { this.isPaidAddonSubscriber = hasAccess; } );
  }

  private buildRequestContext (): { tenantId?: string; userId?: string; userEmail?: string; } {
    return {
      tenantId: this.tenantId || undefined,
      userId: this.userId || undefined,
      userEmail: this.userEmail || undefined
    };
  }
}

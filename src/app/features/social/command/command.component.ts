import { AfterViewInit, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';

import { BackToTopComponent } from '../../../shared/back-to-top/back-to-top.component';
import { SocialAuthService } from '../../../services/social-auth.service';
import { CockpitActivityItem, SocialActivityService } from '../../../services/social-activity.service';
import { SocialDataService } from '../../../services/social-data.service';
import { AssistantPageContext, ToddAssistantBusService } from '../../../services/social-assistant-signal.service';
import {
  MarketingOperatorStatusResponse,
  SocialApiService,
  SocialAccount,
  SocialAccountHealthRow,
  SocialAccountHealthSummary,
  SocialBootstrapCadenceSummary,
  SocialPost
} from '../../../services/social-api.service';
import { SocialAccountHealthSnapshot, SocialAccountService } from '../services/social-account.service';
import { ClickSoundDirective } from '../../../shared/directives/click-sound.directive';
import { ArcGaugeComponent } from '../../../shared/arc-gauge/arc-gauge.component';
import { PreloaderComponent } from '../../../shared/preloader/preloader.component';
import { StatusLedComponent } from '../../../shared/status-led/status-led.component';

type SocialActivityLightKey =
  | 'draft_generated'
  | 'draft_refined'
  | 'post_published'
  | 'post_failed'
  | 'retry_recovered'
  | 'queue_processed'
  | 'account_problem'
  | 'engagement_captured'
  | 'follow_up_suggested';

type SocialActivityLight = {
  key: SocialActivityLightKey;
  label: string;
};

@Component( {
  selector: 'app-social-outreach',
  standalone: true,
  imports: [CommonModule, RouterModule, BackToTopComponent, ClickSoundDirective, ArcGaugeComponent, StatusLedComponent, PreloaderComponent],
  templateUrl: './command.component.html',
  styleUrl: './social-outreach.component.css'
} )
export class SocialOutreachComponent implements OnInit, OnDestroy, AfterViewInit {
  private readonly route = inject( ActivatedRoute );
  private readonly authService = inject( SocialAuthService );
  private readonly dataService = inject( SocialDataService );
  private readonly outreachApi = inject( SocialApiService );
  private readonly cockpitActivityService = inject( SocialActivityService );
  private readonly accountService = inject( SocialAccountService );
  private readonly assistantBus = inject( ToddAssistantBusService );
  private readonly router = inject( Router );

  private readonly subscription = new Subscription();
  private activitySubscription?: Subscription;
  private currentContextKey = '';

  tenantId: string | null = null;
  userId: string | null = null;
  userEmail: string | null = null;
  isLoggedIn = false;

  postsLoading = false;
  accountsLoading = false;
  operatorStatusLoading = false;
  activityLoading = false;

  postsErrorMessage = '';
  accountsErrorMessage = '';
  operatorStatusErrorMessage = '';
  activityErrorMessage = '';

  posts: SocialPost[] = [];
  accounts: SocialAccount[] = [];
  accountHealthRows: SocialAccountHealthRow[] = [];
  accountHealthSummary: SocialAccountHealthSummary | null = null;
  providerAvailability: Record<string, { configured: boolean; message?: string; }> = {};
  operatorStatus: MarketingOperatorStatusResponse['data'] | null = null;
  cadenceSummary: SocialBootstrapCadenceSummary | null = null;
  socialBackendActivityStreamRows: CockpitActivityItem[] = [];
  showSocialBackendActivityStream = true;

  readonly activityLights: SocialActivityLight[] = [
    { key: 'draft_generated', label: 'Draft Generated' },
    { key: 'draft_refined', label: 'Draft Refined' },
    { key: 'post_published', label: 'Post Published' },
    { key: 'post_failed', label: 'Post Failed' },
    { key: 'retry_recovered', label: 'Retry Recovered' },
    { key: 'queue_processed', label: 'Queue Processed' },
    { key: 'account_problem', label: 'Account Problem' },
    { key: 'engagement_captured', label: 'Engagement Captured' },
    { key: 'follow_up_suggested', label: 'Follow-Up Suggested' }
  ];

  get currentQueryParams (): Record<string, string | number | boolean> {
    return this.route.snapshot.queryParams;
  }

  get sourceRouteLink (): string[] { return ['/calendar']; }
  get accountsRouteLink (): string[] { return ['/accounts']; }

  get connectedAccountsCount (): number {
    return this.accounts.length;
  }

  get approvedQueueCount (): number {
    return Number( this.cadenceSummary?.approvedCount || this.posts.filter( post => this.postStatus( post ) === 'approved' ).length );
  }

  get draftsInReviewCount (): number {
    return Number( this.cadenceSummary?.draftCount || this.posts.filter( post => this.postStatus( post ) === 'draft' ).length );
  }

  get followUpCandidatesCount (): number {
    return this.posts.filter( post => {
      const signal = post?.engagementSignal;
      const suggestion = post?.followUpSuggestion;
      return Boolean(
        suggestion?.summary
        || suggestion?.suggestedNextStep
        || suggestion?.suggestedMessage
        || Number( signal?.comments || 0 ) > 0
        || Number( signal?.clicks || 0 ) > 0
      );
    } ).length;
  }

  get publishedThisWeekCount (): number {
    const start = this.startOfWeek();
    return this.posts.filter( post => {
      if ( this.postStatus( post ) !== 'published' ) return false;
      const publishedAt = this.timestampValue( post.publishedTimestamp || post.updatedAt || post.createdAt || null );
      return publishedAt >= start;
    } ).length;
  }

  get weeklyVisibilityTarget (): number {
    return this.connectedAccountsCount > 0 ? this.connectedAccountsCount * 3 : 15;
  }

  get postsToddCanCreateCount (): number {
    return this.visibilityStillNeededCount;
  }

  get commandCenterPosts (): SocialPost[] {
    return this.posts
      .filter( post => ['draft', 'approved', 'pending_retry', 'failed_permanent', 'rejected_by_subreddit'].includes( this.postStatus( post ) ) )
      .slice( 0, 12 );
  }

  get visibilityStillNeededCount (): number {
    return Math.max( this.weeklyVisibilityTarget - this.publishedThisWeekCount - this.approvedQueueCount, 0 );
  }

  get latestActivity (): CockpitActivityItem | null {
    return this.socialBackendActivityStreamRows[0] || null;
  }

  get liveAccountProblemSummary (): string {
    const blockers = this.accountHealthSummary?.topBlockers || [];
    if ( blockers.length ) {
      const blocker = blockers[0];
      const identity = blocker.displayIdentity || {};
      const label = String( identity.displayName || identity.username || identity.email || blocker.accountId || '' ).trim();
      return `${this.platformLabel( blocker.provider )} account${label ? ` ${label}` : ''} needs attention.`;
    }
    const staleBinding = this.findRecentStaleAccountBinding();
    if ( staleBinding ) {
      return 'Connected accounts look healthy, but an approved post still points to an older disconnected account.';
    }
    return 'All connected social accounts are currently testing healthy.';
  }

  get liveAccountProblemDetail (): string {
    const blockers = this.accountHealthSummary?.topBlockers || [];
    if ( blockers.length ) {
      return this.accountService.healthStateSummary( blockers[0] as SocialAccountHealthRow );
    }
    const staleBinding = this.findRecentStaleAccountBinding();
    if ( staleBinding ) {
      return staleBinding.message || 'Re-select a connected account on the affected approved post.';
    }
    return `${this.accountHealthSummary?.healthyCount || 0}/${this.accountHealthSummary?.totalAccounts || this.accounts.length} connected account tests are healthy.`;
  }

  get latestActivityMessage (): string {
    return this.latestActivity?.message || 'Waiting for Social Outreach activity.';
  }

  get latestActivityDetail (): string {
    const detail = String( this.latestActivity?.detail || '' ).trim();
    if ( detail ) return detail;
    const at = this.latestActivity?.occurredAt || this.latestActivity?.createdAt || '';
    return at ? String( at ) : 'No retained Social events yet.';
  }

  get retainedEventSummary (): string {
    return `${this.socialBackendActivityStreamRows.length} retained event${this.socialBackendActivityStreamRows.length === 1 ? '' : 's'}`;
  }

  ngOnInit (): void {
    this.resolveContextAndLoad();
    this.subscription.add(
      this.authService.getUser().subscribe( () => this.resolveContextAndLoad() )
    );
  }

  ngOnDestroy (): void {
    this.subscription.unsubscribe();
    this.activitySubscription?.unsubscribe();
    this.activitySubscription = undefined;
    this.assistantBus.clearPageContext();
  }

  ngAfterViewInit (): void {
    window.scrollTo( 0, 0 );
  }

  toggleSocialBackendActivityStream (): void {
    this.showSocialBackendActivityStream = !this.showSocialBackendActivityStream;
  }

  trackByActivityLight ( index: number, light: SocialActivityLight ): string {
    return light.key;
  }

  trackByActivityRow ( index: number, item: CockpitActivityItem ): string {
    return String( item?.id || `${item?.type || 'event'}-${item?.occurredAt || item?.createdAt || index}` );
  }

  platformLabel ( platform?: string ): string {
    return this.accountService.platformLabel( platform );
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

  activityLightClass ( light: SocialActivityLight ): Record<string, boolean> {
    const state = this.lightState( light.key );
    return {
      'social-cockpit-light--active': state === 'active',
      'social-cockpit-light--error': state === 'error',
      'social-cockpit-light--pulse': state !== 'idle'
    };
  }

  backendRowClass ( item: CockpitActivityItem ): Record<string, boolean> {
    const normalizedStatus = String( item?.status || '' ).trim().toLowerCase();
    const severity = String( item?.severity || '' ).trim().toLowerCase();
    return {
      'social-backend-stream-row--positive':
        normalizedStatus === 'completed'
        || normalizedStatus === 'success'
        || normalizedStatus === 'published',
      'social-backend-stream-row--attention':
        normalizedStatus === 'blocked'
        || normalizedStatus === 'failed'
        || normalizedStatus === 'error'
        || severity === 'warning'
        || severity === 'error'
    };
  }

  activitySourceLabel ( item: CockpitActivityItem ): string {
    return String(
      item?.sourceComponent
      || item?.sourceEntrypoint
      || ( item?.metadata as Record<string, unknown> | null )?.['component']
      || item?.actor
      || 'social-outreach'
    ).trim();
  }

  activityStatusDetail ( item: CockpitActivityItem ): string {
    const detail = String( item?.detail || '' ).trim();
    if ( detail ) return detail;
    const type = String( item?.type || '' ).trim();
    return type ? this.formatMachineLabel( type ) : 'No additional detail.';
  }

  private resolveContextAndLoad (): void {
    const user = this.authService.getCurrentUserSync();
    const userId = this.authService.getCurrentUserIdSync() || user?.uid || null;
    const userEmail = user?.email || null;
    let tenantId: string | null = null;

    try {
      tenantId = this.dataService.getTenantId();
    } catch {
      tenantId = userId;
    }

    this.tenantId = tenantId || null;
    this.userId = userId || null;
    this.userEmail = userEmail;
    this.isLoggedIn = !!user && !!userId;

    const contextKey = [this.tenantId || '', this.userId || '', this.userEmail || ''].join( '::' );
    if ( !contextKey.trim() ) {
      this.resetForLoggedOutState();
      return;
    }

    if ( contextKey === this.currentContextKey ) {
      return;
    }

    this.currentContextKey = contextKey;
    this.loadAccounts();
    this.loadPosts();
    this.loadOperatorStatus();
    this.connectActivityStream();
    this.publishPageContext();
  }

  private publishPageContext (): void {
    const context: AssistantPageContext = {
      feature: 'social',
      page: 'social-outreach',
      route: this.router.url,
      mode: 'dashboard',
      title: 'Social Command',
      description: 'TODD tracks drafts, the approved queue, connected account health, and follow-up candidates across your social outreach.',
      allowedActions: ['refresh_social_command', 'open_drafts', 'open_accounts', 'open_signals'],
      selectedEntityType: 'social-outreach',
      summary: {
        isAuthenticated: this.isLoggedIn,
        selectedTab: 'command',
        connectedAccounts: this.connectedAccountsCount,
        approvedQueueCount: this.approvedQueueCount,
        draftsInReviewCount: this.draftsInReviewCount,
        followUpCandidatesCount: this.followUpCandidatesCount,
        publishedThisWeek: this.publishedThisWeekCount,
        visibilityStillNeeded: this.visibilityStillNeededCount
      },
      dataPreview: {
        latestActivityMessage: this.latestActivityMessage,
        liveAccountProblemSummary: this.liveAccountProblemSummary
      }
    };

    this.assistantBus.setPageContext( context );
  }

  private resetForLoggedOutState (): void {
    this.currentContextKey = '';
    this.posts = [];
    this.accounts = [];
    this.accountHealthRows = [];
    this.accountHealthSummary = null;
    this.providerAvailability = {};
    this.operatorStatus = null;
    this.cadenceSummary = null;
    this.socialBackendActivityStreamRows = [];
    this.postsLoading = false;
    this.accountsLoading = false;
    this.operatorStatusLoading = false;
    this.activityLoading = false;
    this.postsErrorMessage = '';
    this.accountsErrorMessage = '';
    this.operatorStatusErrorMessage = '';
    this.activityErrorMessage = '';
    this.activitySubscription?.unsubscribe();
    this.activitySubscription = undefined;
  }

  private loadPosts (): void {
    this.postsLoading = true;
    this.postsErrorMessage = '';
    this.outreachApi.getSocialBootstrap( { ...this.requestContext, limit: 100 } ).subscribe( {
      next: response => {
        this.postsLoading = false;
        this.posts = ( response?.data?.posts || [] ).slice().sort( ( left, right ) =>
          String( right.updatedAt || right.createdAt || '' ).localeCompare( String( left.updatedAt || left.createdAt || '' ) )
        );
        this.cadenceSummary = response?.data?.cadenceSummary || null;
        this.publishPageContext();
      },
      error: error => {
        this.postsLoading = false;
        this.posts = [];
        this.cadenceSummary = null;
        this.postsErrorMessage = String( error?.error?.message || 'TODD could not load social posts.' ).trim();
        this.publishPageContext();
      }
    } );
  }

  commandCenterStatusLabel ( post: SocialPost ): string {
    const status = this.postStatus( post );
    if ( status === 'approved' ) return 'Approved queue';
    if ( status === 'draft' ) return post.manualReviewRequired ? 'Returned to draft' : 'Draft in review';
    if ( status === 'pending_retry' ) return 'Retry queued';
    if ( status === 'failed_permanent' ) return 'Publish blocked';
    if ( status === 'rejected_by_subreddit' ) return 'Rejected';
    return this.formatMachineLabel( status || 'draft' );
  }

  truncatePostCopy ( post: SocialPost | null | undefined ): string {
    const text = String( post?.content || '' ).trim().replace( /\s+/g, ' ' );
    if ( text.length <= 220 ) return text;
    return `${text.slice( 0, 217 ).trim()}...`;
  }

  private loadAccounts (): void {
    this.accountsLoading = true;
    this.accountsErrorMessage = '';
    this.accountService.loadAccounts(
      this.requestContext,
      ( accounts, providerAvailability ) => {
        this.accountsLoading = false;
        this.accounts = accounts || [];
        this.providerAvailability = providerAvailability || {};
        this.loadAccountHealth();
      },
      () => {
        this.accountsLoading = false;
        this.accounts = [];
        this.accountHealthRows = [];
        this.accountHealthSummary = null;
        this.providerAvailability = {};
        this.accountsErrorMessage = 'TODD could not load connected social accounts.';
      }
    );
  }

  private loadAccountHealth (): void {
    if ( !this.accounts.length ) {
      this.accountHealthRows = [];
      this.accountHealthSummary = null;
      return;
    }
    this.accountService.loadAccountHealth(
      this.requestContext,
      ( snapshot: SocialAccountHealthSnapshot ) => {
        this.accountHealthRows = snapshot.accounts || [];
        this.accountHealthSummary = snapshot.summary || this.accountService.buildHealthSummary( this.accountHealthRows );
      },
      () => {
        this.accountHealthRows = [];
        this.accountHealthSummary = null;
      }
    );
  }

  private loadOperatorStatus (): void {
    this.operatorStatusLoading = true;
    this.operatorStatusErrorMessage = '';
    this.outreachApi.getMarketingOperatorStatus( this.requestContext ).subscribe( {
      next: response => {
        this.operatorStatusLoading = false;
        this.operatorStatus = response?.data || null;
      },
      error: error => {
        this.operatorStatusLoading = false;
        this.operatorStatus = null;
        this.operatorStatusErrorMessage = String( error?.error?.message || 'TODD could not load operator status.' ).trim();
      }
    } );
  }

  private connectActivityStream (): void {
    const tenantId = String( this.tenantId || '' ).trim();
    if ( !tenantId ) {
      this.socialBackendActivityStreamRows = [];
      return;
    }

    this.activityLoading = true;
    this.activityErrorMessage = '';
    this.activitySubscription?.unsubscribe();
    this.activitySubscription = this.cockpitActivityService.watchTenantCockpitActivityStream(
      tenantId,
      {
        limit: 100,
        domains: ['social_media'],
        surfaces: ['social-outreach']
      }
    ).subscribe( {
      next: snapshot => {
        this.activityLoading = false;
        this.socialBackendActivityStreamRows = snapshot.items || [];
      },
      error: error => {
        this.activityLoading = false;
        this.socialBackendActivityStreamRows = [];
        this.activityErrorMessage = String( error?.message || 'TODD could not load Social backend activity.' ).trim();
      }
    } );
  }

  private get requestContext (): { tenantId?: string; userId?: string; userEmail?: string; } {
    return {
      tenantId: this.tenantId || undefined,
      userId: this.userId || undefined,
      userEmail: this.userEmail || undefined
    };
  }

  private postStatus ( post: SocialPost | null | undefined ): string {
    return String( post?.status || '' ).trim().toLowerCase();
  }

  private timestampValue ( value: string | null | undefined ): number {
    const parsed = Date.parse( String( value || '' ).trim() );
    return Number.isFinite( parsed ) ? parsed : 0;
  }

  private startOfWeek (): number {
    const now = new Date();
    const day = now.getDay();
    const diff = ( day + 6 ) % 7;
    const start = new Date( now );
    start.setHours( 0, 0, 0, 0 );
    start.setDate( start.getDate() - diff );
    return start.getTime();
  }

  lightState ( key: SocialActivityLightKey ): 'idle' | 'active' | 'error' {
    if ( key === 'account_problem' ) {
      if ( ( this.accountHealthSummary?.errorCount || 0 ) > 0 ) return 'error';
      if ( ( this.accountHealthSummary?.warningCount || 0 ) > 0 || !!this.findRecentStaleAccountBinding() ) return 'active';
      return 'idle';
    }
    const items = this.socialBackendActivityStreamRows;
    if ( !items.length ) return 'idle';

    const hasError = items.some( item => this.matchesLight( key, item, true ) );
    if ( hasError ) return 'error';
    const hasActive = items.some( item => this.matchesLight( key, item, false ) );
    return hasActive ? 'active' : 'idle';
  }

  private matchesLight ( key: SocialActivityLightKey, item: CockpitActivityItem, errorOnly: boolean ): boolean {
    const type = String( item?.type || '' ).trim().toLowerCase();
    const status = String( item?.status || '' ).trim().toLowerCase();
    const message = String( item?.message || '' ).trim().toLowerCase();

    if ( key === 'account_problem' ) {
      return errorOnly
        ? status === 'blocked' || status === 'failed' || status === 'error'
        : type.includes( 'operator_alert' ) || status === 'blocked';
    }
    if ( key === 'post_failed' ) {
      return errorOnly
        ? status === 'failed' || status === 'error'
        : type.includes( 'failed' ) || status === 'failed' || status === 'error';
    }
    if ( key === 'queue_processed' ) {
      return type.includes( 'queue_process' ) || type.includes( 'queue_processed' );
    }
    if ( key === 'retry_recovered' ) {
      return type.includes( 'retry' ) || message.includes( 'retry' );
    }
    if ( key === 'post_published' ) {
      return type.includes( 'published' ) || message.includes( 'published' );
    }
    if ( key === 'draft_generated' ) {
      return type.includes( 'draft_generated' ) || message.includes( 'draft generated' );
    }
    if ( key === 'draft_refined' ) {
      return type.includes( 'draft_refined' ) || message.includes( 'draft refined' );
    }
    if ( key === 'engagement_captured' ) {
      return type.includes( 'engagement' ) || message.includes( 'engagement' );
    }
    if ( key === 'follow_up_suggested' ) {
      return type.includes( 'follow_up' ) || message.includes( 'follow-up' );
    }
    return false;
  }

  private formatMachineLabel ( value: string ): string {
    return String( value || '' )
      .trim()
      .replace( /[_-]+/g, ' ' )
      .replace( /\s+/g, ' ' );
  }

  private findRecentStaleAccountBinding (): CockpitActivityItem | null {
    return this.socialBackendActivityStreamRows.find( item => {
      const type = String( item?.type || '' ).trim().toLowerCase();
      const message = String( item?.message || '' ).trim().toLowerCase();
      const detail = String( item?.detail || '' ).trim().toLowerCase();
      return type.includes( 'operator_alert' ) && (
        message.includes( 'no longer connected' ) ||
        detail.includes( 're-select a connected social account' )
      );
    } ) || null;
  }
}

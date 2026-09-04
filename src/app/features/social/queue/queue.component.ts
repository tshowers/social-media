import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, OnDestroy, OnInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { BackToTopComponent } from '../../../shared/back-to-top/back-to-top.component';
import { SectionJumpComponent, SectionJumpItem } from '../../../shared/section-jump/section-jump.component';
import { PreloaderComponent } from '../../../shared/preloader/preloader.component';
import { SocialAuthService } from '../../../services/social-auth.service';
import { NotificationService } from '../../../services/notification.service';
import { MomentumApprovalPolicy, SocialApiService, SocialAccount, SocialMediaAttachment, SocialPost } from '../../../services/social-api.service';
import { SocialAccountService } from '../services/social-account.service';
import { SocialDemoModeService } from '../services/social-demo-mode.service';
import { SocialQueueService, SocialQueuePostPayload } from '../services/social-queue.service';
import { ClickSoundDirective } from '../../../shared/directives/click-sound.directive';
import { ArcGaugeComponent } from '../../../shared/arc-gauge/arc-gauge.component';
import { AssistantPageContext, ToddAssistantBusService } from '../../../services/social-assistant-signal.service';

type DraftActionState = { action: string; label: string; };

type ApprovedQueueFollowThroughPlan = {
  followUpAngle?: string;
  commentHook?: string;
  replyTone?: string;
  distributionIntent?: string;
  replyToneLabel: string;
  distributionIntentLabel: string;
};

interface ApprovedQueueDisplayPost {
  source: SocialPost;
  postId: string;
  platformLabel: string;
  content: string;
  scheduledFor: string | null;
  estimatedPublishLabel: string;
  estimatedPublishDetail: string;
  queueReasonDetail: string;
  lastPublishAttemptAt: string | null;
  profileUrl: string;
  mediaAttachment: SocialMediaAttachment | null;
  isReddit: boolean;
  normalizedSubreddit: string;
  statusLabel: string;
  blockedTone: 'warning' | 'critical';
  retryMessage: string;
  hasDiagnostics: boolean;
  qualitySummary: string;
  qualityVerdictLabel: string;
  qualityStrengths: string[];
  qualityImprovements: string[];
  qualityScore: number | null;
  qualityPublishReady: boolean;
  qualityContextThin: boolean;
  qualityGenericRisk: boolean;
  qualityOffBrandRisk: boolean;
  followThroughPlan: ApprovedQueueFollowThroughPlan | null;
  approvedQueueStateLabel: string;
  approvedQueueOwnershipHint: string;
  hasMissingSocialAccount: boolean;
  hasDisconnectedSocialAccount: boolean;
  hasMissingSubreddit: boolean;
  isBusy: boolean;
  busyLabel: string;
  retryAttemptCount: number;
  maxRetryAttempts: number;
}

interface ApprovedQueuePlatformSection {
  platform: string;
  label: string;
  approvedPosts: ApprovedQueueDisplayPost[];
  blockedPosts: ApprovedQueueDisplayPost[];
  totalCount: number;
}

@Component( {
  selector: 'app-social-outreach-queue',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, BackToTopComponent, PreloaderComponent, ClickSoundDirective, ArcGaugeComponent, SectionJumpComponent],
  templateUrl: './queue.component.html',
  styleUrl: './social-outreach-queue.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class SocialOutreachQueueComponent implements OnInit, OnDestroy, AfterViewInit {
  readonly anchorItems: SectionJumpItem[] = [
    { id: 'drafts-needing-approval', label: 'Drafts Needing Approval' },
    { id: 'approved-posts', label: 'Approved Posts' },
  ];

  private readonly platformId = inject( PLATFORM_ID );
  private readonly cdr = inject( ChangeDetectorRef );
  private readonly isBrowser = isPlatformBrowser( this.platformId );
  private readonly route = inject( ActivatedRoute );
  private readonly router = inject( Router );
  private readonly authService = inject( SocialAuthService );
  private readonly notificationService = inject( NotificationService );
  private readonly outreachApi = inject( SocialApiService );
  private readonly accountService = inject( SocialAccountService );
  private readonly demoModeService = inject( SocialDemoModeService );
  private readonly queueService = inject( SocialQueueService );
  private readonly assistantBus = inject( ToddAssistantBusService );

  private readonly subscription = new Subscription();
  private postsLoadRequestId = 0;
  private publishingPostIds = new Set<string>();
  private readonly queueStatuses = ['approved', 'pending_retry', 'failed_permanent', 'rejected_by_subreddit'];
  private readonly blockedStatuses = ['pending_retry', 'failed_permanent', 'rejected_by_subreddit'];
  private readonly draftActionStateTarget: Record<string, DraftActionState> = {};
  private hasStartedInitialLoad = false;

  loading = false;
  isLoggedIn = false;
  tenantId: string | null = null;
  userId: string | null = null;
  userEmail: string | null = null;
  demoModeEnabled = false;
  isPaidAddonSubscriber = false;
  canPublishPost = false;
  focusedPostId = '';

  firstCommentDrafts: Record<string, string> = {};

  posts: SocialPost[] = [];
  accounts: SocialAccount[] = [];
  approvedPosts: SocialPost[] = [];
  blockedPosts: SocialPost[] = [];
  queuePlatformSections: ApprovedQueuePlatformSection[] = [];
  draftActionState: Record<string, DraftActionState> = this.createDraftActionStateStore();
  queueOwnershipMode: 'auto' | 'manual' | 'unknown' = 'unknown';
  queueOwnershipHeadline = 'Queue ownership could not be confirmed.';
  queueOwnershipSummary = 'TODD is loading the current social publishing authority for this tenant.';
  queueOwnershipBadgeLabel = 'Ownership Unknown';
  queueOwnershipTone: 'active' | 'warning' | 'neutral' = 'neutral';

  get socialPreloaderActive (): boolean {
    return this.loading || this.publishingPostIds.size > 0 || Object.keys( this.draftActionStateTarget ).length > 0;
  }

  get socialPreloaderMessage (): string {
    if ( this.publishingPostIds.size > 0 ) return 'Publishing the selected social post.';
    const actionValues = Object.values( this.draftActionStateTarget );
    if ( actionValues.length > 0 ) {
      return actionValues[0]?.label || 'Working on this social post.';
    }
    return 'Loading approved queue.';
  }

  get currentQueryParams (): Record<string, string | number | boolean> {
    return this.route.snapshot.queryParams;
  }

  get sourceRouteLink (): string[] { return ['/calendar']; }
  get accountsRouteLink (): string[] { return ['/accounts']; }

  ngOnInit (): void {
    this.demoModeEnabled = this.demoModeService.isDemoQueryParamEnabled( this.route.snapshot.queryParamMap );
    this.updatePublishAccess();

    this.subscription.add(
      this.authService.getTenantId().subscribe( tenantId => {
        this.tenantId = tenantId;
        this.isLoggedIn = tenantId != null && tenantId !== '';
        if ( tenantId ) this.loadAddonAccess( tenantId );
        else this.isPaidAddonSubscriber = false;
        this.updatePublishAccess();
        this.maybeLoadPostsAndAccounts();
        this.cdr.markForCheck();
      } )
    );

    this.subscription.add(
      this.authService.getUserId().subscribe( userId => {
        this.userId = userId || null;
        this.maybeLoadPostsAndAccounts();
        this.cdr.markForCheck();
      } )
    );

    this.subscription.add(
      this.authService.getUser().subscribe( user => {
        this.userEmail = user?.email || null;
        this.maybeLoadPostsAndAccounts();
        this.cdr.markForCheck();
      } )
    );

    this.subscription.add(
      this.route.queryParamMap.subscribe( params => {
        this.demoModeEnabled = this.demoModeService.isDemoQueryParamEnabled( params );
        this.focusedPostId = String( params.get( 'focusPostId' ) || '' ).trim();
        this.updatePublishAccess();
        this.rebuildQueueView();
        this.cdr.markForCheck();
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

  platformLabel ( platform?: string ): string {
    return this.accountService.platformLabel( platform );
  }

  publishPost ( post: SocialPost ): void {
    if ( this.demoModeEnabled || !post?.postId ) return;
    if ( this.publishingPostIds.has( post.postId ) ) return;

    const platform = String( post.platform || '' ).trim().toLowerCase();
    const socialAccountId = this.accountService.resolveConnectedAccountIdForProvider( this.accounts, platform, post.socialAccountId );

    if ( !socialAccountId ) {
      this.notificationService.show( 'Account Required', `Connect ${this.platformLabel( post.platform )} and choose an account before posting.`, 'warning' );
      return;
    }
    if ( platform === 'google_business_profile' && !this.accountService.hasGoogleBusinessProfilePublishLocation( this.accounts.find( a => String( a.accountId || '' ) === String( socialAccountId ) ) ) ) {
      this.notificationService.show( 'Business Location Required', 'This Google Business Profile account has no location configured. Reconnect your Google Business Profile account to set up a location.', 'warning' );
      return;
    }
    if ( platform === 'instagram' && !post.mediaAttachment?.url ) {
      this.notificationService.show( 'Media Required', 'Instagram posts must include an image or video. Add media to this draft before posting.', 'warning' );
      return;
    }
    if ( this.isRedditPlatform( post.platform ) && !this.normalizeSubreddit( post.subreddit ) ) {
      this.notificationService.show( 'Subreddit Required', 'Select a subreddit before posting to Reddit.', 'warning' );
      return;
    }

    const publishStatus = String( post.status || 'approved' ).toLowerCase() === 'draft' ? 'approved' : ( post.status || 'approved' );
    const payload = this.buildPayload( post, { status: publishStatus, socialAccountId } );

    this.queueService.publishPost(
      post, payload, socialAccountId, this.normalizeSubreddit( post.subreddit ),
      this.publishingPostIds, this.draftActionState, this.buildRequestContext(),
      ( p: string ) => this.platformLabel( p ),
      ( savedPost: SocialPost ) => {
        this.upsertPost( savedPost );
        this.firstCommentDrafts[savedPost.postId] = this.buildFirstCommentDraft( savedPost );
        this.cdr.markForCheck();
      },
      () => {
        this.rebuildQueueView();
        this.cdr.markForCheck();
      }
    );
    this.rebuildQueueView();
    this.cdr.markForCheck();
  }

  copyFirstComment ( postId: string ): void {
    const text = this.firstCommentDrafts[postId] || '';
    if ( !text ) return;
    if ( typeof navigator !== 'undefined' && navigator.clipboard?.writeText ) {
      navigator.clipboard.writeText( text )
        .then( () => this.notificationService.show( 'Copied', 'First comment copied to clipboard.', 'success' ) )
        .catch( () => this.notificationService.show( 'Copy failed', 'Unable to copy automatically.', 'warning' ) );
    }
  }

  dismissFirstComment ( postId: string ): void {
    delete this.firstCommentDrafts[postId];
    this.cdr.markForCheck();
  }

  private buildFirstCommentDraft ( post: SocialPost ): string {
    const platform = String( post.platform || '' ).trim().toLowerCase();
    const content = String( post.content || '' ).trim();
    const hashtags = this.extractHashtagSuggestions( content, platform );

    if ( platform === 'bluesky' ) {
      return `${hashtags.join( ' ' )} — What's your take on this?`.trim();
    }
    if ( platform === 'linkedin' ) {
      const link = this.extractFirstUrl( content );
      const linkLine = link ? `\n\n${link}` : '';
      return `${hashtags.join( ' ' )}${linkLine}`.trim();
    }
    if ( platform === 'threads' ) {
      const link = this.extractFirstUrl( content );
      const linkLine = link ? `\n\n${link}` : '';
      return `${hashtags.join( ' ' )}${linkLine}`.trim();
    }
    return hashtags.join( ' ' );
  }

  private extractHashtagSuggestions ( content: string, platform: string ): string[] {
    const existing = ( content.match( /#[a-zA-Z0-9_]+/g ) || [] ).slice( 0, 2 );
    if ( existing.length >= 2 ) return existing;
    const fallback = platform === 'linkedin'
      ? ['#businessmomentum', '#strategy']
      : ['#momentum', '#growth'];
    return [...existing, ...fallback.slice( existing.length )];
  }

  private extractFirstUrl ( content: string ): string {
    const match = content.match( /https?:\/\/[^\s]+/ );
    return match ? match[0] : '';
  }

  async resetToApproved ( post: SocialPost ): Promise<void> {
    if ( this.demoModeEnabled || !post?.postId ) return;
    const scheduledFor = this.queueService.buildScheduledForFromCadence( post, this.posts );
    const payload = this.buildPayload( post, {
      socialAccountId: this.accountService.resolveConnectedAccountIdForProvider( this.accounts, String( post.platform || '' ), post.socialAccountId ),
      status: 'approved',
      ...( scheduledFor ? { scheduledFor } : {} )
    } );
    this.rebuildQueueView();
    this.cdr.markForCheck();
    return this.queueService.resetToApproved(
      post, payload, this.draftActionState, this.buildRequestContext(),
      ( p: string ) => this.platformLabel( p ),
      ( savedPost: SocialPost ) => {
        this.upsertPost( savedPost );
      }
    );
  }

  moveApprovedPostToDraft ( post: SocialPost ): void {
    if ( this.demoModeEnabled || !post?.postId ) return;
    const payload = this.buildPayload( post, {
      status: 'draft',
      approvedAt: null,
      scheduledFor: null,
      manualReviewRequired: true,
      returnedToDraftAt: new Date().toISOString()
    } );
    this.rebuildQueueView();
    this.cdr.markForCheck();
    this.queueService.saveDraft(
      post, payload, this.draftActionState, this.buildRequestContext(),
      ( p: string ) => this.platformLabel( p ),
      ( savedPost: SocialPost ) => {
        this.upsertPost( savedPost );
      }
    );
  }

  deleteQueuedPost ( post: SocialPost ): void {
    if ( this.demoModeEnabled || !post?.postId || !this.isLoggedIn ) return;
    const confirmed = !this.isBrowser || window.confirm( 'Delete this approved queue item permanently?' );
    if ( !confirmed ) return;

    this.rebuildQueueView();
    this.cdr.markForCheck();
    this.queueService.deletePost(
      post,
      this.draftActionState,
      this.buildRequestContext(),
      ( p: string ) => this.platformLabel( p ),
      ( deletedPostIds: string[] ) => {
        deletedPostIds.forEach( deletedPostId => this.removePost( deletedPostId ) );
      }
    );
  }

  async copyPostContent ( post: SocialPost ): Promise<void> {
    const content = String( post?.content || '' ).trim();
    if ( !content ) return;
    try {
      if ( this.isBrowser && navigator?.clipboard?.writeText ) {
        await navigator.clipboard.writeText( content );
        this.notificationService.show( 'Copied', `${this.platformLabel( post.platform )} post copied to clipboard.`, 'success' );
        return;
      }
    } catch { /* fall through */ }
    this.notificationService.show( 'Copy Unavailable', 'Clipboard access is unavailable in this browser right now.', 'warning' );
  }

  private get hasAuthContext (): boolean {
    return !!( this.tenantId || this.userId || this.userEmail );
  }

  private createDraftActionStateStore (): Record<string, DraftActionState> {
    return new Proxy( this.draftActionStateTarget, {
      set: ( target, property, value ) => {
        target[String( property )] = value as DraftActionState;
        this.rebuildQueueView();
        this.cdr.markForCheck();
        return true;
      },
      deleteProperty: ( target, property ) => {
        delete target[String( property )];
        this.rebuildQueueView();
        this.cdr.markForCheck();
        return true;
      }
    } );
  }

  private loadPostsAndAccounts (): void {
    if ( this.demoModeEnabled ) {
      this.posts = this.demoModeService.buildDemoSocialPosts(
        { sourceType: 'demo', sourceId: 'demo-source-1', title: 'Demo' },
        'grow_awareness',
        '3x_week'
      ).filter( p => this.queueStatuses.includes( String( p.status || '' ) ) );
      this.accounts = this.demoModeService.buildDemoSocialAccounts();
      this.rebuildQueueView();
      this.cdr.markForCheck();
      return;
    }
    if ( !this.hasAuthContext ) {
      this.posts = [];
      this.accounts = [];
      this.rebuildQueueView();
      this.cdr.markForCheck();
      return;
    }
    this.loadPosts();
    this.loadAccounts();
    this.loadQueueOwnership();
  }

  private maybeLoadPostsAndAccounts (): void {
    if ( this.demoModeEnabled ) {
      this.loadPostsAndAccounts();
      return;
    }
    if ( !this.hasAuthContext ) {
      if ( !this.hasStartedInitialLoad ) {
        this.posts = [];
        this.accounts = [];
        this.loading = false;
        this.rebuildQueueView();
      }
      return;
    }
    this.hasStartedInitialLoad = true;
    this.loadPostsAndAccounts();
  }

  private loadPosts (): void {
    const requestId = ++this.postsLoadRequestId;
    this.loading = true;
    this.cdr.markForCheck();
    this.outreachApi.listSocialPosts( { limit: 100, statuses: this.queueStatuses }, this.buildRequestContext() ).subscribe( {
      next: response => {
        if ( requestId !== this.postsLoadRequestId ) return;
        this.loading = false;
        this.posts = ( response?.data || [] ).slice().sort( ( a, b ) =>
          String( b.updatedAt || '' ).localeCompare( String( a.updatedAt || '' ) )
        );
        this.rebuildQueueView();
        this.cdr.markForCheck();
      },
      error: error => {
        this.loading = false;
        this.notificationService.show( 'Load Error', error?.error?.message || 'TODD could not load the approved queue.', 'error' );
        this.cdr.markForCheck();
      }
    } );
  }

  private loadAccounts (): void {
    this.accountService.loadAccounts( this.buildRequestContext(), ( accounts ) => {
      this.accounts = accounts;
      this.rebuildQueueView();
      this.cdr.markForCheck();
    }, () => {
      this.accounts = [];
      this.rebuildQueueView();
      this.cdr.markForCheck();
    } );
  }

  private loadQueueOwnership (): void {
    this.outreachApi.getMomentumApprovalPolicy( this.buildRequestContext() ).subscribe( {
      next: response => {
        this.applyQueueOwnershipPolicy( response?.data?.approvalPolicy || null );
        this.cdr.markForCheck();
      },
      error: () => {
        this.queueOwnershipMode = 'unknown';
        this.queueOwnershipHeadline = 'Queue ownership could not be confirmed.';
        this.queueOwnershipSummary = 'TODD could not load the Auto Social setting, so publish ownership is temporarily unclear.';
        this.queueOwnershipBadgeLabel = 'Ownership Unknown';
        this.queueOwnershipTone = 'neutral';
        this.rebuildQueueView();
        this.cdr.markForCheck();
      }
    } );
  }

  private applyQueueOwnershipPolicy ( approvalPolicy: MomentumApprovalPolicy | null ): void {
    const socialPostingMode = String( approvalPolicy?.categories?.['social_posting']?.mode || '' ).trim().toLowerCase();
    if ( socialPostingMode === 'auto' ) {
      this.queueOwnershipMode = 'auto';
      this.queueOwnershipHeadline = 'TODD owns this queue.';
      this.queueOwnershipSummary = 'Approved posts will publish automatically when account, cadence, and timing rules say it is safe.';
      this.queueOwnershipBadgeLabel = 'Auto Social On';
      this.queueOwnershipTone = 'active';
      this.rebuildQueueView();
      return;
    }

    if ( socialPostingMode ) {
      this.queueOwnershipMode = 'manual';
      this.queueOwnershipHeadline = 'Approved posts are staged for manual publishing.';
      this.queueOwnershipSummary = 'Auto Social is off, so TODD will not publish approved posts automatically. Use Publish Now when you are ready.';
      this.queueOwnershipBadgeLabel = 'Auto Social Off';
      this.queueOwnershipTone = 'warning';
      this.rebuildQueueView();
      return;
    }

    this.queueOwnershipMode = 'unknown';
    this.queueOwnershipHeadline = 'Queue ownership could not be confirmed.';
    this.queueOwnershipSummary = 'TODD could not determine whether approved posts are manual or automatic right now.';
    this.queueOwnershipBadgeLabel = 'Ownership Unknown';
    this.queueOwnershipTone = 'neutral';
    this.rebuildQueueView();
  }

  private loadAddonAccess ( tenantId: string ): void {
    this.accountService.loadAddonAccess( tenantId, this.buildRequestContext(), hasAccess => {
      this.isPaidAddonSubscriber = hasAccess;
      this.updatePublishAccess();
      this.cdr.markForCheck();
    } );
  }

  private updatePublishAccess (): void {
    this.canPublishPost = this.isLoggedIn && this.isPaidAddonSubscriber && !this.demoModeEnabled;
  }

  private rebuildQueueView (): void {
    this.updatePublishAccess();
    const scopedPosts = this.focusedPostId
      ? this.posts.filter( post => String( post?.postId || '' ).trim() === this.focusedPostId )
      : this.posts;
    this.approvedPosts = scopedPosts.filter( p => String( p?.status || '' ).trim().toLowerCase() === 'approved' );
    this.blockedPosts = scopedPosts.filter( p => this.blockedStatuses.includes( String( p?.status || '' ).trim().toLowerCase() ) );

    const grouped = new Map<string, { approvedPosts: ApprovedQueueDisplayPost[]; blockedPosts: ApprovedQueueDisplayPost[]; }>();

    for ( const post of scopedPosts ) {
      const status = String( post?.status || '' ).trim().toLowerCase();
      if ( status !== 'approved' && !this.blockedStatuses.includes( status ) ) continue;

      const platform = String( post?.platform || 'unknown' ).trim().toLowerCase() || 'unknown';
      const section = grouped.get( platform ) || { approvedPosts: [], blockedPosts: [] };
      const displayPost = this.buildDisplayPost( post );

      if ( status === 'approved' ) {
        section.approvedPosts.push( displayPost );
      } else {
        section.blockedPosts.push( displayPost );
      }
      grouped.set( platform, section );
    }

    this.queuePlatformSections = Array.from( grouped.entries() )
      .map( ( [platform, section] ) => ( {
        platform,
        label: this.platformLabel( platform ),
        approvedPosts: section.approvedPosts,
        blockedPosts: section.blockedPosts,
        totalCount: section.approvedPosts.length + section.blockedPosts.length
      } ) )
      .filter( section => section.totalCount > 0 )
      .sort( ( left, right ) => {
        if ( right.totalCount !== left.totalCount ) return right.totalCount - left.totalCount;
        return left.label.localeCompare( right.label );
      } );

    this.publishPageContext();
  }

  private publishPageContext (): void {
    const context: AssistantPageContext = {
      feature: 'social',
      page: 'social-outreach',
      route: this.router.url,
      mode: 'dashboard',
      title: 'Approved Queue',
      description: 'TODD tracks posts approved and staged for publishing, plus anything blocked and needing attention.',
      allowedActions: ['publish_post', 'edit_queue_post', 'refresh_queue'],
      selectedEntityType: 'social-outreach',
      summary: {
        isAuthenticated: this.isLoggedIn,
        selectedTab: 'queue',
        approvedCount: this.approvedPosts.length,
        blockedCount: this.blockedPosts.length,
        platformSectionCount: this.queuePlatformSections.length,
        queueOwnershipMode: this.queueOwnershipMode
      },
      dataPreview: {
        queueOwnershipHeadline: this.queueOwnershipHeadline,
        queueOwnershipSummary: this.queueOwnershipSummary
      }
    };

    this.assistantBus.setPageContext( context );
  }

  showAllApprovedPosts (): void {
    this.focusedPostId = '';
    const queryParams = { ...this.currentQueryParams } as Record<string, string | number | boolean | null>;
    delete queryParams['focusPostId'];
    void this.router.navigate( [], {
      relativeTo: this.route,
      queryParams,
      replaceUrl: true,
      fragment: 'approved-posts'
    } );
  }

  private buildDisplayPost ( post: SocialPost ): ApprovedQueueDisplayPost {
    const normalizedStatus = String( post?.status || '' ).trim().toLowerCase();
    const followThroughPlan = this.buildFollowThroughPlan( post );
    const qualityDiagnostics = post?.socialQualityDiagnostics || null;
    const profileUrl = this.resolveAccountProfileUrl( post.socialAccountId );
    const normalizedSubreddit = this.normalizeSubreddit( post.subreddit );
    const isBusy = !!( post?.postId && this.draftActionStateTarget[post.postId] );
    const hasAssignedAccountId = !!String( post?.socialAccountId || '' ).trim();
    const hasConnectedSocialAccount = this.hasConnectedSocialAccount( post.socialAccountId );

    return {
      source: post,
      postId: String( post?.postId || '' ).trim(),
      platformLabel: this.platformLabel( post.platform ),
      content: String( post?.content || '' ),
      scheduledFor: post?.scheduledFor || null,
      estimatedPublishLabel: this.buildEstimatedPublishLabel( post ),
      estimatedPublishDetail: this.buildEstimatedPublishDetail( post ),
      queueReasonDetail: this.buildQueueReasonDetail( post ),
      lastPublishAttemptAt: post?.lastPublishAttemptAt || null,
      profileUrl,
      mediaAttachment: post?.mediaAttachment || null,
      isReddit: this.isRedditPlatform( post.platform ),
      normalizedSubreddit,
      statusLabel: this.queueService.postStatusLabel( post ),
      blockedTone: normalizedStatus === 'pending_retry' ? 'warning' : 'critical',
      retryMessage: this.queueService.retryStatusMessage( post ),
      hasDiagnostics: !!( qualityDiagnostics || followThroughPlan ),
      qualitySummary: String( qualityDiagnostics?.summary || post?.contentEvaluation?.summary || '' ).trim(),
      qualityVerdictLabel: String( qualityDiagnostics?.verdict || post?.draftQuality || post?.contentEvaluation?.verdict || 'workable' ).trim().replace( /-/g, ' ' ),
      qualityStrengths: Array.isArray( qualityDiagnostics?.strengths ) ? qualityDiagnostics!.strengths.filter( Boolean ).slice( 0, 3 ) : [],
      qualityImprovements: Array.isArray( qualityDiagnostics?.improvements ) ? qualityDiagnostics!.improvements.filter( Boolean ).slice( 0, 3 ) : [],
      qualityScore: typeof qualityDiagnostics?.overallScore === 'number' ? qualityDiagnostics.overallScore : null,
      qualityPublishReady: !!qualityDiagnostics?.publishReady,
      qualityContextThin: !!qualityDiagnostics?.contextThin,
      qualityGenericRisk: !!qualityDiagnostics?.riskFlags?.genericSaaSRisk,
      qualityOffBrandRisk: !!qualityDiagnostics?.riskFlags?.offBrandRisk,
      followThroughPlan,
      approvedQueueStateLabel: this.buildApprovedQueueStateLabel( post ),
      approvedQueueOwnershipHint: this.buildApprovedQueueOwnershipHint( post ),
      hasMissingSocialAccount: !hasAssignedAccountId,
      hasDisconnectedSocialAccount: hasAssignedAccountId && !hasConnectedSocialAccount,
      hasMissingSubreddit: this.isRedditPlatform( post.platform ) && !normalizedSubreddit,
      isBusy,
      busyLabel: isBusy ? this.draftActionStateTarget[String( post?.postId || '' )]?.label || 'Working…' : '',
      retryAttemptCount: Number( post?.retryAttemptCount || 0 ),
      maxRetryAttempts: Number( post?.maxRetryAttempts || 3 )
    };
  }

  private buildEstimatedPublishLabel ( post: SocialPost ): string {
    if ( this.queueOwnershipMode === 'manual' ) {
      return 'Estimated publish';
    }

    if ( this.hasDisconnectedSocialAccount( post ) || !String( post?.socialAccountId || '' ).trim() ) {
      return 'Publish blocked';
    }

    const reason = String( post?.queueWaitReason || '' ).trim().toLowerCase();
    if ( reason === 'missing_social_account' || reason === 'missing_provider_platform' ) {
      return 'Publish blocked';
    }
    if ( reason === 'outside_posting_window' || reason === 'daily_cadence_limit_reached' ) {
      return 'Waiting to publish';
    }

    const scheduledFor = this.parseQueueDate( post?.scheduledFor );
    if ( scheduledFor && scheduledFor.getTime() > Date.now() ) {
      return 'Estimated publish';
    }

    if ( scheduledFor && scheduledFor.getTime() <= Date.now() ) {
      return 'Needs a new publish slot';
    }

    return 'Estimated publish';
  }

  private buildEstimatedPublishDetail ( post: SocialPost ): string {
    if ( this.queueOwnershipMode === 'manual' ) {
      return 'Manual publish only';
    }

    if ( this.hasDisconnectedSocialAccount( post ) || !String( post?.socialAccountId || '' ).trim() ) {
      return 'Waiting for a connected account';
    }

    const reason = String( post?.queueWaitReason || '' ).trim().toLowerCase();
    switch ( reason ) {
      case 'missing_social_account':
        return 'Waiting for a connected account';
      case 'missing_provider_platform':
        return 'Waiting for platform configuration';
      case 'daily_cadence_limit_reached':
        return 'After the current daily posting limit resets';
      case 'outside_posting_window':
        return 'Next allowed posting window';
    }

    const scheduledFor = this.parseQueueDate( post?.scheduledFor );
    if ( scheduledFor && scheduledFor.getTime() > Date.now() ) {
      return this.formatEstimatedPublishDate( scheduledFor );
    }
    if ( scheduledFor && scheduledFor.getTime() <= Date.now() ) {
      return 'Previous scheduled time already passed';
    }

    switch ( reason ) {
      default:
        return 'Next safe publish moment';
    }
  }

  private buildQueueReasonDetail ( post: SocialPost ): string {
    if ( this.queueOwnershipMode === 'manual' ) {
      return 'Auto Social is off, so queue timing is not driving this post.';
    }

    const scheduledFor = this.parseQueueDate( post?.scheduledFor );
    const hasPastScheduledTarget = !!scheduledFor && scheduledFor.getTime() <= Date.now();
    if ( this.hasDisconnectedSocialAccount( post ) && hasPastScheduledTarget ) {
      return 'The scheduled publish target already passed, and TODD could not publish because the selected account is no longer connected.';
    }
    if ( this.hasDisconnectedSocialAccount( post ) ) {
      return 'This cannot publish because the selected account is no longer connected.';
    }
    if ( hasPastScheduledTarget ) {
      return 'The previous scheduled publish time already passed, so TODD needs to place this into a new publish slot before it can go out.';
    }

    const reason = String( post?.queueWaitReason || '' ).trim().toLowerCase();
    switch ( reason ) {
      case 'scheduled_for_future':
        return 'TODD already assigned this post a future slot.';
      case 'outside_posting_window':
        return 'This is not delayed by too many posts. TODD is waiting for the next allowed posting window.';
      case 'daily_cadence_limit_reached':
        return 'This is delayed by queue volume or cadence rules, not by a publish failure.';
      case 'missing_social_account':
        return 'This is not waiting on queue volume. It cannot publish because the selected account is disconnected or missing.';
      case 'missing_provider_platform':
        return 'This cannot publish until the platform connection details are repaired.';
      default:
        return 'TODD is still evaluating timing and account rules for the next safe release.';
    }
  }

  private parseQueueDate ( value: string | null | undefined ): Date | null {
    const raw = String( value || '' ).trim();
    if ( !raw ) return null;
    const parsed = new Date( raw );
    return Number.isNaN( parsed.getTime() ) ? null : parsed;
  }

  private formatEstimatedPublishDate ( value: Date ): string {
    return new Intl.DateTimeFormat( 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    } ).format( value );
  }

  private buildFollowThroughPlan ( post: SocialPost ): ApprovedQueueFollowThroughPlan | null {
    const plan = post?.followThroughPlan || post?.strategyContext || null;
    if ( !plan ) return null;

    const followUpAngle = String( ( plan as any ).followUpAngle || '' ).trim();
    const commentHook = String( ( plan as any ).commentHook || '' ).trim();
    const replyTone = String( ( plan as any ).replyTone || '' ).trim();
    const distributionIntent = String( ( plan as any ).distributionIntent || '' ).trim();

    if ( !followUpAngle && !commentHook && !replyTone && !distributionIntent ) {
      return null;
    }

    return {
      followUpAngle,
      commentHook,
      replyTone,
      distributionIntent,
      replyToneLabel: this.formatFollowThroughLabel( replyTone ),
      distributionIntentLabel: this.formatFollowThroughLabel( distributionIntent )
    };
  }

  private formatFollowThroughLabel ( value: string | null | undefined ): string {
    return String( value || '' )
      .trim()
      .replace( /[_-]+/g, ' ' )
      .replace( /\s+/g, ' ' )
      .replace( /\b\w/g, char => char.toUpperCase() );
  }

  private resolveAccountProfileUrl ( accountId: string | null | undefined ): string {
    const id = String( accountId || '' ).trim();
    if ( !id ) return '';
    const acct = this.accounts.find( a => String( a.accountId || '' ) === id ) || null;
    return acct ? this.accountService.accountProfileUrl( acct ) : '';
  }

  private hasConnectedSocialAccount ( accountId: string | null | undefined ): boolean {
    const id = String( accountId || '' ).trim();
    if ( !id ) return false;
    return this.accounts.some( account => String( account.accountId || '' ).trim() === id );
  }

  private hasDisconnectedSocialAccount ( post: SocialPost | null | undefined ): boolean {
    const id = String( post?.socialAccountId || '' ).trim();
    return !!id && !this.hasConnectedSocialAccount( id );
  }

  private isRedditPlatform ( platform: string | null | undefined ): boolean {
    return String( platform || '' ).trim().toLowerCase() === 'reddit';
  }

  private normalizeSubreddit ( value: string | null | undefined ): string {
    return String( value || '' ).trim().replace( /^\/?r\//i, '' ).toLowerCase();
  }

  private buildApprovedQueueStateLabel ( post: SocialPost ): string {
    if ( this.queueOwnershipMode === 'manual' ) {
      return 'Ready for manual publish';
    }

    if ( this.hasDisconnectedSocialAccount( post ) ) {
      return 'Selected account is no longer connected';
    }

    const explicitLabel = String( post?.queueWaitReasonLabel || '' ).trim();
    if ( explicitLabel ) return explicitLabel;

    const scheduledFor = String( post?.scheduledFor || '' ).trim();
    if ( scheduledFor ) {
      const scheduledAt = new Date( scheduledFor );
      if ( !Number.isNaN( scheduledAt.getTime() ) && scheduledAt.getTime() > Date.now() ) {
        return 'Scheduled for later';
      }
      if ( !Number.isNaN( scheduledAt.getTime() ) && scheduledAt.getTime() <= Date.now() ) {
        return 'Waiting for a new publish slot';
      }
    }

    if ( !String( post?.socialAccountId || '' ).trim() ) {
      return 'No connected account selected';
    }

    return this.queueOwnershipMode === 'auto'
      ? 'TODD is waiting for the next safe publish moment.'
      : 'Ready for manual publish';
  }

  private buildApprovedQueueOwnershipHint ( post: SocialPost ): string {
    if ( this.queueOwnershipMode === 'manual' ) {
      return 'TODD will not auto-publish this until Auto Social is enabled.';
    }

    if ( this.hasDisconnectedSocialAccount( post ) ) {
      return 'TODD cannot auto-publish this until the disconnected account is repaired or replaced.';
    }

    const reason = String( post?.queueWaitReason || '' ).trim().toLowerCase();
    switch ( reason ) {
      case 'scheduled_for_future':
        return 'TODD has a publish target set and will post it when that time arrives.';
      case 'outside_posting_window':
        return 'TODD is holding this until the next allowed posting window.';
      case 'daily_cadence_limit_reached':
        return 'TODD paused this because the daily cadence limit has already been reached.';
      case 'missing_social_account':
        return 'TODD cannot publish this until a connected account is selected.';
      case 'missing_provider_platform':
        return 'TODD cannot publish this because platform details are incomplete.';
      default:
        return 'TODD owns this queue item and will publish it when timing and account rules allow.';
    }
  }

  private buildPayload ( post: SocialPost, overrides: Partial<SocialPost> = {} ): SocialQueuePostPayload {
    return {
      actionId: overrides.actionId !== undefined ? overrides.actionId : ( post.actionId || null ),
      planId: overrides.planId !== undefined ? overrides.planId : ( post.planId || null ),
      strategyId: overrides.strategyId !== undefined ? overrides.strategyId : ( post.strategyId || null ),
      segmentId: overrides.segmentId !== undefined ? overrides.segmentId : ( post.segmentId || null ),
      angleId: overrides.angleId !== undefined ? overrides.angleId : ( post.angleId || null ),
      sourceContentReference: post.sourceContentReference,
      platform: String( overrides.platform || post.platform || '' ),
      socialAccountId: String( overrides.socialAccountId || post.socialAccountId || '' ),
      subreddit: this.normalizeSubreddit( overrides.subreddit !== undefined ? overrides.subreddit : post.subreddit ),
      mediaAttachment: overrides.mediaAttachment !== undefined ? overrides.mediaAttachment : ( post.mediaAttachment || null ),
      content: String( overrides.content !== undefined ? overrides.content : post.content || '' ),
      status: String( overrides.status || post.status || 'draft' ),
      strategyContext: post.strategyContext || null,
      followThroughPlan: post.followThroughPlan || null,
      identityContext: post.identityContext || null,
      offerContext: post.offerContext || null,
      identityReview: post.identityReview || null,
      approvedAt: overrides.approvedAt !== undefined ? overrides.approvedAt : ( post.approvedAt || null ),
      scheduledFor: overrides.scheduledFor !== undefined ? overrides.scheduledFor : ( post.scheduledFor || null ),
      manualReviewRequired: overrides.manualReviewRequired !== undefined ? !!overrides.manualReviewRequired : !!post.manualReviewRequired,
      returnedToDraftAt: overrides.returnedToDraftAt !== undefined ? overrides.returnedToDraftAt : ( post.returnedToDraftAt || null ),
      engagementSignal: post.engagementSignal || null,
      followUpSuggestion: post.followUpSuggestion || null,
      redditSafety: post.redditSafety || null,
      publishedTimestamp: post.publishedTimestamp || null,
      externalPlatformPostId: post.externalPlatformPostId || null
    };
  }

  private upsertPost ( updated: SocialPost ): void {
    const shouldRemove = !this.queueStatuses.includes( String( updated.status || '' ) );
    if ( shouldRemove ) {
      this.posts = this.posts.filter( p => p.postId !== updated.postId );
      this.rebuildQueueView();
      this.cdr.markForCheck();
      return;
    }
    const idx = this.posts.findIndex( p => p.postId === updated.postId );
    if ( idx >= 0 ) {
      this.posts = [...this.posts.slice( 0, idx ), updated, ...this.posts.slice( idx + 1 )];
    } else {
      this.posts = [updated, ...this.posts];
    }
    this.rebuildQueueView();
    this.cdr.markForCheck();
  }

  private removePost ( postId: string ): void {
    const normalizedPostId = String( postId || '' ).trim();
    if ( !normalizedPostId ) return;
    this.posts = this.posts.filter( p => p.postId !== normalizedPostId );
    this.rebuildQueueView();
    this.cdr.markForCheck();
  }

  private buildRequestContext (): { tenantId?: string; userId?: string; userEmail?: string; } {
    return {
      tenantId: this.tenantId || undefined,
      userId: this.userId || undefined,
      userEmail: this.userEmail || undefined
    };
  }
}

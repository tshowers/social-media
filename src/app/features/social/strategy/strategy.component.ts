import { AfterViewInit, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { SocialAuthService } from '../../../services/social-auth.service';
import { PageViewCountService } from '../../../services/page-view-count.service';
import { NotificationService } from '../../../services/notification.service';
import { AssistantPageContext, ToddAssistantBusService } from '../../../services/social-assistant-signal.service';
import {
  BlueskyNichePost,
  SocialApiService,
  SocialAccount,
  SocialPost,
  SocialDraftStrategyContext,
  SocialStrategyCadence,
  SocialStrategyGoal,
  SocialStrategyPlatformFocus
} from '../../../services/social-api.service';
import { LoggerService } from '../../../services/logger.service';
import { ToddWritingIdentityState } from '../../../models/todd-writing-identity.model';

import { SocialStrategyRecommendation, SocialStrategyService } from '../services/social-strategy.service';
import { SocialPlatformContextService } from '../services/social-platform-context.service';
import { SocialDemoModeService } from '../services/social-demo-mode.service';
import { SocialIdentityReviewService } from '../services/social-identity-review.service';
import { SocialAccountService } from '../services/social-account.service';
import { BackToTopComponent } from '../../../shared/back-to-top/back-to-top.component';
import { PreloaderComponent } from '../../../shared/preloader/preloader.component';
import { ArcGaugeComponent } from '../../../shared/arc-gauge/arc-gauge.component';
import { StatusLedComponent } from '../../../shared/status-led/status-led.component';

@Component( {
  selector: 'app-social-outreach-strategy',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, BackToTopComponent, PreloaderComponent, ArcGaugeComponent, StatusLedComponent],
  templateUrl: './strategy.component.html',
  styleUrl: './social-outreach-strategy.component.css'
} )
export class SocialOutreachStrategyComponent implements OnInit, OnDestroy, AfterViewInit {
  private readonly route = inject( ActivatedRoute );
  private readonly authService = inject( SocialAuthService );
  private readonly pageViewCountService = inject( PageViewCountService );
  private readonly notificationService = inject( NotificationService );
  private readonly outreachApi = inject( SocialApiService );
  private readonly logger = inject( LoggerService );
  private readonly socialStrategyService = inject( SocialStrategyService );
  private readonly platformContextService = inject( SocialPlatformContextService );
  private readonly demoModeService = inject( SocialDemoModeService );
  private readonly identityReviewService = inject( SocialIdentityReviewService );
  private readonly accountService = inject( SocialAccountService );
  private readonly assistantBus = inject( ToddAssistantBusService );
  private readonly router = inject( Router );

  private readonly subscription = new Subscription();
  private postsLoadRequestId = 0;
  private strategyLoaded = false;
  private strategyBusy = false;

  loading = false;
  isLoggedIn = false;
  tenantId: string | null = null;
  userId: string | null = null;
  userEmail: string | null = null;
  demoModeEnabled = false;
  showIntro = true;

  posts: SocialPost[] = [];
  accounts: SocialAccount[] = [];
  selectedPlatforms: Record<string, boolean> = {
    linkedin: true, threads: true, bluesky: true, reddit: false,
    youtube: false, google_business_profile: true, instagram: false, facebook: false
  };

  strategyGoal: SocialStrategyGoal = 'grow_awareness';
  strategyPlatformFocus: SocialStrategyPlatformFocus = 'auto';
  strategyCadence: SocialStrategyCadence = '3x_week';
  strategyRecommendation: SocialStrategyRecommendation | null = null;

  nichePosts: BlueskyNichePost[] = [];
  nichePostsLoading = false;
  nichePostsLoaded = false;
  nicheReplyDrafts: Record<string, string> = {};
  nicheReplyBusy: Record<string, boolean> = {};
  marketingStrategyState: SocialDraftStrategyContext | null = null;
  todayOperatorStatus = 'idle';
  operatorNextBestAction = '';
  operatorPendingApprovalsCount = 0;
  operatorBlockedNeedsCount = 0;
  lastEndOfDaySummary = '';

  identityState: ToddWritingIdentityState | null = null;
  identityStateLoaded = false;
  private identityStateLoading = false;

  readonly strategyGoalOptions: Array<{ value: SocialStrategyGoal; label: string; }> = [
    { value: 'grow_awareness', label: 'Grow awareness' },
    { value: 'grow_followers', label: 'Grow followers' },
    { value: 'drive_engagement', label: 'Drive engagement' },
    { value: 'build_authority', label: 'Build authority' },
    { value: 'drive_traffic', label: 'Drive traffic' },
    { value: 'generate_leads', label: 'Generate leads' }
  ];
  readonly strategyPlatformOptions: Array<{ value: SocialStrategyPlatformFocus; label: string; }> = [
    { value: 'auto', label: 'Auto' },
    { value: 'linkedin', label: 'LinkedIn' },
    { value: 'threads', label: 'Threads' },
    { value: 'bluesky', label: 'Bluesky' },
    { value: 'reddit', label: 'Reddit' },
    { value: 'youtube', label: 'YouTube' },
    { value: 'google_business_profile', label: 'Google Business Profile' },
    { value: 'balanced', label: 'Both' }
  ];
  readonly strategyCadenceOptions: Array<{ value: SocialStrategyCadence; label: string; }> = [
    { value: '2x_day', label: '2x per day' },
    { value: 'daily', label: 'Daily (1x/day)' },
    { value: '5x_week', label: '5x per week' },
    { value: '3x_week', label: '3x per week' },
    { value: '2x_week', label: '2x per week' },
    { value: 'weekly', label: 'Weekly' }
  ];

  get socialPreloaderActive (): boolean { return this.loading; }
  get socialPreloaderMessage (): string { return 'Loading social strategy.'; }

  get currentQueryParams (): Record<string, string | number | boolean> {
    return this.route.snapshot.queryParams;
  }

  get sourceRouteLink (): string[] { return ['/calendar']; }
  get accountsRouteLink (): string[] { return ['/accounts']; }

  get approvedPosts (): SocialPost[] {
    return this.posts.filter( post => this.workflowStatusForPost( post ) === 'approved' );
  }

  get cadenceTargetCount (): number {
    if ( this.strategyRecommendation?.cadenceTargetCount ) return this.strategyRecommendation.cadenceTargetCount;
    const map: Record<string, number> = { '2x_day': 14, 'daily': 7, '5x_week': 5, '3x_week': 3, '2x_week': 2, 'weekly': 1 };
    return map[this.strategyCadence] ?? 3;
  }

  get publishedThisWeek (): number { return this.strategyRecommendation?.publishedThisWeek || 0; }
  get postsNeededNow (): number { return this.strategyRecommendation?.postsNeededNow || 0; }
  get hasOperatorSnapshot (): boolean {
    return !!(
      this.operatorNextBestAction ||
      this.operatorPendingApprovalsCount ||
      this.operatorBlockedNeedsCount ||
      this.lastEndOfDaySummary ||
      this.todayOperatorStatus !== 'idle'
    );
  }

  private get hasAuthenticatedRequestContext (): boolean {
    return !!( this.tenantId || this.userId || this.userEmail );
  }

  ngOnInit (): void {
    const userId = this.authService.getCurrentUserIdSync() || 'anonymous';
    this.showIntro = this.pageViewCountService.trackAndCheck( 'social-strategy', userId );

    this.demoModeEnabled = this.demoModeService.isDemoQueryParamEnabled( this.route.snapshot.queryParamMap );

    this.subscription.add(
      this.authService.getTenantId().subscribe( tenantId => {
        this.tenantId = tenantId;
        this.isLoggedIn = tenantId != null && tenantId !== '';
        if ( this.hasAuthenticatedRequestContext ) this.loadPosts();
      } )
    );

    this.subscription.add(
      this.authService.getUserId().subscribe( userId => {
        this.userId = userId || null;
        if ( this.hasAuthenticatedRequestContext ) this.loadPosts();
      } )
    );

    this.subscription.add(
      this.authService.getUser().subscribe( user => {
        this.userEmail = user?.email || null;
        if ( user ) {
          this.loadIdentityState();
        } else {
          this.identityState = null;
          this.identityStateLoaded = true;
          this.identityStateLoading = false;
        }
        if ( this.hasAuthenticatedRequestContext ) this.loadPosts();
      } )
    );

    this.subscription.add(
      this.platformContextService.selectedPlatforms$.subscribe( platforms => {
        this.selectedPlatforms = platforms;
        this.refreshStrategy();
      } )
    );

    this.subscription.add(
      this.route.queryParamMap.subscribe( params => {
        this.demoModeEnabled = this.demoModeService.isDemoQueryParamEnabled( params );
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

  onStrategyChanged (): void {
    this.applyStrategyPlatformSelection();
    this.refreshStrategy();
    this.saveMarketingStrategy();
    this.generateMarketingStrategy();
  }

  private loadPosts (): void {
    if ( !this.hasAuthenticatedRequestContext ) {
      this.posts = [];
      this.refreshStrategy();
      return;
    }

    const requestId = ++this.postsLoadRequestId;
    this.loading = true;

    this.outreachApi.listSocialPosts( { limit: 100 }, this.buildRequestContext() ).subscribe( {
      next: response => {
        if ( requestId !== this.postsLoadRequestId ) return;
        this.loading = false;
        this.posts = ( response?.data || [] ).slice().sort( ( a, b ) =>
          String( b.updatedAt || '' ).localeCompare( String( a.updatedAt || '' ) )
        );
        this.loadAccounts();
        this.loadMarketingStrategy();
        this.refreshStrategy();
      },
      error: error => {
        this.loading = false;
        this.notificationService.show( 'Load Error', error?.error?.message || 'TODD could not load social posts for strategy.', 'error' );
        this.loadAccounts();
        this.loadMarketingStrategy();
        this.refreshStrategy();
      }
    } );
  }

  private refreshStrategy (): void {
    // Only count accounts for platforms actually checked in Social views -
    // matching how Drafts/Source already filters (selectedPlatforms[x] === true,
    // not just "not explicitly false"). Using the stricter check also correctly
    // excludes an account whose stored provider string doesn't match any known
    // platform key at all (e.g. a legacy "google" connection predating the
    // youtube/google_business_profile split) - that used to slip through and
    // inflate the cadence target/posts-needed-now math below.
    const activeAccounts = this.accounts.filter(
      account => this.selectedPlatforms[ String( account.provider || '' ).trim().toLowerCase() ] === true
    );
    const baseRecommendation = this.socialStrategyService.buildRecommendation( {
      goal: this.strategyGoal,
      platformFocus: this.strategyPlatformFocus,
      cadence: this.strategyCadence,
      posts: this.posts,
      accounts: activeAccounts,
      sourceSnapshot: null
    } );
    this.strategyRecommendation = this.mergeStrategyRecommendation( baseRecommendation, this.marketingStrategyState );
    this.publishPageContext();
  }

  private publishPageContext (): void {
    const context: AssistantPageContext = {
      feature: 'social',
      page: 'social-outreach',
      route: this.router.url,
      mode: 'dashboard',
      title: 'Social Strategy',
      description: 'TODD follows this posting strategy — goal, platform focus, and cadence target — when generating drafts.',
      allowedActions: ['update_strategy', 'generate_marketing_strategy'],
      selectedEntityType: 'social-outreach',
      summary: {
        isAuthenticated: this.isLoggedIn,
        selectedTab: 'strategy',
        strategyGoal: this.strategyGoal,
        strategyPlatformFocus: this.strategyPlatformFocus,
        strategyCadence: this.strategyCadence,
        cadenceTargetCount: this.cadenceTargetCount,
        approvedPostsCount: this.approvedPosts.length,
        operatorStatus: this.todayOperatorStatus,
        operatorPendingApprovalsCount: this.operatorPendingApprovalsCount,
        operatorBlockedNeedsCount: this.operatorBlockedNeedsCount
      },
      dataPreview: {
        operatorNextBestAction: this.operatorNextBestAction,
        lastEndOfDaySummary: this.lastEndOfDaySummary
      }
    };

    this.assistantBus.setPageContext( context );
  }

  private loadIdentityState (): void {
    if ( this.identityStateLoading ) return;
    this.identityReviewService.loadIdentityState(
      this.subscription,
      state => { this.identityState = state; },
      ( loading, loaded ) => {
        this.identityStateLoading = loading;
        this.identityStateLoaded = loaded;
      }
    );
  }

  private applyStrategyPlatformSelection (): void {
    const focus = this.strategyPlatformFocus;
    if ( focus === 'balanced' ) {
      this.selectedPlatforms = { ...this.selectedPlatforms, linkedin: true, threads: true };
      return;
    }
    if ( focus === 'linkedin' || focus === 'threads' || focus === 'bluesky' ||
      focus === 'reddit' || focus === 'youtube' || focus === 'google_business_profile' ) {
      this.selectedPlatforms = {
        linkedin: focus === 'linkedin', threads: focus === 'threads',
        bluesky: focus === 'bluesky', reddit: focus === 'reddit',
        youtube: focus === 'youtube', google_business_profile: focus === 'google_business_profile',
        instagram: false, facebook: false
      };
    }
  }

  private loadAccounts (): void {
    if ( !this.hasAuthenticatedRequestContext ) {
      this.accounts = [];
      this.refreshStrategy();
      return;
    }

    this.accountService.loadAccounts(
      this.buildRequestContext(),
      accounts => {
        this.accounts = accounts;
        this.refreshStrategy();
        const hasBluesky = accounts.some( a => String( a.provider || '' ).trim().toLowerCase() === 'bluesky' );
        if ( hasBluesky ) this.loadNichePosts();
      },
      () => {
        this.accounts = [];
        this.refreshStrategy();
      }
    );
  }

  private loadNichePosts (): void {
    if ( this.nichePostsLoading || !this.hasAuthenticatedRequestContext ) return;
    const keywords = [
      this.strategyRecommendation?.contentLane || 'momentum',
      'business',
      'automation'
    ].join( ' ' );
    this.nichePostsLoading = true;
    this.outreachApi.getBlueskyNichePosts( keywords, this.buildRequestContext() ).subscribe( {
      next: response => {
        this.nichePostsLoading = false;
        this.nichePostsLoaded = true;
        this.nichePosts = Array.isArray( response?.data ) ? response.data.slice( 0, 5 ) : [];
      },
      error: () => {
        this.nichePostsLoading = false;
        this.nichePostsLoaded = true;
        this.nichePosts = [];
      }
    } );
  }

  copyNichePostUrl ( post: BlueskyNichePost ): void {
    if ( typeof navigator !== 'undefined' && navigator.clipboard?.writeText ) {
      navigator.clipboard.writeText( post.postUrl )
        .then( () => this.notificationService.show( 'Copied', 'Post URL copied.', 'success' ) )
        .catch( () => {} );
    }
  }

  private loadMarketingStrategy (): void {
    if ( !this.hasAuthenticatedRequestContext || this.strategyLoaded ) return;
    this.strategyLoaded = true;
    this.outreachApi.getMarketingOperatorStrategy( this.buildRequestContext() ).subscribe( {
      next: response => {
        const strategy = response?.data || null;
        this.logger.info( '[SOCIAL_STRATEGY] strategy loaded', { strategy } );
        if ( strategy ) {
          this.marketingStrategyState = strategy;
          this.applyPersistedStrategyControls( strategy );
        } else {
          this.generateMarketingStrategy();
        }
        this.loadMarketingOperatorStatus();
        this.refreshStrategy();
      },
      error: error => {
        this.logger.warn( '[SOCIAL_STRATEGY] strategy load failed', error );
        this.loadMarketingOperatorStatus();
        this.refreshStrategy();
      }
    } );
  }

  private saveMarketingStrategy (): void {
    if ( !this.hasAuthenticatedRequestContext ) return;
    const strategy = this.buildStrategyPayload();
    this.outreachApi.saveMarketingOperatorStrategy( { strategy }, this.buildRequestContext() ).subscribe( {
      next: response => {
        this.marketingStrategyState = response?.data || strategy;
        this.logger.info( '[SOCIAL_STRATEGY] strategy saved', { strategy: this.marketingStrategyState } );
        this.loadMarketingOperatorStatus();
        this.refreshStrategy();
      },
      error: error => {
        this.logger.warn( '[SOCIAL_STRATEGY] strategy save failed', error );
      }
    } );
  }

  private generateMarketingStrategy (): void {
    if ( !this.hasAuthenticatedRequestContext || this.strategyBusy ) return;
    this.strategyBusy = true;
    this.outreachApi.generateMarketingOperatorStrategy( {
      strategy: this.buildStrategyPayload()
    }, this.buildRequestContext() ).subscribe( {
      next: response => {
        this.strategyBusy = false;
        this.marketingStrategyState = response?.data || this.marketingStrategyState;
        this.logger.info( '[SOCIAL_STRATEGY] strategy generated', { strategy: this.marketingStrategyState } );
        this.refreshStrategy();
        this.fetchNextMarketingAction();
        this.loadMarketingOperatorStatus();
      },
      error: error => {
        this.strategyBusy = false;
        this.logger.warn( '[SOCIAL_STRATEGY] strategy generation failed; using fallback', error );
        this.refreshStrategy();
      }
    } );
  }

  private fetchNextMarketingAction (): void {
    if ( !this.hasAuthenticatedRequestContext ) return;
    this.outreachApi.getNextMarketingAction( this.buildRequestContext() ).subscribe( {
      next: response => {
        this.logger.info( '[SOCIAL_STRATEGY] next marketing action returned', response?.data );
        this.operatorNextBestAction = response?.data?.nextMarketingAction || this.operatorNextBestAction;
      },
      error: error => {
        this.logger.warn( '[SOCIAL_STRATEGY] next marketing action failed', error );
      }
    } );
  }

  private loadMarketingOperatorStatus (): void {
    if ( !this.hasAuthenticatedRequestContext ) return;
    this.outreachApi.getMarketingOperatorStatus( this.buildRequestContext() ).subscribe( {
      next: response => {
        const data = response?.data;
        this.logger.info( '[SOCIAL_STRATEGY] operator status loaded', data );
        this.todayOperatorStatus = data?.todayOperatorStatus || 'idle';
        this.operatorNextBestAction = data?.nextBestAction || this.operatorNextBestAction;
        this.operatorPendingApprovalsCount = Number( data?.pendingApprovalsCount || 0 );
        this.operatorBlockedNeedsCount = Number( data?.blockedNeedsCount || 0 );
        this.lastEndOfDaySummary = data?.lastEndOfDaySummary || '';
      },
      error: error => {
        this.logger.warn( '[SOCIAL_STRATEGY] operator status load failed', error );
      }
    } );
  }

  private buildStrategyPayload (): SocialDraftStrategyContext {
    const current = this.strategyRecommendation;
    return {
      ...( this.marketingStrategyState || {} ),
      goal: this.strategyGoal,
      activeMarketingGoal: this.marketingStrategyState?.activeMarketingGoal || this.strategyGoal,
      platformFocus: this.strategyPlatformFocus,
      socialChannelFocus: this.marketingStrategyState?.socialChannelFocus || this.strategyPlatformFocus,
      cadence: this.strategyCadence,
      socialCadence: this.marketingStrategyState?.socialCadence || this.strategyCadence,
      recommendedNextPostType: current?.recommendedNextPostType || this.marketingStrategyState?.recommendedNextPostType || '',
      nextBestSocialAction: current?.nextBestSocialAction || current?.recommendedNextPostType || '',
      recommendedTiming: current?.recommendedTiming || this.marketingStrategyState?.recommendedTiming || '',
      strategySummary: current?.strategySummary || this.marketingStrategyState?.strategySummary || '',
      reason: current?.reason || this.marketingStrategyState?.reason || '',
      alternateAngles: current?.alternateAngles || this.marketingStrategyState?.alternateAngles || [],
      watchout: current?.watchout || this.marketingStrategyState?.watchout || '',
      riskOrWatchout: current?.riskOrWatchout || current?.watchout || '',
      preferredChannels: this.marketingStrategyState?.preferredChannels || ( current?.resolvedPlatformFocus === 'balanced' ? ['linkedin', 'threads'] : [current?.resolvedPlatformFocus || this.strategyPlatformFocus] ),
      targetAudience: this.marketingStrategyState?.targetAudience || '',
      primaryOffer: this.marketingStrategyState?.primaryOffer || '',
      painBeingAddressed: this.marketingStrategyState?.painBeingAddressed || '',
      proofPoints: this.marketingStrategyState?.proofPoints || [],
      currentCampaignTheme: this.marketingStrategyState?.currentCampaignTheme || '',
      winningAngles: this.marketingStrategyState?.winningAngles || current?.winningAngles || [],
      weakAngles: this.marketingStrategyState?.weakAngles || current?.weakAngles || [],
      lastSignalSummary: this.marketingStrategyState?.lastSignalSummary || current?.lastSignalSummary || '',
      recommendedAdjustment: this.marketingStrategyState?.recommendedAdjustment || current?.recommendedAdjustment || '',
      nextBestAction: this.marketingStrategyState?.nextBestAction || current?.nextBestAction || '',
      identityEngine: this.marketingStrategyState?.identityEngine || this.identityState?.identity?.identitySummary || ''
    };
  }

  private applyPersistedStrategyControls ( strategy: SocialDraftStrategyContext ): void {
    this.strategyGoal = ( strategy.goal || strategy.activeMarketingGoal || this.strategyGoal ) as SocialStrategyGoal;
    this.strategyPlatformFocus = ( strategy.platformFocus || strategy.socialChannelFocus || this.strategyPlatformFocus ) as SocialStrategyPlatformFocus;
    this.strategyCadence = ( strategy.cadence || strategy.socialCadence || this.strategyCadence ) as SocialStrategyCadence;
    this.applyStrategyPlatformSelection();
  }

  private mergeStrategyRecommendation (
    baseRecommendation: SocialStrategyRecommendation,
    persistedStrategy: SocialDraftStrategyContext | null
  ): SocialStrategyRecommendation {
    if ( !persistedStrategy ) return baseRecommendation;

    return {
      ...baseRecommendation,
      ...persistedStrategy,
      goal: ( persistedStrategy.goal || persistedStrategy.activeMarketingGoal || baseRecommendation.goal ) as SocialStrategyGoal,
      activeMarketingGoal: persistedStrategy.activeMarketingGoal || persistedStrategy.goal || baseRecommendation.activeMarketingGoal,
      platformFocus: ( persistedStrategy.platformFocus || persistedStrategy.socialChannelFocus || baseRecommendation.platformFocus ) as SocialStrategyPlatformFocus,
      socialChannelFocus: persistedStrategy.socialChannelFocus || persistedStrategy.platformFocus || baseRecommendation.socialChannelFocus,
      cadence: ( persistedStrategy.cadence || persistedStrategy.socialCadence || baseRecommendation.cadence ) as SocialStrategyCadence,
      socialCadence: persistedStrategy.socialCadence || persistedStrategy.cadence || baseRecommendation.socialCadence,
      recommendedNextPostType: persistedStrategy.recommendedNextPostType || persistedStrategy.nextBestSocialAction || baseRecommendation.recommendedNextPostType,
      nextBestSocialAction: persistedStrategy.nextBestSocialAction || persistedStrategy.recommendedNextPostType || baseRecommendation.nextBestSocialAction,
      watchout: persistedStrategy.watchout || persistedStrategy.riskOrWatchout || baseRecommendation.watchout,
      riskOrWatchout: persistedStrategy.riskOrWatchout || persistedStrategy.watchout || baseRecommendation.riskOrWatchout,
      alternateAngles: persistedStrategy.alternateAngles?.length ? persistedStrategy.alternateAngles : baseRecommendation.alternateAngles,
      preferredChannels: persistedStrategy.preferredChannels?.length ? persistedStrategy.preferredChannels : baseRecommendation.preferredChannels,
      targetAudience: persistedStrategy.targetAudience || baseRecommendation.targetAudience,
      primaryOffer: persistedStrategy.primaryOffer || baseRecommendation.primaryOffer,
      painBeingAddressed: persistedStrategy.painBeingAddressed || baseRecommendation.painBeingAddressed,
      proofPoints: persistedStrategy.proofPoints?.length ? persistedStrategy.proofPoints : baseRecommendation.proofPoints,
      currentCampaignTheme: persistedStrategy.currentCampaignTheme || baseRecommendation.currentCampaignTheme,
      winningAngles: persistedStrategy.winningAngles?.length ? persistedStrategy.winningAngles : baseRecommendation.winningAngles,
      weakAngles: persistedStrategy.weakAngles?.length ? persistedStrategy.weakAngles : baseRecommendation.weakAngles,
      lastSignalSummary: persistedStrategy.lastSignalSummary || baseRecommendation.lastSignalSummary,
      recommendedAdjustment: persistedStrategy.recommendedAdjustment || baseRecommendation.recommendedAdjustment,
      nextBestAction: persistedStrategy.nextBestAction || baseRecommendation.nextBestAction,
      identityEngine: persistedStrategy.identityEngine || baseRecommendation.identityEngine,
      recommendedTiming: baseRecommendation.recommendedTiming,
    };
  }

  private workflowStatusForPost ( post: SocialPost | null | undefined ): 'draft' | 'approved' | 'published' | 'rejected' | 'archived' | '' {
    const status = String( post?.status || '' ).trim().toLowerCase();
    if ( status === 'draft' || status === 'approved' || status === 'published' || status === 'rejected' || status === 'archived' ) {
      return status;
    }
    return '';
  }

  private buildRequestContext (): { tenantId?: string; userId?: string; userEmail?: string; } {
    return {
      tenantId: this.tenantId || undefined,
      userId: this.userId || undefined,
      userEmail: this.userEmail || undefined
    };
  }

  formatOperatorStatus ( status: string ): string {
    const normalized = String( status || '' ).trim().toLowerCase();
    if ( !normalized ) return 'Idle';
    return normalized
      .split( /[_\s]+/ )
      .filter( Boolean )
      .map( part => part.charAt( 0 ).toUpperCase() + part.slice( 1 ) )
      .join( ' ' );
  }
}

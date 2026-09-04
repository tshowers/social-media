import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

import { environment } from '../../environments/environment';
import { LoggerService } from './logger.service';
import { ToddWritingIdentityReview } from '../models/todd-writing-identity.model';
import { CockpitActivityItem } from './social-activity.service';

/**
 * Trimmed stand-in for TODD's OutreachApiService
 * (frontend/src/app/services/outreach-api.service.ts, ~2000 lines) - that
 * service is a shared god-service also used by Email/Contact/Help/Marketing
 * features elsewhere in the monorepo (~20 other consumers), so it is not
 * ported whole. This file carries only the request methods (and their
 * response/payload types) that Social's 5 live routes actually call -
 * social-outreach.component.ts, social-outreach-accounts.component.ts,
 * social-outreach-queue.component.ts, social-outreach-strategy.component.ts,
 * social-outreach-calendar.component.ts, and the service wrappers those
 * components use (SocialAccountService, SocialQueueService). Everything
 * else on the original (campaigns, mailboxes, momentum threads, drafting/
 * generation/refine endpoints only ever called from the two dead
 * components - social-outreach-source.component.ts and
 * social-outreach-signals.component.ts, neither wired to a live route) is
 * intentionally left out.
 *
 * Method bodies, endpoint paths, and header-building are copied verbatim
 * from the original so behavior against the shared todd-backend API is
 * unchanged - only the method list and the type surface are trimmed.
 */

export interface SocialPostSourceReference {
  sourceType: string;
  sourceId: string;
  title?: string;
}

export type SocialStrategyGoal =
  'grow_awareness' |
  'grow_followers' |
  'drive_engagement' |
  'build_authority' |
  'drive_traffic' |
  'generate_leads';

export type SocialStrategyPlatformFocus = 'auto' | 'linkedin' | 'threads' | 'bluesky' | 'reddit' | 'youtube' | 'google_business_profile' | 'balanced';
export type SocialStrategyCadence = '5x_day' | '4x_day' | '3x_day' | '2x_day' | 'daily' | '5x_week' | '3x_week' | '2x_week' | 'weekly';
export type SocialDraftRefinementActionType = 'rewrite' | 'reject' | 'shorten' | 'conversational' | 'stronger';
export type SocialContentLane = 'proof' | 'lesson' | 'contrarian' | 'story' | 'offer';

export interface SocialDraftStrategyContext {
  goal: SocialStrategyGoal;
  platformFocus: SocialStrategyPlatformFocus;
  cadence: SocialStrategyCadence;
  activeMarketingGoal?: string;
  socialChannelFocus?: string;
  socialCadence?: string;
  nextBestSocialAction?: string;
  riskOrWatchout?: string;
  targetAudience?: string;
  primaryOffer?: string;
  painBeingAddressed?: string;
  proofPoints?: string[];
  preferredChannels?: string[];
  currentCampaignTheme?: string;
  winningAngles?: string[];
  weakAngles?: string[];
  lastSignalSummary?: string;
  recommendedAdjustment?: string;
  nextBestAction?: string;
  identityEngine?: string;
  selectedPlatform?: string;
  platformIdentityLabel?: string;
  platformIdentityTraits?: string[];
  contentLane?: SocialContentLane;
  blockedContentLanes?: SocialContentLane[];
  sourceSelectionReason?: string;
  generationSequence?: string[];
  differentiationBrief?: string[];
  regenerationReason?: string;
  separatePlatformDrafting?: boolean;
  recommendedNextPostType?: string;
  selectedContentCategory?: string;
  growthPillar?: string;
  growthPillarLabel?: string;
  growthObjective?: string;
  growthReason?: string;
  recommendedTiming?: string;
  suggestedSource?: string;
  followUpAngle?: string;
  commentHook?: string;
  replyTone?: string;
  distributionIntent?: string;
  continuityAnchor?: string;
  continuityStep?: string;
  continuityBrief?: string;
  audienceWarmupStatus?: string;
  audienceWarmupReason?: string;
  sequenceObjective?: string;
  sequenceSteps?: string[];
  reason?: string;
  strategySummary?: string;
  alternateAngles?: string[];
  watchout?: string;
  requiredShift?: string;
  mustAvoid?: string[];
  hardContentRules?: string[];
  suggestionMode?: string;
  todayPostRequest?: string;
  outputGuardrails?: string[];
}

export interface SocialIdentityContext {
  identitySummary: string;
  whoTheyAre: string;
  whatTheyDo: string;
  howTheyMakeMoney: string;
  likelyAudience: string;
  primaryContentLane: string;
  secondaryThemes?: string[];
  voiceProfile?: { style: string; tone: string; guidance: string[]; };
  confidence?: 'low' | 'medium' | 'high';
  profileCompleteEnough?: boolean;
  warningMessage?: string;
  inferredFrom?: string[];
}

export type SocialOfferTacticExecutionTarget = 'email' | 'social' | 'landing' | string;
export type SocialOfferTacticPositioningType = 'urgency' | 'bonus' | 'fast_track' | 'diagnostic';
export type SocialOfferVariationMode = 'pure_insight' | 'soft_sell' | 'direct_cta' | 'recovery_fast_close';

export interface SocialOfferSummary {
  offerId: string;
  name: string;
  category: string;
  priceLabel: string;
  valueSummary: string;
  cta: string;
  audience: string[];
  painsSolved: string[];
  salesCycle: string;
  fastestClose: boolean;
  deliveryEffort: string;
}

export interface SocialOfferTacticContext {
  tacticId: string;
  label: string;
  executionTarget: SocialOfferTacticExecutionTarget;
  positioningType: SocialOfferTacticPositioningType;
  reasoning?: string;
  triggerConditions?: string[];
}

export interface SocialOfferContext {
  primaryOffers: SocialOfferSummary[];
  entryOffer?: SocialOfferSummary | null;
  highTicketOffer?: SocialOfferSummary | null;
  fastestCloseOffer?: SocialOfferSummary | null;
  shortCycleOffer?: SocialOfferSummary | null;
  recommendedOffer?: SocialOfferSummary | null;
  currentGoal?: SocialStrategyGoal | string;
  selectedMode?: SocialOfferVariationMode;
  availableModes?: SocialOfferVariationMode[];
  behaviorRules?: string[];
  tacticContext?: SocialOfferTacticContext | null;
  recoverySignals?: {
    recoveryModeActive?: boolean;
    revenueZero?: boolean;
    repliesWeak?: boolean;
    urgencyJustified?: boolean;
  } | null;
}

export interface SocialMediaAttachment {
  url: string;
  type: 'image' | 'video' | string;
  mimeType?: string;
  title?: string;
  altText?: string;
}

export interface SocialSourceSnapshot {
  title?: string;
  type?: string;
  category?: string;
  topic?: string;
  author?: string;
  summary?: string;
  content?: string;
  url?: string;
  publishedAt?: string | null;
  feedUrl?: string;
  answers?: any[];
  recommendations?: any[];
  resources?: any[];
  keywords?: string[];
  mediaAttachment?: SocialMediaAttachment | null;
}

export interface SocialEngagementSignal {
  likes: number;
  comments: number;
  clicks: number;
  engagedPeople: string[];
  notes?: string;
  lastCapturedAt?: string | null;
}

export interface SocialFollowUpSuggestion {
  summary: string;
  rationale: string;
  recommendedAction: string;
  suggestedContacts: string[];
  suggestedTaskTitle?: string;
  suggestedMessage?: string;
  draftedComment?: string;
  draftedReply?: string;
  suggestedNextStep?: string;
  status?: string;
  suggestedAt?: string | null;
}

export interface SocialAccount {
  accountId: string;
  provider: string;
  authProvider?: string;
  destinationType?: string;
  destinationLabel?: string;
  selectedIdentity?: string;
  providerId?: string;
  providerUserId: string;
  username?: string;
  displayName?: string;
  email?: string;
  profileUrl?: string;
  avatarUrl?: string;
  connectedAt?: string | null;
  updatedAt?: string | null;
  status?: string;
  capabilities?: string[];
  youtubeEnabled?: boolean;
  scopes?: string[];
  destinationAccountName?: string;
  destinationLocationName?: string;
  destinationLocationId?: string;
  locationName?: string;
  locationId?: string;
  locationDiscoveryError?: string;
  tokenStatus?: {
    hasAccessToken: boolean;
    hasRefreshToken: boolean;
    expiresAt?: string | null;
    refreshExpiresAt?: string | null;
    needsReauth?: boolean;
  };
}

export interface SocialAccountListResponse {
  success: boolean;
  message: string;
  data: SocialAccount[];
  providerAvailability?: Record<string, {
    configured: boolean;
    message?: string;
  }>;
}

export interface SocialProviderHealth {
  configured: boolean;
  missing: string[];
  redirectUri?: string;
  permissionsRequired: string[];
  implemented?: boolean;
  reason?: string;
  requiresProfessionalAccount?: boolean;
  requiresLinkedFacebookPage?: boolean;
  nextSteps?: string[];
}

export interface SocialProviderConfigHealthResponse {
  success: boolean;
  message: string;
  data: Record<string, SocialProviderHealth>;
}

export interface SocialAccountConnectionTestResponse {
  success: boolean;
  message: string;
  data: {
    accountId?: string;
    provider: string;
    authProvider?: string;
    configured: boolean;
    connected: boolean;
    reason?: string;
    message?: string;
    accountIdentity?: {
      accountId?: string;
      providerUserId?: string;
      username?: string;
      displayName?: string;
      email?: string;
      profileUrl?: string;
    };
    tokenStatus?: {
      hasAccessToken: boolean;
      hasRefreshToken: boolean;
      expiresAt?: string | null;
      needsReauth?: boolean;
    };
    missingPermissions?: string[];
    nextSteps?: string[];
    providerStatus?: string;
    permanent?: boolean;
    displayIdentity?: {
      accountId?: string;
      providerUserId?: string;
      username?: string;
      displayName?: string;
      email?: string;
      profileUrl?: string;
    };
    healthState?: 'healthy' | 'needs_reauth' | 'missing_permissions' | 'disconnected' | 'failed' | 'unknown' | string;
    healthSeverity?: 'healthy' | 'warning' | 'error' | string;
    testedAt?: string;
  };
}

export interface SocialAccountHealthRow extends NonNullable<SocialAccountConnectionTestResponse['data']> { }

export interface BlueskyNichePost {
  uri: string;
  cid: string;
  authorHandle: string;
  authorDisplayName: string;
  authorAvatar: string;
  text: string;
  likeCount: number;
  replyCount: number;
  repostCount: number;
  indexedAt: string;
  postUrl: string;
}

export interface SocialAccountHealthSummary {
  totalAccounts: number;
  healthyCount: number;
  warningCount: number;
  errorCount: number;
  unknownCount: number;
  problemCount: number;
  topBlockers: Array<{
    accountId: string;
    provider: string;
    authProvider?: string;
    reason?: string;
    message?: string;
    providerStatus?: string;
    healthState?: string;
    healthSeverity?: string;
    displayIdentity?: {
      accountId?: string;
      providerUserId?: string;
      username?: string;
      displayName?: string;
      email?: string;
      profileUrl?: string;
    };
  }>;
}

export interface SocialAccountHealthResponse {
  success: boolean;
  message: string;
  data: {
    accounts: SocialAccountHealthRow[];
    summary: SocialAccountHealthSummary;
  };
}

export interface SocialAuthSessionResponse {
  success: boolean;
  message: string;
  data: {
    provider: string;
    authorizationUrl: string;
    redirectUri: string;
    scope: string;
    state: string;
    account?: SocialAccount;
  };
}

export interface ContentEvaluationDimension {
  score: number;
  label: 'strong' | 'workable' | 'weak' | string;
  summary: string;
}

export interface ContentEvaluation {
  channel: string;
  verdict: 'strong' | 'workable' | 'weak' | string;
  approved: boolean;
  overallScore: number;
  strengths: string[];
  improvements: string[];
  dimensions: Record<string, ContentEvaluationDimension>;
  draft?: { subject?: string; body?: string; content?: string; };
  improvedDraft?: { subject?: string; body?: string; content?: string; };
  summary?: string;
  evaluatedAt?: string;
  routing?: { autoQueue: boolean; needsRevision: boolean; reason: string; };
}

export interface SocialPost {
  postId: string;
  actionId?: string | null;
  planId?: string | null;
  strategyId?: string | null;
  segmentId?: string | null;
  angleId?: string | null;
  sourceContentReference: SocialPostSourceReference;
  platform: 'linkedin' | 'threads' | 'bluesky' | 'reddit' | string;
  provider?: string;
  contentEvaluation?: ContentEvaluation;
  socialAccountId?: string;
  subreddit?: string;
  content: string;
  status: string;
  strategyContext?: SocialDraftStrategyContext | null;
  followThroughPlan?: {
    followUpAngle?: string;
    commentHook?: string;
    replyTone?: string;
    distributionIntent?: string;
  } | null;
  identityContext?: SocialIdentityContext | null;
  offerContext?: SocialOfferContext | null;
  identityReview?: ToddWritingIdentityReview | null;
  draftQuality?: 'strong' | 'workable' | 'generic' | 'off-brand' | 'needs-context' | 'weak' | string;
  socialQualityDiagnostics?: {
    verdict?: 'strong' | 'usable' | 'generic' | 'off-brand' | 'needs-context' | string;
    overallScore?: number;
    publishReady?: boolean;
    contextThin?: boolean;
    summary?: string;
    strengths?: string[];
    improvements?: string[];
    dimensions?: Record<string, { score?: number; summary?: string; }>;
    riskFlags?: {
      blandnessRisk?: boolean;
      genericSaaSRisk?: boolean;
      offBrandRisk?: boolean;
    };
  } | null;
  growthState?: {
    status?: string;
    diagnosis?: string;
    owner?: string;
    reason?: string;
    nextCheckAt?: string | null;
    updatedAt?: string | null;
  } | null;
  requiredActions?: Array<{
    actionId?: string;
    type?: string;
    title?: string;
    instruction?: string;
    reason?: string;
    dueAt?: string | null;
    owner?: string;
    status?: string;
    payload?: { platform?: string; requestedMetrics?: string[]; [key: string]: any; };
  }> | null;
  postPerformance?: {
    views?: number;
    reach?: number;
    impressions?: number;
    shares?: number;
    saves?: number;
    profileVisits?: number;
    accountsReached?: number;
    nonFollowerReach?: number;
    followerDelta?: number;
    engagementRate?: number;
    capturedAt?: string | null;
    captureSource?: string;
  } | null;
  approvedAt?: string | null;
  scheduledFor?: string | null;
  plannedForDate?: string | null;
  engagementSignal?: SocialEngagementSignal;
  followUpSuggestion?: SocialFollowUpSuggestion;
  mediaAttachment?: SocialMediaAttachment | null;
  queueWaitReason?: string | null;
  queueWaitReasonLabel?: string | null;
  lastQueueEvaluatedAt?: string | null;
  manualReviewRequired?: boolean;
  returnedToDraftAt?: string | null;
  publishedTimestamp?: string | null;
  externalPlatformPostId?: string | null;
  externalPlatformPostUrl?: string | null;
  retryAttemptCount?: number;
  maxRetryAttempts?: number;
  nextRetryAt?: string | null;
  lastPublishAttemptAt?: string | null;
  publishFailure?: {
    platform?: string;
    error?: string;
    message?: string;
    accountId?: string;
    attemptCount?: number;
    timestamp?: string;
    permanent?: boolean;
  } | null;
  redditSafety?: {
    recentCommentCount?: number;
    requiresCommentFirst?: boolean;
    checkedAt?: string | null;
  } | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface SocialPostListResponse {
  success: boolean;
  message: string;
  data: SocialPost[];
}

export interface SocialPostResponse {
  success: boolean;
  message: string;
  data: SocialPost;
}

export interface SocialPostDeleteResponse {
  success: boolean;
  message: string;
  data: {
    postId: string;
    deletedPostIds?: string[];
    deleted: boolean;
  };
}

export interface MomentumApprovalPolicyCategorySetting {
  mode?: 'auto' | 'approval-first' | 'manual' | string;
  label?: string;
}

export interface MomentumApprovalPolicy {
  tenantId?: string;
  scope?: string;
  categories?: Record<string, MomentumApprovalPolicyCategorySetting>;
}

export interface MomentumApprovalPolicyResponse {
  success: boolean;
  message: string;
  data: {
    tenantId: string;
    approvalPolicy: MomentumApprovalPolicy | null;
  };
}

export interface MarketingOperatorStrategyResponse {
  success: boolean;
  message: string;
  data: SocialDraftStrategyContext | null;
}

export interface NextMarketingActionResponse {
  success: boolean;
  message: string;
  data: {
    nextMarketingAction: string;
    strategy: SocialDraftStrategyContext | null;
  };
}

export interface MarketingOperatorStatusResponse {
  success: boolean;
  message: string;
  data: {
    date: string;
    todayOperatorStatus: string;
    nextBestAction: string;
    pendingApprovalsCount: number;
    blockedNeedsCount: number;
    lastEndOfDaySummary: string;
    activeStrategyLoaded: boolean;
  };
}

export interface SocialBootstrapIdentitySummary {
  profileCompleteEnough?: boolean;
  warningMessage?: string;
  primaryContentLane?: string;
  likelyAudience?: string;
  confidence?: string;
}

export interface SocialBootstrapCadenceSummary {
  approvedCount?: number;
  approvedScheduledCount?: number;
  publishedThisWeekCount?: number;
  draftCount?: number;
  pendingRetryCount?: number;
  queueCoverageCount?: number;
  latestApprovedScheduledFor?: string | null;
}

export interface SocialBootstrapPayload {
  posts: SocialPost[];
  accounts: SocialAccount[];
  providerAvailability: Record<string, { configured: boolean; message?: string; }>;
  identityStateSummary: SocialBootstrapIdentitySummary | null;
  addonAccess: boolean;
  rssConfig: {
    enabled?: boolean;
    feedUrls?: string[];
  };
  strategySummary: SocialDraftStrategyContext | null;
  cadenceSummary: SocialBootstrapCadenceSummary | null;
  activity: CockpitActivityItem[];
  generatedAt: string;
}

export interface SocialBootstrapResponse {
  success: boolean;
  message: string;
  data: SocialBootstrapPayload;
}

@Injectable( { providedIn: 'root' } )
export class SocialApiService {
  private baseUrl = `${environment.backendURL}`;
  constructor ( private http: HttpClient, private logger: LoggerService ) { }

  private buildHeaders ( tenantId?: string, userId?: string, userEmail?: string ): HttpHeaders {
    let h = new HttpHeaders();
    if ( tenantId ) h = h.set( 'x-tenant-id', tenantId );
    if ( userId ) h = h.set( 'x-user-id', userId );
    if ( userEmail ) h = h.set( 'x-user-email', userEmail );
    return h;
  }

  getSocialBootstrap ( opts: {
    tenantId?: string;
    userId?: string;
    userEmail?: string;
    sourceType?: string;
    sourceId?: string;
    postIds?: string[];
    statuses?: string[];
    limit?: number;
    activityLimit?: number;
    debugSlim?: boolean;
  } = {} ): Observable<SocialBootstrapResponse> {
    const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
    let params = new HttpParams();
    if ( opts.sourceType ) params = params.set( 'sourceType', opts.sourceType );
    if ( opts.sourceId ) params = params.set( 'sourceId', opts.sourceId );
    if ( opts.postIds?.length ) params = params.set( 'postIds', opts.postIds.join( ',' ) );
    if ( opts.statuses?.length ) params = params.set( 'statuses', opts.statuses.join( ',' ) );
    if ( opts.limit ) params = params.set( 'limit', String( opts.limit ) );
    if ( opts.activityLimit ) params = params.set( 'activityLimit', String( opts.activityLimit ) );
    if ( opts.debugSlim ) params = params.set( 'debugSlim', 'true' );

    return this.http.get<SocialBootstrapResponse>( `${this.baseUrl}/outreach/social/bootstrap`, { headers, params } ).pipe(
      tap( {
        error: error => {
          this.logger.error( '[SocialApiService] getSocialBootstrap:error', {
            status: error?.status || 0,
            message: error?.message || error?.error?.message || '',
            error
          } );
        }
      } )
    );
  }

  getMomentumApprovalPolicy ( opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<MomentumApprovalPolicyResponse> {
    const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
    let params = new HttpParams();
    if ( opts.tenantId ) params = params.set( 'tenantId', opts.tenantId );
    return this.http.get<MomentumApprovalPolicyResponse>( `${this.baseUrl}/momentum/approval-policy`, { headers, params } );
  }

  listSocialPosts (
    query: {
      sourceType?: string;
      sourceId?: string;
      status?: string;
      statuses?: string[];
      postIds?: string[];
      limit?: number;
    } = {},
    opts: { tenantId?: string; userId?: string; userEmail?: string; } = {}
  ): Observable<SocialPostListResponse> {
    const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
    let params = new HttpParams();
    if ( query.sourceType ) params = params.set( 'sourceType', query.sourceType );
    if ( query.sourceId ) params = params.set( 'sourceId', query.sourceId );
    if ( query.status ) params = params.set( 'status', query.status );
    if ( query.statuses?.length ) params = params.set( 'statuses', query.statuses.join( ',' ) );
    if ( query.postIds?.length ) params = params.set( 'postIds', query.postIds.join( ',' ) );
    if ( query.limit ) params = params.set( 'limit', String( query.limit ) );
    return this.http.get<SocialPostListResponse>( `${this.baseUrl}/outreach/social-posts`, { headers, params } );
  }

  getSocialProviderConfigHealth (): Observable<SocialProviderConfigHealthResponse> {
    return this.http.get<SocialProviderConfigHealthResponse>( `${this.baseUrl}/outreach/social-auth/config/health` );
  }

  testSocialAccountConnection ( accountId: string, opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<SocialAccountConnectionTestResponse> {
    const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
    return this.http.post<SocialAccountConnectionTestResponse>( `${this.baseUrl}/outreach/social-auth/accounts/${encodeURIComponent( accountId )}/test`, {}, { headers } );
  }

  testConnectedSocialAccounts ( opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<SocialAccountHealthResponse> {
    const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
    return this.http.post<SocialAccountHealthResponse>( `${this.baseUrl}/outreach/social-auth/accounts/health`, {}, { headers } );
  }

  listSocialAccounts ( opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<SocialAccountListResponse> {
    const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
    return this.http.get<SocialAccountListResponse>( `${this.baseUrl}/outreach/social-accounts`, { headers } );
  }

  disconnectSocialAccount ( accountId: string, opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<{ success: boolean; message: string; data: SocialAccount; }> {
    const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
    return this.http.delete<{ success: boolean; message: string; data: SocialAccount; }>( `${this.baseUrl}/outreach/social-accounts/${encodeURIComponent( accountId )}`, { headers } );
  }

  startSocialAuth ( provider: string, payload: { frontendReturnUrl?: string; handle?: string; appPassword?: string; youtubeEnabled?: boolean; destination?: string; destinationType?: string; } = {}, opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<SocialAuthSessionResponse> {
    const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
    return this.http.post<SocialAuthSessionResponse>( `${this.baseUrl}/outreach/social-auth/${encodeURIComponent( provider )}/start`, payload, { headers } );
  }

  updateSocialPost ( postId: string, payload: { sourceContentReference: SocialPostSourceReference; platform: string; content: string; status?: string; publishedTimestamp?: string | null; externalPlatformPostId?: string | null; socialAccountId?: string; subreddit?: string; engagementSignal?: SocialEngagementSignal; followUpSuggestion?: SocialFollowUpSuggestion; mediaAttachment?: SocialMediaAttachment | null; strategyContext?: SocialDraftStrategyContext | null; identityContext?: SocialIdentityContext | null; offerContext?: SocialOfferContext | null; identityReview?: ToddWritingIdentityReview | null; approvedAt?: string | null; scheduledFor?: string | null; redditSafety?: { recentCommentCount?: number; requiresCommentFirst?: boolean; checkedAt?: string | null; } | null; actionId?: string | null; planId?: string | null; strategyId?: string | null; segmentId?: string | null; angleId?: string | null; }, opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<SocialPostResponse> {
    const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
    return this.http.put<SocialPostResponse>( `${this.baseUrl}/outreach/social-posts/${encodeURIComponent( postId )}`, payload, { headers } );
  }

  deleteSocialPost ( postId: string, opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<SocialPostDeleteResponse> {
    const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
    return this.http.delete<SocialPostDeleteResponse>( `${this.baseUrl}/outreach/social-posts/${encodeURIComponent( postId )}`, { headers } );
  }

  publishSocialPost ( postId: string, payload: { socialAccountId?: string; subreddit?: string; } = {}, opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<SocialPostResponse> {
    const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
    return this.http.post<SocialPostResponse>( `${this.baseUrl}/outreach/social-posts/${encodeURIComponent( postId )}/publish`, payload, { headers } );
  }

  getBlueskyNichePosts ( keywords: string, opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<{ success: boolean; data: BlueskyNichePost[]; message?: string; }> {
    const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
    return this.http.get<{ success: boolean; data: BlueskyNichePost[]; message?: string; }>( `${this.baseUrl}/outreach/social/bluesky/niche-posts?keywords=${encodeURIComponent( keywords )}&limit=5`, { headers } );
  }

  getMarketingOperatorStrategy ( opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<MarketingOperatorStrategyResponse> {
    const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
    return this.http.get<MarketingOperatorStrategyResponse>( `${this.baseUrl}/outreach/social-strategy`, { headers } );
  }

  saveMarketingOperatorStrategy ( payload: { strategy: SocialDraftStrategyContext; }, opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<MarketingOperatorStrategyResponse> {
    const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
    return this.http.put<MarketingOperatorStrategyResponse>( `${this.baseUrl}/outreach/social-strategy`, payload, { headers } );
  }

  generateMarketingOperatorStrategy (
    payload: { strategy?: SocialDraftStrategyContext | null; } = {},
    opts: { tenantId?: string; userId?: string; userEmail?: string; } = {}
  ): Observable<MarketingOperatorStrategyResponse> {
    const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
    return this.http.post<MarketingOperatorStrategyResponse>( `${this.baseUrl}/outreach/social-strategy/generate`, payload, { headers } );
  }

  getNextMarketingAction ( opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<NextMarketingActionResponse> {
    const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
    return this.http.get<NextMarketingActionResponse>( `${this.baseUrl}/outreach/social-strategy/next-action`, { headers } );
  }

  getMarketingOperatorStatus ( opts: { tenantId?: string; userId?: string; userEmail?: string; } = {} ): Observable<MarketingOperatorStatusResponse> {
    const headers = this.buildHeaders( opts.tenantId, opts.userId, opts.userEmail );
    return this.http.get<MarketingOperatorStatusResponse>( `${this.baseUrl}/outreach/social-strategy/operator-status`, { headers } );
  }
}

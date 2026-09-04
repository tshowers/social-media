import { Injectable } from '@angular/core';
import {
  SocialAccount,
  SocialContentLane,
  SocialDraftStrategyContext,
  SocialPost,
  SocialSourceSnapshot,
  SocialStrategyCadence,
  SocialStrategyGoal,
  SocialStrategyPlatformFocus
} from '../../../services/social-api.service';

export interface SocialStrategyRecommendation extends SocialDraftStrategyContext {
  resolvedPlatformFocus: Exclude<SocialStrategyPlatformFocus, 'auto'>;
  suggestedSource: string;
  suggestedSourceDetail: string;
  recentMixSummary: string;
  cadencePerAccount: boolean;
  connectedAccountCount: number;
  cadenceBaseTargetCount: number;
  cadenceTargetCount: number;
  publishedThisWeek: number;
  approvedQueueCount: number;
  draftCount: number;
  postsNeededNow: number;
  queueCoverageCount: number;
  accountCadenceSummaries: SocialAccountCadenceSummary[];
  watchout?: string;
  platformConcentrationWarning?: string;
}

export interface SocialAccountCadenceSummary {
  accountId: string;
  provider: string;
  label: string;
  cadenceTargetCount: number;
  publishedThisWeek: number;
  approvedQueueCount: number;
  queueCoverageCount: number;
  postsNeededNow: number;
}

export interface SocialStrategyInput {
  goal: SocialStrategyGoal;
  platformFocus: SocialStrategyPlatformFocus;
  cadence: SocialStrategyCadence;
  posts: SocialPost[];
  accounts: SocialAccount[];
  sourceSnapshot: SocialSourceSnapshot | null;
}

type DerivedPostType = 'promotional' | 'educational' | 'authority' | 'proof' | 'conversational';
type GrowthPillarKey = 'momentum_observation' | 'founder_lesson' | 'contrarian_opinion' | 'operational_truth' | 'personal_realization';

interface GrowthPillarDefinition {
  key: GrowthPillarKey;
  label: string;
  weekday: number;
  objective: string;
  reason: string;
  categories: string[];
}

const APPROVED_COUNT_KEY = 'todd_approved_queue_count';
const SHORT_FORM_GROWTH_PILLARS: GrowthPillarDefinition[] = [
  {
    key: 'momentum_observation',
    label: 'Momentum observation',
    weekday: 1,
    objective: 'Create recognition fast with a short operator observation people feel immediately.',
    reason: 'Short-form growth starts with recognizable friction, not explanation.',
    categories: ['founder_observation', 'business_operations_thought']
  },
  {
    key: 'founder_lesson',
    label: 'Founder lesson',
    weekday: 2,
    objective: 'Build trust through a lesson that sounds earned instead of taught from a distance.',
    reason: 'People follow operators who sound like they learned something the hard way.',
    categories: ['founder_observation', 'small_business_lesson']
  },
  {
    key: 'contrarian_opinion',
    label: 'Contrarian opinion',
    weekday: 3,
    objective: 'Earn replies with a credible opinion that pushes against stale advice.',
    reason: 'Threads and Bluesky grow faster when the post gives people something sharp to agree or disagree with.',
    categories: ['contrarian_take', 'hard_truth']
  },
  {
    key: 'operational_truth',
    label: 'Operational truth',
    weekday: 4,
    objective: 'Show operator credibility through one concrete process truth or workflow cost.',
    reason: 'Operational specificity makes short-form posts feel more real and more worth sharing.',
    categories: ['business_operations_thought', 'data_quality_warning']
  },
  {
    key: 'personal_realization',
    label: 'Personal realization',
    weekday: 5,
    objective: 'Make the account feel human with a realization, mistake, or perspective shift.',
    reason: 'Audience growth improves when the post feels personal enough to remember, not just useful enough to skim.',
    categories: ['founder_observation', 'building_in_public_update']
  }
];

@Injectable( { providedIn: 'root' } )
export class SocialStrategyService {
  private _authorativeApprovedCount: number | null = null;

  get authorativeApprovedCount (): number | null {
    if ( this._authorativeApprovedCount !== null ) return this._authorativeApprovedCount;
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem( APPROVED_COUNT_KEY ) : null;
    return stored !== null ? parseInt( stored, 10 ) : null;
  }

  set authorativeApprovedCount ( value: number | null ) {
    this._authorativeApprovedCount = value;
    if ( typeof localStorage !== 'undefined' ) {
      if ( value !== null ) {
        localStorage.setItem( APPROVED_COUNT_KEY, String( value ) );
      } else {
        localStorage.removeItem( APPROVED_COUNT_KEY );
      }
    }
  }

  buildRecommendation ( input: SocialStrategyInput ): SocialStrategyRecommendation {
    const posts = Array.isArray( input.posts ) ? input.posts.slice() : [];
    const publishedPosts = posts.filter( post => String( post.status || '' ).toLowerCase() === 'published' );
    const draftPosts = posts.filter( post => {
      const status = String( post.status || '' ).toLowerCase();
      return status !== 'published' && status !== 'approved';
    } );
    const recentPosts = publishedPosts.slice( 0, 5 );
    const cadenceBaseTargetCount = this.cadenceTargetCount( input.cadence );
    const connectedProviders = new Set(
      ( input.accounts || [] )
        .map( account => String( account.provider || '' ).trim().toLowerCase() )
        .filter( Boolean )
    );
    const resolvedPlatformFocus = this.resolvePlatformFocus( input.platformFocus, input.goal, connectedProviders );
    const accountCadenceSummaries = this.buildAccountCadenceSummaries( input.accounts, posts, cadenceBaseTargetCount );
    const publishedThisWeek = accountCadenceSummaries.reduce( ( total, summary ) => total + summary.publishedThisWeek, 0 );
    const cadenceTargetCount = accountCadenceSummaries.reduce( ( total, summary ) => total + summary.cadenceTargetCount, 0 );
    const approvedQueueCount = accountCadenceSummaries.reduce( ( total, summary ) => total + summary.approvedQueueCount, 0 );
    const queueCoverageCount = accountCadenceSummaries.reduce( ( total, summary ) => total + summary.queueCoverageCount, 0 );
    const postsNeededNow = accountCadenceSummaries.reduce( ( total, summary ) => total + summary.postsNeededNow, 0 );
    const recentTypes = recentPosts.map( post => this.classifyPostType( post.content ) );
    const repetitiveType = recentTypes.length >= 2 && recentTypes[0] === recentTypes[1] ? recentTypes[0] : null;
    const recentLanes = recentPosts.map( post => this.classifyContentLane( post.content ) );
    const blockedLane = recentLanes.length >= 2 && recentLanes[0] === recentLanes[1] ? recentLanes[0] : null;
    const goalDrivenType = this.getGoalDrivenPostType( input.goal, resolvedPlatformFocus );
    const recommendedNextPostType = repetitiveType === goalDrivenType
      ? this.getAlternatePostType( input.goal, resolvedPlatformFocus )
      : this.avoidRepetition( goalDrivenType, repetitiveType );
    const contentLane = this.pickContentLane( input.goal, resolvedPlatformFocus, blockedLane );
    const recentMixSummary = this.buildRecentMixSummary( recentPosts, recentTypes );
    const growthPillarPlan = this.resolveGrowthPillarPlan( resolvedPlatformFocus, recentPosts );
    const reason = this.buildReason( {
      goal: input.goal,
      platform: resolvedPlatformFocus,
      recentTypes,
      recommendedNextPostType
    } );
    const strategySummary = this.buildSummary( input.goal, resolvedPlatformFocus, input.cadence, recommendedNextPostType, recentMixSummary );
    const watchout = this.buildWatchout( repetitiveType, recentTypes );
    const suggestedSource = this.describeSuggestedSource( input.sourceSnapshot );
    const suggestedSourceDetail = this.describeSuggestedSourceDetail( input.sourceSnapshot, recommendedNextPostType );
    const platformConcentrationWarning = this.buildPlatformConcentrationWarning( connectedProviders );

    const effectiveRecommendedPostType = growthPillarPlan?.recommendedPostType || recommendedNextPostType;

    return {
      goal: input.goal,
      activeMarketingGoal: input.goal,
      platformFocus: input.platformFocus,
      preferredChannels: resolvedPlatformFocus === 'balanced' ? ['linkedin', 'threads'] : [resolvedPlatformFocus],
      socialChannelFocus: input.platformFocus,
      resolvedPlatformFocus,
      cadence: input.cadence,
      socialCadence: input.cadence,
      selectedPlatform: resolvedPlatformFocus,
      platformIdentityLabel: this.platformIdentityLabel( resolvedPlatformFocus ),
      platformIdentityTraits: this.platformIdentityTraits( resolvedPlatformFocus ),
      contentLane,
      blockedContentLanes: blockedLane ? [blockedLane] : [],
      selectedContentCategory: growthPillarPlan?.selectedContentCategory,
      growthPillar: growthPillarPlan?.key,
      growthPillarLabel: growthPillarPlan?.label,
      growthObjective: growthPillarPlan?.objective,
      growthReason: growthPillarPlan?.reason,
      separatePlatformDrafting: true,
      strategySummary,
      recommendedNextPostType: effectiveRecommendedPostType,
      nextBestSocialAction: effectiveRecommendedPostType,
      recommendedTiming: this.recommendTiming( resolvedPlatformFocus, input.cadence ),
      reason,
      alternateAngles: this.buildAlternateAngles( input.sourceSnapshot, input.goal, resolvedPlatformFocus ),
      winningAngles: this.buildAlternateAngles( input.sourceSnapshot, input.goal, resolvedPlatformFocus ).slice( 0, 2 ),
      weakAngles: watchout ? [watchout] : [],
      lastSignalSummary: recentMixSummary,
      recommendedAdjustment: reason,
      nextBestAction: `Create a ${effectiveRecommendedPostType} for ${this.platformLabel( resolvedPlatformFocus )}.`,
      suggestedSource,
      suggestedSourceDetail,
      recentMixSummary,
      cadencePerAccount: accountCadenceSummaries.length > 1,
      connectedAccountCount: accountCadenceSummaries.length,
      cadenceBaseTargetCount,
      cadenceTargetCount,
      publishedThisWeek,
      approvedQueueCount,
      draftCount: draftPosts.length,
      postsNeededNow,
      queueCoverageCount,
      accountCadenceSummaries,
      watchout,
      riskOrWatchout: watchout,
      platformConcentrationWarning,
      followUpAngle: growthPillarPlan?.followUpAngle,
      commentHook: growthPillarPlan?.commentHook,
      replyTone: growthPillarPlan?.replyTone,
      distributionIntent: growthPillarPlan?.distributionIntent
    };
  }

  private resolveGrowthPillarPlan (
    platform: Exclude<SocialStrategyPlatformFocus, 'auto'>,
    recentPosts: SocialPost[]
  ): ( GrowthPillarDefinition & {
    selectedContentCategory: string;
    recommendedPostType: string;
    followUpAngle: string;
    commentHook: string;
    replyTone: string;
    distributionIntent: string;
  } ) | null {
    if ( platform !== 'threads' && platform !== 'bluesky' ) return null;

    const weekday = this.weekdayNumber( new Date() );
    const recentPillars = recentPosts
      .map( post => String( post.strategyContext?.growthPillar || '' ).trim().toLowerCase() )
      .filter( Boolean );
    const weekdayPillar = SHORT_FORM_GROWTH_PILLARS.find( pillar => pillar.weekday === weekday ) || null;
    const selected = weekdayPillar && recentPillars[0] !== weekdayPillar.key
      ? weekdayPillar
      : this.leastRecentlyUsedGrowthPillar( recentPillars );
    const recentCategories = new Set(
      recentPosts
        .slice( 0, 3 )
        .map( post => String( post.strategyContext?.selectedContentCategory || '' ).trim().toLowerCase() )
        .filter( Boolean )
    );
    const selectedContentCategory = selected.categories.find( category => !recentCategories.has( category ) ) || selected.categories[0];

    return {
      ...selected,
      selectedContentCategory,
      recommendedPostType: `${selected.label.toLowerCase()} post`,
      followUpAngle: this.growthFollowUpAngle( selected.key ),
      commentHook: this.growthCommentHook( selected.key ),
      replyTone: this.growthReplyTone( selected.key ),
      distributionIntent: 'reaction_and_reply_loop'
    };
  }

  private leastRecentlyUsedGrowthPillar ( recentPillars: string[] ): GrowthPillarDefinition {
    const ranked = SHORT_FORM_GROWTH_PILLARS
      .map( pillar => ( {
        pillar,
        lastSeen: recentPillars.findIndex( key => key === pillar.key )
      } ) )
      .sort( ( left, right ) => {
        const leftScore = left.lastSeen === -1 ? Number.POSITIVE_INFINITY : left.lastSeen;
        const rightScore = right.lastSeen === -1 ? Number.POSITIVE_INFINITY : right.lastSeen;
        if ( leftScore === rightScore ) {
          return SHORT_FORM_GROWTH_PILLARS.findIndex( item => item.key === left.pillar.key ) -
            SHORT_FORM_GROWTH_PILLARS.findIndex( item => item.key === right.pillar.key );
        }
        return rightScore - leftScore;
      } );

    return ranked[0]?.pillar || SHORT_FORM_GROWTH_PILLARS[0];
  }

  private weekdayNumber ( date: Date ): number {
    const day = date.getDay();
    return day === 0 ? 7 : day;
  }

  private growthFollowUpAngle ( pillar: GrowthPillarKey ): string {
    switch ( pillar ) {
      case 'momentum_observation':
        return 'If people react fast, follow with one sharper example that proves the same friction is happening in real work.';
      case 'founder_lesson':
        return 'If this resonates, follow with the lesson you had to learn the hard way and why it changed how you operate.';
      case 'contrarian_opinion':
        return 'If people argue or agree, follow with one grounded proof point that keeps the tension alive without over-explaining.';
      case 'operational_truth':
        return 'If this pulls replies, follow with the concrete workflow cost or missed handoff people usually underestimate.';
      case 'personal_realization':
      default:
        return 'If this connects, follow with the moment the realization clicked and what changed after that.';
    }
  }

  private growthCommentHook ( pillar: GrowthPillarKey ): string {
    switch ( pillar ) {
      case 'momentum_observation':
        return 'Watch for replies that say this is exactly where things start breaking.';
      case 'founder_lesson':
        return 'Look for people admitting they learned the same lesson too late.';
      case 'contrarian_opinion':
        return 'Watch for comments that push back, agree hard, or add a stronger version of the same opinion.';
      case 'operational_truth':
        return 'Listen for people naming the exact process step or handoff that keeps failing.';
      case 'personal_realization':
      default:
        return 'Watch for replies where people share the moment they noticed the same thing.';
    }
  }

  private growthReplyTone ( pillar: GrowthPillarKey ): string {
    switch ( pillar ) {
      case 'operational_truth':
        return 'direct_practical';
      case 'founder_lesson':
      case 'personal_realization':
        return 'human_direct';
      case 'momentum_observation':
      case 'contrarian_opinion':
      default:
        return 'sharp_conversational';
    }
  }

  private buildAccountCadenceSummaries (
    accounts: SocialAccount[],
    posts: SocialPost[],
    cadenceTargetCount: number
  ): SocialAccountCadenceSummary[] {
    const connectedAccounts = ( Array.isArray( accounts ) ? accounts : [] )
      .filter( account => String( account?.accountId || '' ).trim() )
      .map( account => ( {
        accountId: String( account.accountId || '' ).trim(),
        provider: String( account.provider || '' ).trim().toLowerCase(),
        label: this.accountLabel( account )
      } ) )
      .filter( ( account, index, collection ) => collection.findIndex( item => item.accountId === account.accountId ) === index );

    if ( !connectedAccounts.length ) {
      const publishedThisWeek = posts.filter( post =>
        String( post.status || '' ).toLowerCase() === 'published' &&
        this.isWithinCurrentWeek( post.publishedTimestamp || post.updatedAt || post.createdAt || '' )
      ).length;
      const approvedQueueCount = posts.filter( post => String( post.status || '' ).toLowerCase() === 'approved' ).length;
      const queueCoverageCount = approvedQueueCount + publishedThisWeek;
      return [{
        accountId: '',
        provider: '',
        label: 'Current social queue',
        cadenceTargetCount,
        publishedThisWeek,
        approvedQueueCount,
        queueCoverageCount,
        postsNeededNow: Math.max( 0, cadenceTargetCount - queueCoverageCount )
      }];
    }

    return connectedAccounts.map( account => {
      const accountPosts = posts.filter( post => String( post.socialAccountId || '' ).trim() === account.accountId );
      const publishedThisWeek = accountPosts.filter( post =>
        String( post.status || '' ).toLowerCase() === 'published' &&
        this.isWithinCurrentWeek( post.publishedTimestamp || post.updatedAt || post.createdAt || '' )
      ).length;
      const approvedQueueCount = accountPosts.filter( post => String( post.status || '' ).toLowerCase() === 'approved' ).length;
      const queueCoverageCount = approvedQueueCount + publishedThisWeek;
      return {
        accountId: account.accountId,
        provider: account.provider,
        label: account.label,
        cadenceTargetCount,
        publishedThisWeek,
        approvedQueueCount,
        queueCoverageCount,
        postsNeededNow: Math.max( 0, cadenceTargetCount - queueCoverageCount )
      };
    } );
  }

  private accountLabel ( account: SocialAccount ): string {
    const preferredLabel = String( account.displayName || account.username || account.email || account.providerUserId || '' ).trim();
    if ( preferredLabel ) return preferredLabel;
    const provider = String( account.provider || '' ).trim().toLowerCase();
    if ( provider === 'linkedin' ) return 'LinkedIn account';
    if ( provider === 'threads' ) return 'Threads account';
    if ( provider === 'bluesky' ) return 'Bluesky account';
    if ( provider === 'reddit' ) return 'Reddit account';
    return 'Connected account';
  }

  private isWithinCurrentWeek ( value: string ): boolean {
    const raw = String( value || '' ).trim();
    if ( !raw ) return false;
    const date = new Date( raw );
    if ( Number.isNaN( date.getTime() ) ) return false;
    const now = new Date();
    const weekStart = new Date( now );
    weekStart.setHours( 0, 0, 0, 0 );
    const day = weekStart.getDay();
    const distanceToMonday = ( day + 6 ) % 7;
    weekStart.setDate( weekStart.getDate() - distanceToMonday );
    return date >= weekStart;
  }

  private cadenceTargetCount ( cadence: SocialStrategyCadence ): number {
    if ( cadence === '5x_day' ) return 35;
    if ( cadence === '4x_day' ) return 28;
    if ( cadence === '3x_day' ) return 21;
    if ( cadence === '2x_day' ) return 14;
    if ( cadence === 'daily' ) return 7;
    if ( cadence === '5x_week' ) return 5;
    if ( cadence === '2x_week' ) return 2;
    if ( cadence === 'weekly' ) return 1;
    return 3; // 3x_week default
  }

  private resolvePlatformFocus (
    requestedFocus: SocialStrategyPlatformFocus,
    goal: SocialStrategyGoal,
    connectedProviders: Set<string>
  ): Exclude<SocialStrategyPlatformFocus, 'auto'> {
    if ( requestedFocus && requestedFocus !== 'auto' ) {
      return requestedFocus;
    }

    const prefersLinkedIn = goal === 'build_authority' || goal === 'drive_traffic' || goal === 'generate_leads';
    const preferred = prefersLinkedIn ? 'linkedin' : 'threads';

    if ( connectedProviders.has( preferred ) ) {
      return preferred;
    }

    if ( connectedProviders.has( 'linkedin' ) && connectedProviders.has( 'threads' ) ) {
      return 'balanced';
    }

    if ( connectedProviders.has( 'linkedin' ) ) {
      return 'linkedin';
    }

    if ( connectedProviders.has( 'threads' ) ) {
      return 'threads';
    }

    if ( connectedProviders.has( 'bluesky' ) ) {
      return prefersLinkedIn ? 'linkedin' : 'bluesky';
    }

    if ( connectedProviders.has( 'reddit' ) ) {
      return prefersLinkedIn ? 'linkedin' : 'reddit';
    }

    if ( connectedProviders.has( 'youtube' ) ) {
      return 'youtube';
    }

    if ( connectedProviders.has( 'google_business_profile' ) ) {
      return 'google_business_profile';
    }

    return prefersLinkedIn ? 'linkedin' : 'threads';
  }

  private classifyPostType ( content: string ): DerivedPostType {
    const normalized = String( content || '' ).trim().toLowerCase();
    if ( /(book|demo|buy|offer|product|pricing|trial|sign up|join)/.test( normalized ) ) return 'promotional';
    if ( /(case study|client|result|outcome|before|after|proof|customer)/.test( normalized ) ) return 'proof';
    if ( /(lesson|framework|how to|steps|guide|tips|playbook)/.test( normalized ) ) return 'educational';
    if ( /(belief|opinion|hot take|question|thought|agree|disagree)/.test( normalized ) ) return 'conversational';
    return 'authority';
  }

  private classifyContentLane ( content: string ): SocialContentLane {
    const normalized = String( content || '' ).trim().toLowerCase();
    if ( /(offer|pricing|demo|book|call|trial|buy|sign up|join)/.test( normalized ) ) return 'offer';
    if ( /(case study|client|result|outcome|before|after|proof|customer|won|grew)/.test( normalized ) ) return 'proof';
    if ( /(contrarian|unpopular|wrong|stop doing|disagree|everyone says|actually)/.test( normalized ) ) return 'contrarian';
    if ( /(story|when i|when we|years ago|once|journey|learned the hard way)/.test( normalized ) ) return 'story';
    return 'lesson';
  }

  private pickContentLane (
    goal: SocialStrategyGoal,
    platform: Exclude<SocialStrategyPlatformFocus, 'auto'>,
    blockedLane: SocialContentLane | null
  ): SocialContentLane {
    const preferred = this.goalPreferredLane( goal, platform );
    if ( preferred !== blockedLane ) {
      return preferred;
    }

    return this.fallbackLane( preferred );
  }

  private goalPreferredLane (
    goal: SocialStrategyGoal,
    platform: Exclude<SocialStrategyPlatformFocus, 'auto'>
  ): SocialContentLane {
    switch ( goal ) {
      case 'generate_leads':
        return 'proof';
      case 'drive_traffic':
        return platform === 'linkedin' ? 'lesson' : 'contrarian';
      case 'drive_engagement':
        return platform === 'linkedin' ? 'story' : 'contrarian';
      case 'grow_followers':
        return platform === 'linkedin' ? 'lesson' : 'story';
      case 'build_authority':
        return 'lesson';
      case 'grow_awareness':
      default:
        return platform === 'bluesky' ? 'contrarian' : 'lesson';
    }
  }

  private fallbackLane ( blockedLane: SocialContentLane ): SocialContentLane {
    const laneOrder: SocialContentLane[] = ['proof', 'lesson', 'contrarian', 'story', 'offer'];
    const blockedIndex = laneOrder.indexOf( blockedLane );
    return laneOrder[( blockedIndex + 1 ) % laneOrder.length];
  }

  private getGoalDrivenPostType (
    goal: SocialStrategyGoal,
    platform: Exclude<SocialStrategyPlatformFocus, 'auto'>
  ): string {
    const shortFormPlatform = platform === 'threads' || platform === 'bluesky';

    switch ( goal ) {
      case 'grow_followers':
        return shortFormPlatform ? 'short conversational post' : 'hook-led insight post';
      case 'drive_engagement':
        if ( platform === 'reddit' ) return 'direct answer post';
        return platform === 'linkedin' ? 'question-led discussion post' : 'short reaction post';
      case 'build_authority':
        if ( platform === 'reddit' ) return 'helpful opinion post';
        return shortFormPlatform ? 'concise expert take' : 'short authority post';
      case 'drive_traffic':
        if ( platform === 'reddit' ) return 'helpful observation post';
        return shortFormPlatform ? 'curiosity post with a clear next click' : 'insight post with a clear next click';
      case 'generate_leads':
        if ( platform === 'reddit' ) return 'problem-awareness post';
        return shortFormPlatform ? 'problem-solution post' : 'proof post with a clear next step';
      case 'grow_awareness':
      default:
        if ( platform === 'reddit' ) return 'real observation post';
        return shortFormPlatform ? 'short conversational post' : 'practical insight post';
    }
  }

  private getAlternatePostType (
    goal: SocialStrategyGoal,
    platform: Exclude<SocialStrategyPlatformFocus, 'auto'>
  ): string {
    const shortFormPlatform = platform === 'threads' || platform === 'bluesky';

    if ( goal === 'generate_leads' ) {
      if ( platform === 'reddit' ) return 'helpful answer post';
      return platform === 'linkedin' ? 'authority post with light proof' : 'curiosity post with one next step';
    }
    if ( goal === 'drive_engagement' ) {
      if ( platform === 'reddit' ) return 'specific observation post';
      return platform === 'linkedin' ? 'story-led discussion post' : 'question post';
    }
    if ( platform === 'reddit' ) return 'specific story post';
    return shortFormPlatform ? 'short authority post' : 'proof post';
  }

  private avoidRepetition ( recommendedType: string, repetitiveType: DerivedPostType | null ): string {
    if ( repetitiveType !== 'promotional' ) {
      return recommendedType;
    }

    if ( /authority|proof|insight/.test( recommendedType ) ) {
      return recommendedType;
    }

    return `non-promotional ${recommendedType}`;
  }

  private buildSummary (
    goal: SocialStrategyGoal,
    platform: Exclude<SocialStrategyPlatformFocus, 'auto'>,
    cadence: SocialStrategyCadence,
    postType: string,
    recentMixSummary: string
  ): string {
    return `${this.goalLabel( goal )} is the current goal. Focus ${this.platformLabel( platform )} with a ${this.cadenceLabel( cadence ).toLowerCase()} rhythm and lead with a ${postType}. ${recentMixSummary}`;
  }

  private buildReason ( input: { goal: SocialStrategyGoal; platform: Exclude<SocialStrategyPlatformFocus, 'auto'>; recentTypes: DerivedPostType[]; recommendedNextPostType: string; } ): string {
    if ( input.recentTypes[0] === 'promotional' && input.recentTypes[1] === 'promotional' ) {
      return `${this.platformLabel( input.platform )} has recently leaned too promotional, so the next move should earn attention with a more useful angle.`;
    }

    switch ( input.goal ) {
      case 'grow_followers':
        return `${this.platformLabel( input.platform )} follower growth improves when the next post opens with curiosity and a faster hook instead of a hard pitch.`;
      case 'drive_engagement':
        return `${this.platformLabel( input.platform )} engagement improves when the next post invites a response, not just a read.`;
      case 'build_authority':
        return `${this.platformLabel( input.platform )} is strongest when the next post teaches one concrete idea or shows proof behind the point.`;
      case 'drive_traffic':
        return `Traffic works better when the post makes the source feel worth opening without sounding like an ad.`;
      case 'generate_leads':
        return `Lead generation needs a clearer business problem and next step than a broad awareness post.`;
      case 'grow_awareness':
      default:
        return `${this.goalLabel( input.goal )} works best when the next post stays broad, useful, and easy to grasp quickly.`;
    }
  }

  private buildWatchout ( repetitiveType: DerivedPostType | null, recentTypes: DerivedPostType[] ): string | undefined {
    if ( repetitiveType === 'promotional' ) {
      return 'Avoid another product-heavy post right now.';
    }

    if ( recentTypes.filter( type => type === 'authority' ).length >= 3 ) {
      return 'Recent posts are clustering around the same authority format. A different angle would improve the mix.';
    }

    return undefined;
  }

  private buildRecentMixSummary ( recentPosts: SocialPost[], recentTypes: DerivedPostType[] ): string {
    if ( !recentPosts.length ) {
      return 'There is little recent post history, so TODD is leaning on the selected goal and available source.';
    }

    const promotionalCount = recentTypes.filter( type => type === 'promotional' ).length;
    const educationalCount = recentTypes.filter( type => type === 'educational' ).length;
    const proofCount = recentTypes.filter( type => type === 'proof' ).length;

    if ( promotionalCount >= 2 ) {
      return 'Recent content leans promotional, so the next post should shift back toward usefulness or proof.';
    }

    if ( educationalCount >= 2 ) {
      return 'Recent content already covers teaching and explanation, so a lighter proof or opinion angle can vary the mix.';
    }

    if ( proofCount >= 2 ) {
      return 'Recent content already leans on proof, so a broader insight or conversation starter can balance the feed.';
    }

    return 'The recent mix is reasonably balanced, so the next post can follow the active business goal.';
  }

  private buildPlatformConcentrationWarning ( connectedProviders: Set<string> ): string | undefined {
    const publishingPlatforms = ['linkedin', 'threads', 'bluesky', 'reddit', 'youtube', 'instagram', 'facebook'].filter(
      platform => connectedProviders.has( platform )
    );
    if ( publishingPlatforms.length < 3 ) return undefined;
    const listed = publishingPlatforms.slice( 0, 3 ).map( p => this.platformLabel( p as any ) ).join( ', ' );
    const suffix = publishingPlatforms.length > 3 ? ', and more' : '';
    return `You are split across ${publishingPlatforms.length} platforms (${listed}${suffix}). Algorithms reward density, not breadth. Pick one primary platform for 90 days to trigger organic pickup before expanding.`;
  }

  private recommendTiming ( platform: Exclude<SocialStrategyPlatformFocus, 'auto'>, cadence: SocialStrategyCadence ): string {
    const now = new Date();
    const hour = now.getHours();
    const weekday = now.getDay(); // 0=Sun, 6=Sat
    const isWeekend = weekday === 0 || weekday === 6;
    const isFriday = weekday === 5;
    const isLateDay = hour >= 16;
    const nextWeekdayMorning = isFriday || isWeekend ? 'Monday 8–10am' : 'Tomorrow 8–10am';

    if ( cadence === '2x_day' ) {
      return hour < 12
        ? 'Post now (morning window) and again at 7–9pm'
        : 'Post now and again tomorrow morning at 8–10am';
    }

    if ( platform === 'reddit' ) {
      return isWeekend
        ? 'Wait until Monday 8am–12pm — Reddit engagement drops on weekends'
        : 'Post 8am–12pm today — Reddit peaks in morning weekday hours';
    }

    if ( platform === 'linkedin' ) {
      const bestDays = weekday >= 2 && weekday <= 4; // Tue–Thu
      if ( bestDays && !isLateDay ) {
        return hour < 12
          ? 'Post now — 8–10am Tue–Thu is LinkedIn\'s peak window'
          : 'Post now — 12–2pm Tue–Thu is LinkedIn\'s second peak window';
      }
      if ( isWeekend || isFriday ) return `${nextWeekdayMorning} — LinkedIn performs best Tue–Thu 8–10am`;
      return isLateDay ? `${nextWeekdayMorning} — LinkedIn evening reach is weak` : '8–10am or 12–2pm today, Tue–Thu window preferred';
    }

    if ( platform === 'bluesky' ) {
      if ( isLateDay ) return 'Now or 7–9pm — Bluesky\'s tech-forward audience is most active evenings';
      return hour < 12
        ? 'Post now — 8–10am catches Bluesky\'s morning active window'
        : '7–9pm tonight — Bluesky engagement peaks in the evening';
    }

    if ( platform === 'threads' ) {
      if ( isLateDay ) return 'Post now — 7–9pm is Threads\' strongest engagement window';
      return hour < 12
        ? '9–11am today or 7–9pm tonight — Threads peaks at morning browse and evening scroll'
        : '7–9pm tonight — Threads evening window outperforms afternoon';
    }

    if ( platform === 'youtube' ) {
      return isWeekend ? 'Post today — YouTube watch-time is highest on weekends' : 'Fri–Sun perform best for YouTube; queue for this weekend';
    }

    if ( platform === 'google_business_profile' ) {
      return 'Post now — Google Business Profile posts are indexed immediately';
    }

    if ( platform === 'balanced' ) {
      return isLateDay || isWeekend
        ? `${nextWeekdayMorning} for LinkedIn; 7–9pm tonight for Threads`
        : 'LinkedIn 8–10am Tue–Thu; Threads 7–9pm any weekday';
    }

    if ( cadence === 'weekly' || cadence === '2x_week' ) return `${nextWeekdayMorning} — lower cadence benefits from higher-traffic time slots`;
    if ( cadence === '5x_week' ) return isLateDay ? `${nextWeekdayMorning}` : 'Post within the next 2 hours to stay on cadence';
    return isLateDay ? `${nextWeekdayMorning}` : 'Post this morning or at 7–9pm tonight';
  }

  private buildAlternateAngles (
    sourceSnapshot: SocialSourceSnapshot | null,
    goal: SocialStrategyGoal,
    platform: Exclude<SocialStrategyPlatformFocus, 'auto'>
  ): string[] {
    const title = String( sourceSnapshot?.title || sourceSnapshot?.topic || 'this source' ).trim();
    const topic = String( sourceSnapshot?.topic || sourceSnapshot?.category || title ).trim();
    const platformLabel = this.platformLabel( platform );

    return [
      `Lead with one practical takeaway from ${title} and explain why it matters on ${platformLabel}.`,
      `Turn ${topic} into a simple point of view post with a stronger opening hook for ${this.goalLabel( goal ).toLowerCase()}.`,
      `Pull one proof point, example, or lesson from ${title} and frame it as a clearer next-step post.`
    ];
  }

  private platformIdentityLabel ( platform: Exclude<SocialStrategyPlatformFocus, 'auto'> ): string {
    if ( platform === 'threads' ) return 'Threads';
    if ( platform === 'bluesky' ) return 'Bluesky';
    if ( platform === 'reddit' ) return 'Reddit';
    if ( platform === 'youtube' ) return 'YouTube';
    if ( platform === 'google_business_profile' ) return 'Google Business Profile';
    if ( platform === 'balanced' ) return 'LinkedIn and Threads';
    return 'LinkedIn';
  }

  private platformIdentityTraits ( platform: Exclude<SocialStrategyPlatformFocus, 'auto'> ): string[] {
    if ( platform === 'threads' ) return ['conversational', 'sharper hook', 'shorter rhythm', 'stronger personality'];
    if ( platform === 'bluesky' ) return ['thoughtful', 'idea-driven', 'authentic', 'less salesy'];
    if ( platform === 'reddit' ) return ['specific', 'helpful', 'community-aware', 'low-promotion'];
    if ( platform === 'youtube' ) return ['video-first', 'clear hook', 'description-ready', 'search-aware'];
    if ( platform === 'google_business_profile' ) return ['local', 'customer-facing', 'clear update', 'action-oriented'];
    if ( platform === 'balanced' ) return ['professional', 'conversational', 'business insight', 'distinct structure'];
    return ['professional', 'credibility', 'business insight', 'practical takeaway'];
  }

  private describeSuggestedSource ( sourceSnapshot: SocialSourceSnapshot | null ): string {
    if ( sourceSnapshot?.type === 'response-flow' ) return 'Knowledge Base item';
    if ( sourceSnapshot?.type === 'document' ) return 'Document';
    return 'Knowledge Base item or document';
  }

  private describeSuggestedSourceDetail ( sourceSnapshot: SocialSourceSnapshot | null, postType: string ): string {
    const title = String( sourceSnapshot?.title || '' ).trim();
    if ( title ) {
      return `${title} is a good fit for a ${postType}.`;
    }

    return `Use a source that can support a ${postType} with one clear idea, example, or lesson.`;
  }

  private platformLabel ( platform: Exclude<SocialStrategyPlatformFocus, 'auto'> ): string {
    if ( platform === 'balanced' ) return 'both LinkedIn and Threads';
    if ( platform === 'threads' ) return 'Threads';
    if ( platform === 'bluesky' ) return 'Bluesky';
    if ( platform === 'reddit' ) return 'Reddit';
    if ( platform === 'youtube' ) return 'YouTube';
    if ( platform === 'google_business_profile' ) return 'Google Business Profile';
    return 'LinkedIn';
  }

  private goalLabel ( goal: SocialStrategyGoal ): string {
    switch ( goal ) {
      case 'grow_followers': return 'Grow followers';
      case 'drive_engagement': return 'Drive engagement';
      case 'build_authority': return 'Build authority';
      case 'drive_traffic': return 'Drive traffic';
      case 'generate_leads': return 'Generate leads';
      case 'grow_awareness':
      default: return 'Grow awareness';
    }
  }

  private cadenceLabel ( cadence: SocialStrategyCadence ): string {
    switch ( cadence ) {
      case '2x_day': return 'Twice daily';
      case 'daily': return 'Daily';
      case '5x_week': return 'Five times a week';
      case '2x_week': return 'Twice a week';
      case 'weekly': return 'Weekly';
      case '3x_week':
      default: return 'Three times a week';
    }
  }
}

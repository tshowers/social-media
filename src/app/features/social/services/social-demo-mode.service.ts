import { Injectable } from '@angular/core';
import {
  SocialAccount,
  SocialPost,
  SocialPostSourceReference,
  SocialSourceSnapshot,
  SocialStrategyCadence,
  SocialStrategyGoal
} from '../../../services/social-api.service';
import { environment } from '../../../../environments/environment';

@Injectable( { providedIn: 'root' } )
export class SocialDemoModeService {

  isDemoQueryParamEnabled ( params: { get: ( key: string ) => string | null; } ): boolean {
    const queryParamValue = String( params.get( 'demo' ) || '' ).trim().toLowerCase();
    return ['1', 'true', 'yes', 'on'].includes( queryParamValue );
  }

  buildDemoSocialAccounts (): SocialAccount[] {
    return [
      {
        accountId: 'demo-li-1',
        provider: 'linkedin',
        providerId: 'linkedin-demo-1',
        providerUserId: 'demo-linkedin',
        username: 'todddemo',
        displayName: 'TODD Demo',
        profileUrl: 'https://linkedin.com/in/todddemo',
        avatarUrl: 'https://via.placeholder.com/80?text=TODD',
        connectedAt: new Date().toISOString(),
        status: 'connected'
      },
      {
        accountId: 'demo-th-1',
        provider: 'threads',
        providerId: 'threads-demo-1',
        providerUserId: 'demo-threads',
        username: 'todddemo',
        displayName: 'TODD Demo',
        profileUrl: 'https://threads.net/@todddemo',
        avatarUrl: 'https://via.placeholder.com/80?text=TODD',
        connectedAt: new Date().toISOString(),
        status: 'connected'
      }
    ];
  }

  buildDemoProviderAvailability (): Record<string, { configured: boolean; message?: string; }> {
    return {
      linkedin: { configured: true },
      threads: { configured: true },
      bluesky: { configured: false, message: 'Bluesky is not configured in demo mode.' },
      reddit: { configured: false, message: 'Reddit is not configured in demo mode.' }
    };
  }

  buildDemoSourceSnapshot (
    sourceReference: SocialPostSourceReference
  ): SocialSourceSnapshot | null {
    if ( !sourceReference.sourceType || !sourceReference.sourceId ) {
      return null;
    }

    return {
      title: sourceReference.title || 'Demo content source',
      type: sourceReference.sourceType || 'document',
      summary: `This is a demo source preview that TODD can turn into social posts for ${sourceReference.title || 'a sample topic'}.`,
      content: 'TODD uses the source content to create social messages that sound helpful and relevant, not promotional.',
      url: sourceReference.title ? `${environment.PLATFORM_URL}/demo-source` : undefined
    };
  }

  buildDemoSocialPosts (
    sourceReference: SocialPostSourceReference,
    strategyGoal: SocialStrategyGoal,
    strategyCadence: SocialStrategyCadence
  ): SocialPost[] {
    const now = new Date().toISOString();
    const normalizedSourceRef: SocialPostSourceReference = {
      sourceType: sourceReference.sourceType || 'demo',
      sourceId: sourceReference.sourceId || 'demo-source-1',
      title: sourceReference.title || 'Demo social content'
    };

    return [
      {
        postId: 'demo-published-1',
        sourceContentReference: normalizedSourceRef,
        platform: 'linkedin',
        socialAccountId: 'demo-li-1',
        content: 'TODD turned a recent milestone into a LinkedIn post that highlights progress and credibility without sounding like a pitch.',
        status: 'published',
        strategyContext: {
          goal: strategyGoal,
          platformFocus: 'linkedin',
          cadence: strategyCadence,
          recommendedNextPostType: 'insightful update',
          recommendedTiming: 'Tomorrow morning',
          reason: 'LinkedIn works best for useful updates that build awareness.',
          strategySummary: 'Share a quick update that proves your expertise and builds awareness.'
        },
        engagementSignal: {
          likes: 24,
          comments: 5,
          clicks: 13,
          engagedPeople: ['Ari Lopez', 'Jordan Reed', 'Morgan Patel']
        },
        publishedTimestamp: now,
        updatedAt: now
      },
      {
        postId: 'demo-approved-1',
        sourceContentReference: normalizedSourceRef,
        platform: 'linkedin',
        socialAccountId: 'demo-li-1',
        content: 'TODD is queuing an insight post that helps your audience see what works next.',
        status: 'approved',
        approvedAt: new Date( Date.now() + 1000 * 60 * 60 ).toISOString(),
        updatedAt: now,
        strategyContext: {
          goal: strategyGoal,
          platformFocus: 'linkedin',
          cadence: strategyCadence,
          recommendedNextPostType: 'insightful update',
          recommendedTiming: 'Tomorrow morning',
          reason: 'LinkedIn works best for useful updates that build awareness.',
          strategySummary: 'Share a quick update that proves your expertise and builds awareness.'
        },
        engagementSignal: { likes: 0, comments: 0, clicks: 0, engagedPeople: [] }
      },
      {
        postId: 'demo-draft-1',
        sourceContentReference: normalizedSourceRef,
        platform: 'threads',
        socialAccountId: 'demo-th-1',
        content: 'A short Threads post that starts with a useful observation and invites the audience to comment on what they are watching this week.',
        status: 'draft',
        updatedAt: now,
        strategyContext: {
          goal: strategyGoal,
          platformFocus: 'threads',
          cadence: strategyCadence,
          recommendedNextPostType: 'conversation starter',
          recommendedTiming: 'This afternoon',
          reason: 'Threads is ideal for short engagement posts that spark discussion.',
          strategySummary: 'Use a concise insight to start a conversation.'
        },
        engagementSignal: { likes: 0, comments: 0, clicks: 0, engagedPeople: [] }
      }
    ];
  }
}

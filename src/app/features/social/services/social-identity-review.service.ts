import { Injectable, inject } from '@angular/core';
import { Subscription, take } from 'rxjs';
import { NotificationService } from '../../../services/notification.service';
import { SocialWritingIdentityService } from '../../../services/social-writing-identity.service';
import { ToddWritingIdentityReview, ToddWritingIdentityState } from '../../../models/todd-writing-identity.model';
import { SocialIdentityContext, SocialPost } from '../../../services/social-api.service';

@Injectable( { providedIn: 'root' } )
export class SocialIdentityReviewService {
  private readonly notificationService = inject( NotificationService );
  private readonly writingIdentityService = inject( SocialWritingIdentityService );

  reviewPostAgainstIdentity (
    post: SocialPost,
    identityState: ToddWritingIdentityState | null
  ): ToddWritingIdentityReview | null {
    if ( !identityState || !String( post?.content || '' ).trim() ) return null;
    return identityState.reviewDraft( post.content );
  }

  applyIdentityReview (
    post: SocialPost,
    identityState: ToddWritingIdentityState | null,
    identityContext: SocialIdentityContext | null,
    offerContext: any | null
  ): SocialPost {
    return {
      ...post,
      identityContext: post.identityContext || identityContext,
      offerContext: post.offerContext || offerContext,
      identityReview: this.reviewPostAgainstIdentity( post, identityState )
    };
  }

  notifyIdentityReviewIfNeeded ( posts: SocialPost[], title: string ): void {
    const mismatches = posts.filter( post =>
      post.identityReview && ( !post.identityReview.matchesLane || !post.identityReview.matchesVoice )
    );
    if ( !mismatches.length ) return;
    this.notificationService.show(
      title,
      `${mismatches.length} draft${mismatches.length === 1 ? '' : 's'} may need lane or voice cleanup before publishing.`,
      'warning'
    );
  }

  loadIdentityState (
    subscription: Subscription,
    onLoaded: ( state: ToddWritingIdentityState | null ) => void,
    onLoadingChange: ( loading: boolean, loaded: boolean ) => void
  ): void {
    onLoadingChange( true, false );
    subscription.add(
      this.writingIdentityService.loadIdentityState().pipe( take( 1 ) ).subscribe( {
        next: state => {
          onLoadingChange( false, true );
          onLoaded( state );
        },
        error: () => {
          onLoadingChange( false, true );
          onLoaded( null );
        }
      } )
    );
  }

  buildIdentityContext ( identityState: ToddWritingIdentityState | null ): SocialIdentityContext | null {
    const identity = identityState?.identity;
    if ( !identity ) return null;

    return {
      identitySummary: identity.identitySummary,
      whoTheyAre: identity.whoTheyAre,
      whatTheyDo: identity.whatTheyDo,
      howTheyMakeMoney: identity.howTheyMakeMoney,
      likelyAudience: identity.likelyAudience,
      primaryContentLane: identity.primaryContentLane,
      secondaryThemes: identity.secondaryThemes,
      voiceProfile: identity.voiceProfile,
      confidence: identity.confidence,
      profileCompleteEnough: identity.profileCompleteEnough,
      warningMessage: identity.warningMessage,
      inferredFrom: identity.inferredFrom
    };
  }

  identityWarningMessage ( identityState: ToddWritingIdentityState | null ): string {
    const hasWarning = String( identityState?.identity?.warningMessage || '' ).trim().length > 0;
    if ( !hasWarning || identityState?.identity?.profileCompleteEnough === true ) return '';
    return 'Please complete your profile so TODD has enough information to write social posts in your voice.';
  }
}

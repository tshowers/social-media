import { Injectable, inject } from '@angular/core';
import {
  SocialApiService,
  SocialPost
} from '../../../services/social-api.service';
import { NotificationService } from '../../../services/notification.service';
import { SocialCadenceSettingsService } from './social-cadence-settings.service';
import { LoggerService } from '../../../services/logger.service';

export interface SocialQueueRequestContext {
  tenantId?: string;
  userId?: string;
  userEmail?: string;
}

export interface SocialQueuePostPayload {
  actionId?: string | null;
  planId?: string | null;
  strategyId?: string | null;
  segmentId?: string | null;
  angleId?: string | null;
  sourceContentReference: any;
  platform: string;
  socialAccountId: string;
  subreddit: string;
  mediaAttachment: any;
  content: string;
  status: string;
  strategyContext: any;
  followThroughPlan?: any;
  identityContext: any;
  offerContext: any;
  identityReview: any;
  approvedAt: string | null;
  scheduledFor: string | null;
  manualReviewRequired?: boolean;
  returnedToDraftAt?: string | null;
  engagementSignal: any;
  followUpSuggestion: any;
  redditSafety: any;
  publishedTimestamp: string | null;
  externalPlatformPostId: string | null;
}

@Injectable( { providedIn: 'root' } )
export class SocialQueueService {
  private readonly outreachApi = inject( SocialApiService );
  private readonly notificationService = inject( NotificationService );
  private readonly cadenceSettingsService = inject( SocialCadenceSettingsService );
  private readonly logger = inject( LoggerService );

  approvePost (
    post: SocialPost,
    payload: SocialQueuePostPayload,
    draftActionState: Record<string, { action: string; label: string; }>,
    requestContext: SocialQueueRequestContext,
    platformLabel: ( p: string ) => string,
    onSuccess: ( savedPost: SocialPost ) => void,
    suppressNotification = false
  ): Promise<void> {
    if ( !post?.postId ) return Promise.resolve();

    draftActionState[post.postId] = { action: 'approve', label: 'Approving social draft for the queue.' };

    this.logger.log( 'SOCIAL_APPROVE_POST_REQUEST', {
      postId: post.postId,
      platform: post.platform,
      currentStatus: post.status
    } );

    return new Promise( resolve => {
      this.outreachApi.updateSocialPost( post.postId, payload as any, requestContext ).subscribe( {
        next: response => {
          delete draftActionState[post.postId];
          this.logger.log( 'SOCIAL_APPROVE_POST_RESPONSE', {
            requestedPostId: post.postId,
            savedPostId: response?.data?.postId,
            status: response?.data?.status
          } );
          onSuccess( response.data );
          if ( !suppressNotification ) {
            this.notificationService.show( 'Approved', `${platformLabel( post.platform )} post is now queued for TODD.`, 'success' );
          }
          resolve();
        },
        error: error => {
          console.error( 'SOCIAL_APPROVE_POST_ERROR', { postId: post.postId, error } );
          delete draftActionState[post.postId];
          if ( !suppressNotification ) {
            this.notificationService.show( 'Approval Error', error?.error?.message || 'Unable to approve this post right now.', 'error' );
          }
          resolve();
        }
      } );
    } );
  }

  resetToApproved (
    post: SocialPost,
    payload: SocialQueuePostPayload,
    draftActionState: Record<string, { action: string; label: string; }>,
    requestContext: SocialQueueRequestContext,
    platformLabel: ( p: string ) => string,
    onSuccess: ( savedPost: SocialPost ) => void
  ): Promise<void> {
    if ( !post?.postId ) return Promise.resolve();

    draftActionState[post.postId] = { action: 'approve', label: 'Resetting post for retry.' };

    return new Promise( resolve => {
      this.outreachApi.updateSocialPost( post.postId, payload as any, requestContext ).subscribe( {
        next: response => {
          delete draftActionState[post.postId];
          onSuccess( response.data );
          this.notificationService.show( 'Reset for Retry', `${platformLabel( post.platform )} post is back in the approved queue.`, 'success' );
          resolve();
        },
        error: error => {
          delete draftActionState[post.postId];
          this.notificationService.show( 'Reset Error', error?.error?.message || 'Unable to reset this post right now.', 'error' );
          resolve();
        }
      } );
    } );
  }

  rejectPost (
    post: SocialPost,
    payload: SocialQueuePostPayload,
    draftActionState: Record<string, { action: string; label: string; }>,
    requestContext: SocialQueueRequestContext,
    platformLabel: ( p: string ) => string,
    onSuccess: ( savedPost: SocialPost ) => void,
    suppressNotification = false
  ): Promise<void> {
    if ( !post?.postId ) return Promise.resolve();

    draftActionState[post.postId] = { action: 'reject', label: 'Removing this draft from review.' };

    return new Promise( resolve => {
      this.outreachApi.updateSocialPost( post.postId, payload as any, requestContext ).subscribe( {
        next: response => {
          delete draftActionState[post.postId];
          onSuccess( response.data );
          if ( !suppressNotification ) {
            this.notificationService.show( 'Rejected', `${platformLabel( post.platform )} draft removed from the review queue.`, 'success' );
          }
          resolve();
        },
        error: error => {
          delete draftActionState[post.postId];
          if ( !suppressNotification ) {
            this.notificationService.show( 'Reject Error', error?.error?.message || 'Unable to reject this draft right now.', 'error' );
          }
          resolve();
        }
      } );
    } );
  }

  publishPost (
    post: SocialPost,
    savePayload: SocialQueuePostPayload,
    socialAccountId: string,
    subreddit: string,
    publishingPostIds: Set<string>,
    draftActionState: Record<string, { action: string; label: string; }>,
    requestContext: SocialQueueRequestContext,
    platformLabel: ( p: string ) => string,
    onSuccess: ( savedPost: SocialPost ) => void,
    onError: () => void
  ): void {
    if ( !post?.postId ) return;

    publishingPostIds.add( post.postId );
    draftActionState[post.postId] = { action: 'publish', label: 'Publishing the selected social post.' };

    this.outreachApi.updateSocialPost( post.postId, savePayload as any, requestContext ).subscribe( {
      next: saved => {
        onSuccess( saved.data );
        this.outreachApi.publishSocialPost( post.postId, { socialAccountId, subreddit }, requestContext ).subscribe( {
          next: response => {
            onSuccess( response.data );
            publishingPostIds.delete( post.postId );
            delete draftActionState[post.postId];
            const status = String( response.data?.status || '' ).trim().toLowerCase();
            if ( status === 'pending_retry' ) {
              this.notificationService.show( 'Retry Queued', 'Post saved. Platform unavailable. Will retry automatically.', 'warning' );
              return;
            }
            if ( status === 'failed_permanent' ) {
              this.notificationService.show( 'Saved But Not Posted', 'Post saved, but publishing failed permanently. Try another platform or copy it manually.', 'warning' );
              return;
            }
            if ( status === 'rejected_by_subreddit' ) {
              this.notificationService.show( 'Rejected By Subreddit', 'Post saved, but the subreddit rejected it. Edit the tone and try a safer version.', 'warning' );
              return;
            }
            this.notificationService.show( 'Published', `${platformLabel( post.platform )} post published through the connected account.`, 'success' );
          },
          error: error => {
            publishingPostIds.delete( post.postId );
            delete draftActionState[post.postId];
            onError();
            this.notificationService.show( 'Publish Error', error?.error?.message || 'Unable to publish this post.', 'error' );
          }
        } );
      },
      error: error => {
        publishingPostIds.delete( post.postId );
        delete draftActionState[post.postId];
        onError();
        this.notificationService.show( 'Save Error', error?.error?.message || 'Unable to save before publishing.', 'error' );
      }
    } );
  }

  saveDraft (
    post: SocialPost,
    payload: SocialQueuePostPayload,
    draftActionState: Record<string, { action: string; label: string; }>,
    requestContext: SocialQueueRequestContext,
    platformLabel: ( p: string ) => string,
    onSuccess: ( savedPost: SocialPost ) => void
  ): void {
    if ( !post?.postId ) return;

    draftActionState[post.postId] = { action: 'save', label: 'Saving social draft.' };

    this.outreachApi.updateSocialPost( post.postId, payload as any, requestContext ).subscribe( {
      next: response => {
        delete draftActionState[post.postId];
        onSuccess( response.data );
        this.notificationService.show( 'Draft Saved', `${platformLabel( post.platform )} draft saved.`, 'success' );
      },
      error: error => {
        delete draftActionState[post.postId];
        this.notificationService.show( 'Save Error', error?.error?.message || 'Unable to save this draft.', 'error' );
      }
    } );
  }

  deletePost (
    post: SocialPost,
    draftActionState: Record<string, { action: string; label: string; }>,
    requestContext: SocialQueueRequestContext,
    platformLabel: ( p: string ) => string,
    onSuccess: ( deletedPostIds: string[] ) => void
  ): void {
    if ( !post?.postId ) return;

    draftActionState[post.postId] = { action: 'delete', label: 'Deleting this queued social post.' };

    this.outreachApi.deleteSocialPost( post.postId, requestContext ).subscribe( {
      next: response => {
        delete draftActionState[post.postId];
        const deletedPostIds = Array.isArray( response?.data?.deletedPostIds ) && response.data.deletedPostIds.length ?
          response.data.deletedPostIds.map( item => String( item || '' ).trim() ).filter( Boolean ) :
          [String( response?.data?.postId || post.postId )];
        onSuccess( deletedPostIds );
        this.notificationService.show( 'Deleted', `${platformLabel( post.platform )} post deleted from the queue.`, 'success' );
      },
      error: error => {
        delete draftActionState[post.postId];
        this.notificationService.show( 'Delete Error', error?.error?.message || 'Unable to delete this post right now.', 'error' );
      }
    } );
  }

  buildScheduledForFromCadence ( post: SocialPost, approvedAndPublishedPosts: SocialPost[] ): string | null {
    const platform = String( post?.platform || post?.provider || '' ).trim().toLowerCase();
    const config = this.cadenceSettingsService.get( platform );
    if ( !config?.customTimes?.length ) return null;

    const now = new Date();
    const intervalMs = this.cadenceIntervalMs( config.cadence );
    const accountId = String( post?.socialAccountId || '' ).trim();

    const lastIso = approvedAndPublishedPosts
      .filter( p => {
        const pPlatform = String( p?.platform || p?.provider || '' ).trim().toLowerCase();
        const pAccount = String( p?.socialAccountId || '' ).trim();
        const pStatus = String( p?.status || '' ).trim().toLowerCase();
        return pPlatform === platform
          && ( !accountId || !pAccount || pAccount === accountId )
          && ( pStatus === 'approved' || pStatus === 'published' )
          && !!p.scheduledFor
          && p.postId !== post.postId;
      } )
      .map( p => String( p.scheduledFor || '' ) )
      .sort( ( a, b ) => b.localeCompare( a ) )[0] || '';

    const baseMs = lastIso
      ? Math.max( new Date( lastIso ).getTime() + intervalMs, now.getTime() )
      : now.getTime();

    const slot = this.nextCustomTimeSlot( new Date( baseMs ), config.customTimes, config.smartRandomization, config.randomizationWindowMinutes );
    return slot.toISOString();
  }

  private cadenceIntervalMs ( cadence: string ): number {
    const map: Record<string, number> = {
      '2x_day': 0.5, 'daily': 1, '5x_week': 1.4, '3x_week': 2, '2x_week': 3.5, 'weekly': 7
    };
    return ( map[cadence] ?? 2 ) * 24 * 60 * 60 * 1000;
  }

  private nextCustomTimeSlot ( base: Date, customTimes: string[], randomize: boolean, windowMinutes: number ): Date {
    const sorted = [...customTimes].filter( t => /^\d{1,2}:\d{2}$/.test( t.trim() ) ).sort();
    if ( !sorted.length ) return base;

    const baseDay = new Date( base );
    baseDay.setHours( 0, 0, 0, 0 );

    for ( const time of sorted ) {
      const [rawH, rawM] = time.split( ':' ).map( Number );
      const candidate = new Date( baseDay );
      candidate.setHours( rawH, rawM, 0, 0 );
      if ( candidate >= base ) {
        return randomize ? this.applyTimeRandomization( candidate, base, windowMinutes ) : candidate;
      }
    }

    const nextDay = new Date( baseDay );
    nextDay.setDate( nextDay.getDate() + 1 );
    const [firstH, firstM] = sorted[0].split( ':' ).map( Number );
    nextDay.setHours( firstH, firstM, 0, 0 );
    return randomize ? this.applyTimeRandomization( nextDay, nextDay, windowMinutes ) : nextDay;
  }

  private applyTimeRandomization ( target: Date, floor: Date, windowMinutes: number ): Date {
    if ( windowMinutes <= 0 ) return target;
    const halfMs = ( windowMinutes / 2 ) * 60 * 1000;
    const offset = ( Math.random() * 2 - 1 ) * halfMs;
    const result = new Date( target.getTime() + offset );
    return result < floor ? new Date( floor ) : result;
  }

  postStatusLabel ( post: SocialPost ): string {
    const status = String( post?.status || 'draft' ).trim().toLowerCase();
    if ( status === 'approved' ) return 'Approved';
    if ( status === 'rejected' ) return 'Rejected';
    if ( status === 'archived' ) return 'Archived';
    if ( status === 'pending_retry' ) return 'Retry queued';
    if ( status === 'failed_permanent' ) return 'Failed';
    if ( status === 'rejected_by_subreddit' ) return 'Rejected';
    if ( status === 'published' ) return 'Posted';
    return status || 'draft';
  }

  retryStatusMessage ( post: SocialPost ): string {
    const status = String( post?.status || '' ).trim().toLowerCase();
    const failureMessage = String( post?.publishFailure?.message || '' ).trim();
    const nextRetryAt = String( post?.nextRetryAt || '' ).trim();
    if ( status === 'rejected' ) {
      return 'This draft was rejected and is no longer eligible for publishing until it is explicitly regenerated.';
    }
    if ( status === 'pending_retry' ) {
      const lead = failureMessage || 'Post saved. TODD hit a platform blocker.';
      return `${lead}${nextRetryAt ? ` TODD will retry automatically around ${new Date( nextRetryAt ).toLocaleString()}.` : ' TODD will retry automatically.'}`;
    }
    if ( status === 'failed_permanent' ) {
      return failureMessage || 'Publishing failed too many times. You can copy this post or send it through another platform.';
    }
    if ( status === 'rejected_by_subreddit' ) {
      return failureMessage || 'This Reddit community rejected the post. Edit it so it feels more helpful and less promotional.';
    }
    return failureMessage;
  }
}

import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';

import { BackToTopComponent } from '../../../shared/back-to-top/back-to-top.component';

import { SocialAuthService } from '../../../services/social-auth.service';
import { NotificationService } from '../../../services/notification.service';
import { SocialApiService, SocialPost } from '../../../services/social-api.service';

import { SocialAccountService } from '../services/social-account.service';
import { SocialQueueService, SocialQueuePostPayload } from '../services/social-queue.service';
import { SocialPlatformContextService } from '../services/social-platform-context.service';

// Calendar is the shared lifecycle view for social work. Maya plans the day
// for drafts and TODD chooses the exact time on approval; published posts
// remain on the same calendar so their engagement context is not separated
// into another navigation surface.
interface CalendarDay {
  date: Date;
  dateKey: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  posts: SocialPost[];
}

function toDateKey ( date: Date ): string {
  const year = date.getFullYear();
  const month = String( date.getMonth() + 1 ).padStart( 2, '0' );
  const day = String( date.getDate() ).padStart( 2, '0' );
  return `${year}-${month}-${day}`;
}

function dateKeyFromIso ( iso?: string | null ): string {
  if ( !iso ) return '';
  const parsed = new Date( iso );
  if ( Number.isNaN( parsed.getTime() ) ) return '';
  return toDateKey( parsed );
}

@Component( {
  selector: 'app-social-outreach-calendar',
  standalone: true,
  imports: [CommonModule, RouterModule, BackToTopComponent],
  templateUrl: './calendar.component.html',
  styleUrl: './social-outreach-calendar.component.css'
} )
export class SocialOutreachCalendarComponent implements OnInit, OnDestroy {
  private readonly authService = inject( SocialAuthService );
  private readonly notificationService = inject( NotificationService );
  private readonly outreachApi = inject( SocialApiService );
  private readonly accountService = inject( SocialAccountService );
  private readonly queueService = inject( SocialQueueService );
  private readonly platformContextService = inject( SocialPlatformContextService );

  private readonly subscription = new Subscription();

  loading = false;
  isLoggedIn = false;
  tenantId: string | null = null;
  userId: string | null = null;
  userEmail: string | null = null;

  monthCursor = new Date();
  weeks: CalendarDay[][] = [];
  draftActionState: Record<string, { action: string; label: string; }> = {};

  // Rejected/archived drafts pile up fast during iteration (a single
  // drafting run can leave dozens of rejected variants behind) and were
  // crowding out the much rarer, more important approved/posted content on
  // the same days. Hidden by default; the toggle below reveals them again.
  showRejected = false;
  private static readonly HIDDEN_BY_DEFAULT_STATUSES = new Set( [
    'rejected',
    'rejected_by_subreddit',
    'archived'
  ] );

  private posts: SocialPost[] = [];
  private selectedPlatforms: Record<string, boolean> = {};

  get currentQueryParams (): Record<string, string> {
    return {};
  }

  get monthLabel (): string {
    return this.monthCursor.toLocaleDateString( undefined, { month: 'long', year: 'numeric' } );
  }

  ngOnInit (): void {
    this.subscription.add(
      this.authService.getTenantId().subscribe( tenantId => {
        this.tenantId = tenantId;
        this.isLoggedIn = tenantId != null && tenantId !== '';
        if ( tenantId ) this.loadPosts();
      } )
    );
    this.subscription.add(
      this.authService.getUserId().subscribe( userId => {
        this.userId = userId || null;
      } )
    );
    this.subscription.add(
      this.authService.getUser().subscribe( user => {
        this.userEmail = user?.email || null;
      } )
    );
    this.subscription.add(
      this.platformContextService.selectedPlatforms$.subscribe( platforms => {
        this.selectedPlatforms = platforms;
        this.buildCalendar();
      } )
    );

    this.buildCalendar();
  }

  ngOnDestroy (): void {
    this.subscription.unsubscribe();
  }

  platformLabel ( platform?: string ): string {
    return this.accountService.platformLabel( platform );
  }

  statusLabel ( post: SocialPost ): string {
    if ( post?.publishedTimestamp || post?.externalPlatformPostId || ( post as any )?.publishOutcome === 'published' ) return 'Posted';
    return this.queueService.postStatusLabel( post );
  }

  statusTone ( post: SocialPost ): 'positive' | 'waiting' {
    return this.statusLabel( post ) === 'Posted' || post.status === 'approved' ? 'positive' : 'waiting';
  }

  isDraftActionBusy ( post: SocialPost ): boolean {
    return !!( post.postId && this.draftActionState[post.postId] );
  }

  draftBusyLabel ( post: SocialPost ): string {
    return post.postId ? this.draftActionState[post.postId]?.label || '' : '';
  }

  previousMonth (): void {
    this.monthCursor = new Date( this.monthCursor.getFullYear(), this.monthCursor.getMonth() - 1, 1 );
    this.buildCalendar();
  }

  nextMonth (): void {
    this.monthCursor = new Date( this.monthCursor.getFullYear(), this.monthCursor.getMonth() + 1, 1 );
    this.buildCalendar();
  }

  goToToday (): void {
    this.monthCursor = new Date();
    this.buildCalendar();
  }

  toggleShowRejected (): void {
    this.showRejected = !this.showRejected;
    this.buildCalendar();
  }

  approvePost ( post: SocialPost ): void {
    if ( !post?.postId ) return;
    const payload = this.buildPayload( post, { status: 'approved', socialAccountId: post.socialAccountId } );
    void this.queueService.approvePost(
      post, payload, this.draftActionState, this.requestContext(),
      ( p: string ) => this.platformLabel( p ),
      ( savedPost: SocialPost ) => this.upsertPost( savedPost )
    );
  }

  rejectPost ( post: SocialPost ): void {
    if ( !post?.postId ) return;
    const payload = this.buildPayload( post, { status: 'rejected', approvedAt: null, scheduledFor: null } );
    void this.queueService.rejectPost(
      post, payload, this.draftActionState, this.requestContext(),
      ( p: string ) => this.platformLabel( p ),
      ( savedPost: SocialPost ) => this.upsertPost( savedPost )
    );
  }

  private loadPosts (): void {
    this.loading = true;
    this.outreachApi.listSocialPosts(
      { limit: 100 },
      this.requestContext()
    ).subscribe( {
      next: response => {
        this.posts = response?.data || [];
        this.loading = false;
        this.buildCalendar();
      },
      error: () => {
        this.loading = false;
        this.notificationService.show( 'Load Error', 'Unable to load the social calendar right now.', 'error' );
      }
    } );
  }

  private upsertPost ( post: SocialPost ): void {
    if ( !post?.postId ) return;
    const idx = this.posts.findIndex( p => p.postId === post.postId );
    // Approved/rejected posts leave the calendar's working set (draft +
    // approved) the moment they're no longer in one of those two statuses.
    const stillRelevant = post.status !== 'rejected' && post.status !== 'archived';
    if ( idx >= 0 ) {
      this.posts = stillRelevant
        ? [...this.posts.slice( 0, idx ), post, ...this.posts.slice( idx + 1 )]
        : [...this.posts.slice( 0, idx ), ...this.posts.slice( idx + 1 )];
    } else if ( stillRelevant ) {
      this.posts = [post, ...this.posts];
    }
    this.buildCalendar();
  }

  private requestContext (): { tenantId?: string; userId?: string; userEmail?: string; } {
    return {
      tenantId: this.tenantId || undefined,
      userId: this.userId || undefined,
      userEmail: this.userEmail || undefined
    };
  }

  private buildPayload ( post: SocialPost, overrides: Partial<SocialPost> = {} ): SocialQueuePostPayload {
    return {
      actionId: post.actionId || null,
      planId: post.planId || null,
      strategyId: post.strategyId || null,
      segmentId: post.segmentId || null,
      angleId: post.angleId || null,
      sourceContentReference: post.sourceContentReference,
      platform: String( post.platform || '' ),
      socialAccountId: String( overrides.socialAccountId ?? post.socialAccountId ?? '' ),
      subreddit: String( post.subreddit || '' ),
      mediaAttachment: post.mediaAttachment || null,
      content: String( post.content || '' ),
      status: String( overrides.status ?? post.status ?? 'draft' ),
      strategyContext: post.strategyContext || null,
      followThroughPlan: post.followThroughPlan || null,
      identityContext: post.identityContext || null,
      offerContext: post.offerContext || null,
      identityReview: post.identityReview || null,
      approvedAt: overrides.approvedAt !== undefined ? overrides.approvedAt : ( post.approvedAt || null ),
      scheduledFor: overrides.scheduledFor !== undefined ? overrides.scheduledFor : ( post.scheduledFor || null ),
      manualReviewRequired: !!post.manualReviewRequired,
      returnedToDraftAt: post.returnedToDraftAt || null,
      engagementSignal: post.engagementSignal || null,
      followUpSuggestion: post.followUpSuggestion || null,
      redditSafety: post.redditSafety || null,
      publishedTimestamp: post.publishedTimestamp || null,
      externalPlatformPostId: post.externalPlatformPostId || null
    };
  }

  // The day a post belongs on: plannedForDate for drafts (Maya's chosen
  // day), or the date portion of scheduledFor once TODD has picked the
  // exact time within that day on approval. Older posts with neither fall
  // back to their last-updated day so nothing silently disappears from the
  // grid.
  private dateKeyForPost ( post: SocialPost ): string {
    return (
      dateKeyFromIso( post.publishedTimestamp ) ||
      dateKeyFromIso( post.scheduledFor ) ||
      post.plannedForDate ||
      dateKeyFromIso( post.updatedAt ) ||
      ''
    );
  }

  private buildCalendar (): void {
    const visiblePosts = this.posts.filter( post => {
      const platform = String( post.platform || '' ).trim().toLowerCase();
      if ( this.selectedPlatforms[platform] === false ) return false;
      const status = String( post.status || '' ).trim().toLowerCase();
      if ( !this.showRejected && SocialOutreachCalendarComponent.HIDDEN_BY_DEFAULT_STATUSES.has( status ) ) return false;
      return true;
    } );

    const postsByDay = new Map<string, SocialPost[]>();
    visiblePosts.forEach( post => {
      const key = this.dateKeyForPost( post );
      if ( !key ) return;
      const bucket = postsByDay.get( key ) || [];
      bucket.push( post );
      postsByDay.set( key, bucket );
    } );

    const year = this.monthCursor.getFullYear();
    const month = this.monthCursor.getMonth();
    const firstOfMonth = new Date( year, month, 1 );
    const gridStart = new Date( year, month, 1 - firstOfMonth.getDay() );
    const todayKey = toDateKey( new Date() );

    const weeks: CalendarDay[][] = [];
    let cursor = new Date( gridStart );
    for ( let week = 0; week < 6; week++ ) {
      const days: CalendarDay[] = [];
      for ( let day = 0; day < 7; day++ ) {
        const dateKey = toDateKey( cursor );
        days.push( {
          date: new Date( cursor ),
          dateKey,
          isCurrentMonth: cursor.getMonth() === month,
          isToday: dateKey === todayKey,
          posts: postsByDay.get( dateKey ) || []
        } );
        cursor = new Date( cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1 );
      }
      weeks.push( days );
    }
    this.weeks = weeks;
  }
}

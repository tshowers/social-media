import { ChangeDetectionStrategy, Component, EventEmitter, HostListener, Input, Output, computed, inject, signal } from '@angular/core';

import { NotificationService } from '../services/notification.service';
import { Router } from '@angular/router';

import { ChannelResult, MayaSocialApi, Post } from './api';
import { STATUS_LABELS, addDays, channelList, clock, monthDay, pillarOf, relativeDayAt, slotLabel, wallClock, weekdayLong } from './format';
import { HelpPopComponent } from './help-pop.component';
import { IconComponent } from './icon.component';
import { ImageBlockComponent } from './image-block.component';
import { MayaSocialState } from './state';

/**
 * Post detail (gaps 2j): a 440px drawer on the right, under the header,
 * from any card in Week, Month or Queue. What it says and offers depends on
 * the post's status. A bottom sheet on a phone.
 */
@Component( {
  selector: 'ms-post-drawer',
  standalone: true,
  imports: [IconComponent, HelpPopComponent, ImageBlockComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .drawer {
      position: fixed; top: 82px; right: 0; bottom: 0; z-index: 35; display: flex; flex-direction: column; gap: 14px;
      width: 440px; padding: 24px 28px 24px; overflow: auto; border-top-left-radius: 28px;
      background: var(--bg); box-shadow: -20px 0 50px rgba(15, 17, 21, .16);
    }
    .top { display: flex; align-items: center; gap: 8px; }
    .top .close { margin-left: auto; }
    .close { display: grid; place-items: center; width: 40px; height: 40px; min-height: 0; padding: 0; border: 0; border-radius: 50%; background: var(--surface); color: var(--text); box-shadow: none; }
    .close:hover { background: var(--surface2); transform: none; }
    .slot { font-size: 16px; font-weight: 700; }
    .channels { margin-top: 2px; font-size: 14px; color: var(--muted); }
    h2 { font-size: 24px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.2; }
    .note { display: flex; align-items: flex-start; gap: 8px; font-size: 14px; font-weight: 700; color: var(--t-pink-fg); }
    .body { font-size: 15px; line-height: 1.6; color: var(--muted); white-space: pre-line; }
    .info { font-size: 14px; line-height: 1.5; color: var(--muted); }
    .info strong { color: var(--text); }
    .spacer { flex: 1; }
    .title-edit { display: grid; grid-template-columns: 1fr auto; gap: 8px; }
    .rows { display: flex; flex-direction: column; gap: 8px; }
    .row { display: grid; grid-template-columns: 16px auto 1fr auto; gap: 10px; align-items: center; min-height: 50px; padding: 6px 8px 6px 18px; border-radius: 999px; background: var(--surface); font-size: 15px; }
    .row ms-icon { color: var(--t-green-fg); }
    .row span { font-size: 13px; color: var(--muted); text-align: right; }
    .row.is-failed { background: var(--t-pink); color: var(--t-pink-fg); }
    .row.is-failed ms-icon, .row.is-failed span { color: inherit; }
    .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--surface2); }
    .actions { display: grid; grid-auto-columns: 1fr; grid-auto-flow: column; gap: 10px; }
    .actions .ms-btn { height: 48px; padding: 0 12px; }
    @media (max-width: 760px) {
      .drawer { top: auto; left: 0; width: auto; max-height: 85vh; border-radius: 32px 32px 0 0; padding-bottom: calc(24px + env(safe-area-inset-bottom)); box-shadow: 0 -20px 50px rgba(15, 17, 21, .2); }
      .drawer::before { content: ""; align-self: center; width: 40px; height: 5px; margin: -10px 0 4px; border-radius: 999px; background: var(--surface2); }
    }
  `],
  template: `
    <aside class="drawer" role="dialog" aria-modal="false" [attr.aria-label]="post.title">
      <div class="top">
        <span class="ms-chip ms-status" [attr.data-status]="post.status">{{ status() }}</span>
        <span class="ms-chip" [attr.data-tint]="pillar().tint">{{ pillar().name }}</span>
        @if (post.pinned) { <span class="ms-pinned"><ms-icon name="pin" [size]="12" />Pinned</span><ms-help class="ms-help--small" topic="pinned" /> }
        <button type="button" class="close" aria-label="Close" (click)="closed.emit()"><ms-icon name="x" [size]="18" [stroke]="2.75" /></button>
      </div>
      <div>
        <div class="slot">{{ slot() }}</div>
        <div class="channels">{{ channels() }}</div>
      </div>
      <h2>{{ post.title }}</h2>
      @if (post.rewriteCount && post.status === 'needs_review') {
        <p class="note"><img class="ms-avatar ms-avatar--22" src="assets/maya-avatar.png" alt="" />You held the first draft. This is my rewrite.</p>
      }
      @if (post.status === 'on_hold') {
        <p class="note"><img class="ms-avatar ms-avatar--22" src="assets/maya-avatar.png" alt="" />{{ post.holdCount && post.holdCount > 1 ? 'Held twice. I’ve stopped rewriting it.' : 'You held this. I’m writing a new version.' }}</p>
      }
      @if (post.body) { <p class="body">{{ post.body }}</p> }
      @if (post.image && post.status !== 'planned') { <ms-image-block [post]="post" variant="block" (changed)="changed.emit($event)" /> }
      @if (post.status === 'planned') {
        <div class="title-edit">
          <label class="ms-sr-only" for="drawer-title">Title</label>
          <input id="drawer-title" class="ms-input" [value]="post.title" #titleInput />
          <button type="button" class="ms-btn ms-btn--44" [disabled]="busy()" (click)="saveTitle(titleInput.value)">Save title</button>
        </div>
      }
      @if (post.status === 'posted' && post.channelResults?.length) {
        <div class="rows">
          @for (row of post.channelResults; track row.channel) {
            <div class="row" [class.is-failed]="row.status === 'failed'">
              @if (row.status === 'failed') { <ms-icon name="alert" [size]="16" /> } @else if (row.status === 'posted') { <ms-icon name="check" [size]="16" [stroke]="3" /> } @else { <span class="dot"></span> }
              <strong>{{ channelName(row.channel) }}</strong>
              <span>{{ rowText(row) }}</span>
              @if (row.status === 'posted' && row.url) {
                <a class="ms-btn ms-btn--bg ms-btn--36" [href]="row.url" target="_blank" rel="noopener">View <ms-icon name="arrow-up-right" [size]="12" /></a>
              } @else if (row.status === 'failed') {
                <button type="button" class="ms-btn ms-btn--primary ms-btn--36" [disabled]="busy()" (click)="retry(row.channel)"><ms-icon name="refresh" [size]="13" />Retry</button>
              }
            </div>
          }
        </div>
      }
      <p class="info">{{ info() }}</p>
      <div class="spacer"></div>
      <div class="actions">
        @switch (post.status) {
          @case ('needs_review') {
            <button type="button" class="ms-btn ms-btn--primary" [disabled]="busy()" (click)="approve()">Approve</button>
            <button type="button" class="ms-btn" (click)="edit.emit(post)">Edit</button>
            @if (post.pinned) {
              <button type="button" class="ms-btn" [disabled]="busy()" (click)="unpin()">Unpin</button>
            } @else {
              <button type="button" class="ms-btn" [disabled]="busy()" (click)="hold()">Hold</button>
            }
          }
          @case ('on_hold') {
            @if (post.body) { <button type="button" class="ms-btn ms-btn--primary" [disabled]="busy()" (click)="approve()">{{ heldTwice() ? 'Approve' : 'Approve this version' }}</button> }
            @if (post.body) { <button type="button" class="ms-btn" (click)="edit.emit(post)">Edit it yourself</button> }
            @if (heldTwice()) { <button type="button" class="ms-btn" [disabled]="busy()" (click)="drop()">Drop this post</button> }
          }
          @case ('expired') {
            <button type="button" class="ms-btn ms-btn--primary" (click)="duplicate()">Duplicate as new post</button>
          }
          @case ('approved') {
            <button type="button" class="ms-btn" (click)="edit.emit(post)">Edit</button>
            <button type="button" class="ms-btn" [disabled]="busy()" (click)="undo()">Undo approval</button>
          }
          @case ('drafted') {
            <button type="button" class="ms-btn ms-btn--primary" [disabled]="busy()" (click)="approve()">Approve early</button>
            <button type="button" class="ms-btn" (click)="edit.emit(post)">Edit</button>
            @if (post.pinned) {
              <button type="button" class="ms-btn" [disabled]="busy()" (click)="unpin()">Unpin</button>
            } @else {
              <button type="button" class="ms-btn" [disabled]="busy()" (click)="hold()">Hold</button>
            }
          }
          @case ('planned') {
            @if (post.pinned) { <button type="button" class="ms-btn" [disabled]="busy()" (click)="unpin()">Unpin</button> }
          }
        }
      </div>
    </aside>
  `,
} )
export class PostDrawerComponent {
  @Input( { required: true } ) post!: Post;
  @Output() closed = new EventEmitter<void>();
  @Output() changed = new EventEmitter<Post>();
  @Output() edit = new EventEmitter<Post>();
  /** Something moved other posts too; the calendar should reload. */
  @Output() reload = new EventEmitter<void>();

  private readonly api = inject( MayaSocialApi );
  private readonly state = inject( MayaSocialState );
  private readonly notifications = inject( NotificationService );
  readonly busy = signal( false );

  readonly pillar = computed( () => pillarOf( this.state.strategy(), this.post.pillar ) );
  readonly slot = computed( () => slotLabel( this.post, this.state.today() ) );
  readonly channels = computed( () => channelList( this.post.channels, this.state.channelNames(), this.state.strategy()?.channels.length ?? 0 ) );
  readonly status = computed( () => STATUS_LABELS[this.post.status] );

  /** The line above the actions (2j table). */
  readonly info = computed( () => {
    const base = this.statusInfo();
    if ( !this.post.pinned || ['posted', 'expired'].includes( this.post.status ) ) return base;
    return `Pinned to this date. It never moves, and it expires if it isn’t approved by ${ wallClock( this.post.time ) }. ${ base }`;
  } );

  private readonly statusInfo = computed( () => {
    const post = this.post;
    const tz = this.state.timeZone();
    const today = this.state.today();
    switch ( post.status ) {
      case 'needs_review':
        return post.autoApproveAt ? `Auto-approves at ${ clock( post.autoApproveAt, tz ) } unless you hold it.` : '';
      case 'on_hold':
        return 'If its slot arrives still held, nothing goes out that day and every unpinned post behind it moves back a day.';
      case 'approved':
        return `Goes out ${ this.slot().replace( /^Today/, 'today' ) }.`;
      case 'drafted':
        return post.reviewOpensAt
          ? `I’ll send it for review ${ relativeDayAt( post.reviewOpensAt, tz, today ).replace( /^(Today|Tomorrow)/, ( day ) => day.toLowerCase() ) }. Approve it early if it’s ready.`
          : 'Written and waiting for its review window.';
      case 'planned': {
        const writeOn = addDays( post.slotDate, -3 );
        return writeOn <= today
          ? 'Title only. I’m writing the copy and image now.'
          : `Title only. I write the copy and image on ${ weekdayLong( writeOn ) }, ${ monthDay( writeOn ) }, three days ahead.`;
      }
      case 'posted':
        return `Posted ${ this.slot().replace( /^Today/, 'today' ) }.`;
      case 'expired':
        return `Not approved by ${ this.slot().replace( /^.* at /, '' ) }. Didn’t post.`;
      case 'paused':
        return 'Nothing was connected when its slot came, so it didn’t post. Skipped posts aren’t posted late.';
      default:
        return '';
    }
  } );

  @HostListener( 'document:keydown.escape' )
  onEscape (): void {
    this.closed.emit();
  }

  readonly heldTwice = computed( () => this.post.status === 'on_hold' && ( this.post.holdCount ?? 0 ) >= 2 );
  private readonly router = inject( Router );

  channelName ( key: string ): string {
    return this.state.channelNames()[key] || key;
  }

  rowText ( row: ChannelResult ): string {
    switch ( row.status ) {
      case 'posted': return row.postedAt ? clock( row.postedAt, this.state.timeZone() ) : 'Posted';
      case 'failed': return ['account_reauth_required', 'account_disconnected', 'stale_social_account_binding', 'missing_social_account'].includes( row.reason ?? '' ) ? 'Signed out' : ( row.error || 'Failed' );
      case 'skipped': return 'Skipped';
      default: return 'Sending…';
    }
  }

  retry ( channel: string ): void { this.run( this.api.channelAction( this.post.id, channel, 'retry' ) ); }

  saveTitle ( title: string ): void {
    if ( !title.trim() || title.trim() === this.post.title ) return;
    this.run( this.api.editTitle( this.post.id, title.trim() ) );
  }

  unpin (): void {
    this.busy.set( true );
    this.api.unpin( this.post.id ).subscribe( {
      next: ( { post } ) => {
        this.busy.set( false );
        this.notifications.show( 'Unpinned', `It takes the next ${ this.pillar().name } slot: ${ slotLabel( post, this.state.today() ) }.`, 'success' );
        this.changed.emit( post );
        this.reload.emit();
      },
      error: () => this.failed(),
    } );
  }

  drop (): void {
    this.busy.set( true );
    this.api.drop( this.post.id ).subscribe( {
      next: () => {
        this.busy.set( false );
        this.notifications.show( 'Dropped', 'The posts behind it moved up a day.', 'success' );
        this.closed.emit();
        this.reload.emit();
      },
      error: () => this.failed(),
    } );
  }

  /** 2o: an expired post's copy, as a new post. */
  duplicate (): void {
    void this.router.navigate( ['/new'], { state: { body: [this.post.title, this.post.body].filter( Boolean ).join( '\n\n' ) } } );
  }

  private failed (): void {
    this.busy.set( false );
    this.notifications.show( 'That didn’t save', 'Try again.', 'error' );
  }

  approve (): void { this.run( this.api.approve( this.post.id ) ); }
  hold (): void { this.run( this.api.hold( this.post.id ) ); }
  undo (): void { this.run( this.api.undoApprove( this.post.id ) ); }

  private run ( call: ReturnType<MayaSocialApi['approve']> ): void {
    this.busy.set( true );
    call.subscribe( {
      next: ( saved ) => {
        this.busy.set( false );
        this.changed.emit( saved );
      },
      error: () => this.failed(),
    } );
  }
}

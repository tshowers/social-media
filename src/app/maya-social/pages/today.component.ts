import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { NotificationService } from '../../services/notification.service';
import { ChannelResult, MayaSocialApi, Post } from '../api';
import { EditSheetComponent } from '../edit-sheet.component';
import {
  STATUS_LABELS, addDays, channelList, clock, dayOfMonth, localDateKey, longDate, monthDay, pillarOf, plural,
  relativeDayAt, slotLabel, wallClock, weekdayLong, weekdayShort,
} from '../format';
import { HelpPopComponent } from '../help-pop.component';
import { IconComponent } from '../icon.component';
import { MayaSocialState } from '../state';
import { ChannelConnect, ChannelWarningComponent, FirstStrategyBannerComponent, LoadErrorComponent, NoChannelsComponent, NotSetUpComponent, SkeletonComponent } from '../states.component';
import { PostChannelsComponent } from '../post-channels.component';
import { ImageBlockComponent } from '../image-block.component';

const PENDING = ['needs_review', 'on_hold'];

/**
 * Today (design 1a, Briefing): the posts that need you, each with Approve
 * now / Edit / Hold, and the rail - what goes out next, the plan horizon
 * and the strategy.
 */
@Component( {
  selector: 'ms-today',
  standalone: true,
  imports: [RouterLink, HelpPopComponent, IconComponent, EditSheetComponent, ChannelWarningComponent, FirstStrategyBannerComponent, LoadErrorComponent, NotSetUpComponent, SkeletonComponent, NoChannelsComponent, PostChannelsComponent, ImageBlockComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .grid { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 40px; align-items: start; }
    .main, .rail { min-width: 0; }
    .main { display: flex; flex-direction: column; gap: 24px; }
    .intro { display: flex; flex-direction: column; gap: 10px; }
    .notices { display: flex; flex-direction: column; gap: 10px; }

    .card { display: grid; grid-template-columns: minmax(0, 1fr) 220px; gap: 28px; padding: 24px; border-radius: 28px; background: var(--surface); }
    .card.is-held { box-shadow: inset 0 0 0 2px var(--pink); }
    .card.has-image { grid-template-columns: 200px minmax(0, 1fr) 220px; gap: 24px; }
    .meta { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; font-size: 13px; font-weight: 600; color: var(--muted); }
    .rewrite { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; font-size: 14px; font-weight: 700; color: var(--t-pink-fg); }
    .card h2 { margin-bottom: 10px; font-size: 21px; font-weight: 700; letter-spacing: -0.01em; }
    .card .body { font-size: 15px; line-height: 1.6; color: var(--muted); white-space: pre-line; }
    .side { display: flex; flex-direction: column; gap: 10px; }
    .slot { font-size: 15px; font-weight: 700; }
    .auto { margin-bottom: 6px; font-size: 13px; line-height: 1.5; color: var(--muted); }
    .auto ms-help { margin-left: 4px; }
    .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .pair .ms-btn { padding: 0 12px; }
    .hold { gap: 6px; padding: 0 10px 0 0; cursor: default; }
    .hold-btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 6px; flex: 1; align-self: stretch;
      min-height: 0; margin: 0; padding: 0 0 0 12px; border: 0; border-radius: 999px; background: transparent;
      color: inherit; font: inherit; box-shadow: none; transform: none;
    }
    .hold-btn:hover { transform: none; }
    .hold-btn:disabled { opacity: .5; }
    .hold-btn:focus-visible { outline: 2px solid var(--blue) !important; outline-offset: 2px; box-shadow: none !important; }
    .results { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
    .result { display: grid; grid-template-columns: 16px 1fr auto auto; gap: 10px; align-items: center; min-height: 48px; padding: 6px 8px 6px 16px; border-radius: 999px; background: var(--bg); font-size: 14px; }
    .result ms-icon { color: var(--t-green-fg); }
    .result span { font-size: 13px; color: var(--muted); text-align: right; }
    .result.is-failed { grid-template-columns: 16px auto 1fr; min-height: 36px; background: var(--t-pink); color: var(--t-pink-fg); }
    .result.is-failed ms-icon, .result.is-failed span { color: inherit; text-align: left; }
    .held-note { margin-top: 8px; }
    .my-edit { margin-top: 10px; padding: 16px 18px; border-radius: 20px; background: var(--bg); }
    .my-edit .ms-label { display: block; margin-bottom: 6px; font-size: 12px; }
    .my-edit p { font-size: 15px; line-height: 1.55; }
    .drop-note { font-size: 12px; color: var(--muted); text-align: center; }
    .card.is-held .side .ms-btn--block + .ms-btn--block { margin-top: 0; }
    .knock { margin: -12px 24px 0; font-size: 14px; line-height: 1.5; color: var(--muted); }

    .approved { display: flex; align-items: center; gap: 12px; padding: 18px 24px; border-radius: 28px; background: var(--t-green); color: var(--t-green-fg); font-size: 15px; line-height: 1.5; }
    .approved .tick { display: grid; place-items: center; flex: none; width: 28px; height: 28px; border-radius: 50%; background: var(--bg); }
    .approved span { flex: 1; }
    .approved .ms-btn { color: var(--text); }

    .empty { display: flex; flex-direction: column; align-items: flex-start; gap: 14px; padding: 28px; border-radius: 28px; background: var(--surface); }
    .empty p { font-size: 16px; line-height: 1.6; color: var(--muted); }

    .rail { display: flex; flex-direction: column; gap: 14px; }
    .rail .ms-card { display: flex; flex-direction: column; gap: 14px; }
    .next { display: grid; grid-template-columns: 64px 1fr; gap: 8px 12px; }
    .next .day { font-size: 13px; font-weight: 700; padding-top: 2px; }
    .next .title { font-size: 14px; font-weight: 600; line-height: 1.35; }
    .next .line { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-top: 4px; font-size: 12px; color: var(--muted); }
    .next .gap { font-size: 13px; font-weight: 600; color: var(--t-yellow-fg); }
    .open { font-size: 14px; font-weight: 700; text-decoration: none; }
    .plan { background: var(--t-green); color: var(--t-green-fg); }
    .plan h3 { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; }
    .plan p { font-size: 14px; line-height: 1.5; }
    .strategy { color: var(--text); text-decoration: none; }
    .strategy p { font-size: 15px; font-weight: 700; line-height: 1.4; }
    .strategy:hover { background: var(--surface2); }
    .loading { display: flex; align-items: center; gap: 10px; color: var(--muted); }

    /* 4d tablet: one column, actions in a row, Going out next and Plan side by side. */
    @media (max-width: 1000px) {
      .grid { grid-template-columns: minmax(0, 1fr); }
      .card, .card.has-image { grid-template-columns: 1fr; gap: 14px; }
      .side { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 10px; align-items: end; }
      .side .slot, .side .auto { grid-column: 1 / -1; }
      .pair { display: contents; }
      .rail { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
      .rail .strategy { display: none; }
    }
    @media (max-width: 760px) {
      .side { display: flex; flex-direction: column; }
      .pair { display: grid; }
      .rail { display: flex; flex-direction: column; }
      .card, .card.has-image { grid-template-columns: 1fr; gap: 16px; padding: 20px; }
      .card .ms-btn--46 { height: 50px; }
      .card .pair .ms-btn { height: 44px; }
      .knock { margin: -8px 8px 0; }
    }
  `],
  template: `
    @if (!state.overview()?.onboardedAt) {
      <ms-not-set-up />
    } @else if (loadError() !== undefined) {
      <ms-load-error [status]="loadError() ?? null" (retry)="retry()" />
    } @else if (loading()) {
      <ms-skeleton />
    } @else if (strategy() && state.publishingPaused()) {
      <ms-no-channels />
    } @else {
    <main class="ms-page">
      <div class="grid">
        <div class="main">
          @if (!strategy() && state.overview()?.pendingStrategy) {
            <ms-first-strategy-banner (regenerate)="regenerate()" />
          }
          <ms-channel-warning />
          @if (state.overview()?.pendingStrategy && strategy()) {
            <div class="ms-notice" data-tint="blue" role="status">
              <span><strong>I’m suggesting changes to your strategy.</strong> Nothing changes until you approve them.</span>
              <a class="ms-btn ms-btn--bg ms-btn--36" routerLink="/strategy">Review</a>
            </div>
          }

          <div class="intro">
            <p class="ms-kicker">{{ longToday() }}</p>
            <h1 class="ms-h1">{{ headline() }}</h1>
            @if (mayaLine(); as line) {
              <p class="ms-maya-line"><img class="ms-avatar" src="assets/maya-avatar.png" alt="" />{{ line }}</p>
            }
          </div>

          @if (!strategy() && !state.overview()?.pendingStrategy) {
            <div class="empty">
              <p>I need a strategy before I can plan anything. I’ll build it from your profile, and nothing goes on the calendar until you’ve approved it.</p>
              <a class="ms-btn ms-btn--primary ms-btn--46" routerLink="/strategy">Set up my strategy</a>
            </div>
          }

          @for (post of failed(); track post.id) {
            <!-- 2n -->
            <article class="card" [attr.aria-labelledby]="'failed-' + post.id">
              <div>
                <div class="meta">
                  <span class="ms-chip ms-status" data-status="failed">Failed on {{ failedNames(post) }}</span>
                  <span class="ms-chip" [attr.data-tint]="pillar(post).tint">{{ pillar(post).name }}</span>
                </div>
                <h2 [id]="'failed-' + post.id">{{ post.title }}</h2>
                <div class="results">
                  @for (row of post.channelResults ?? []; track row.channel) {
                    @if (row.status === 'failed') {
                      <div class="result is-failed"><ms-icon name="alert" [size]="16" /><strong>{{ channelName(row.channel) }}</strong><span>{{ failureText(row) }}</span></div>
                    } @else {
                      <div class="result">
                        @if (row.status === 'posted') { <ms-icon name="check" [size]="16" [stroke]="3" /> } @else { <span class="ms-spinner" aria-hidden="true"></span> }
                        <strong>{{ channelName(row.channel) }}</strong>
                        <span>{{ row.status === 'posted' ? 'Posted ' + wallClockOf(post) : row.status === 'skipped' ? 'Skipped' : 'Retrying' }}</span>
                        @if (row.url) { <a class="ms-btn ms-btn--bg ms-btn--36" [href]="row.url" target="_blank" rel="noopener">View</a> }
                      </div>
                    }
                  }
                </div>
              </div>
              <div class="side">
                <div class="slot">Was due {{ wallClockOf(post) }}</div>
                <p class="auto">I can retry until 9:00 PM tonight. After that I drop {{ failedNames(post) }} for this post.</p>
                @for (row of failedRows(post); track row.channel) {
                  @if (isSignInError(row) && !state.isConnected(row.channel)) {
                    <button type="button" class="ms-btn ms-btn--primary ms-btn--46 ms-btn--block" (click)="reconnectAndRetry(post, row.channel)">Reconnect and retry</button>
                  } @else {
                    <button type="button" class="ms-btn ms-btn--primary ms-btn--46 ms-btn--block" [disabled]="busy() === post.id" (click)="channelAction(post, row.channel, 'retry')">Retry now</button>
                  }
                  <button type="button" class="ms-btn ms-btn--bg ms-btn--block" [disabled]="busy() === post.id" (click)="channelAction(post, row.channel, 'skip')">Skip {{ channelName(row.channel) }}</button>
                }
              </div>
            </article>
          }

          @for (post of offStrategy(); track post.id) {
            <!-- 2h -->
            <article class="card" [attr.aria-labelledby]="'off-' + post.id">
              <div>
                <div class="meta">
                  <span class="ms-chip" data-tint="pink">Off-strategy</span><ms-help class="ms-help--small" topic="offStrategy" />
                  <span>{{ post.source === 'user' ? 'Your post' : 'My post' }}@if (post.approvedAt) { · approved {{ approvedOn(post) }}} ·</span>
                  <ms-post-channels [channels]="post.channels" />
                </div>
                <h2 [id]="'off-' + post.id">{{ post.title }}</h2>
                <p class="body">{{ post.body }}</p>
                <p class="rewrite" style="margin-top: 12px"><img class="ms-avatar ms-avatar--22" src="assets/maya-avatar.png" alt="" />{{ post.offStrategyNote }} Here’s an edit that fits.</p>
                @if (post.offStrategyEdit; as edit) {
                  <div class="my-edit">
                    <span class="ms-label">My edit · {{ pillarName(edit.pillar || post.pillar) }} pillar</span>
                    <p>{{ edit.body }}</p>
                  </div>
                }
              </div>
              <div class="side">
                <div class="slot">{{ slot(post) }}</div>
                <p class="auto">Still approved. It goes out as written unless you switch.</p>
                @if (post.offStrategyEdit) {
                  <button type="button" class="ms-btn ms-btn--primary ms-btn--46 ms-btn--block" [disabled]="busy() === post.id" (click)="offStrategyAction(post, 'use-edit')">Use my edit</button>
                }
                <div class="pair">
                  <button type="button" class="ms-btn ms-btn--bg" [disabled]="busy() === post.id" (click)="offStrategyAction(post, 'keep')">Keep yours</button>
                  <button type="button" class="ms-btn ms-btn--bg" (click)="editing.set(post)">Edit</button>
                </div>
              </div>
            </article>
          }

          @for (post of reviewList(); track post.id) {
            @if (justApproved().has(post.id)) {
              <div class="approved" role="status">
                <span class="tick"><ms-icon name="check" [size]="14" [stroke]="3" /></span>
                <span><strong>Approved.</strong> {{ post.title }} goes out {{ goesOut(post) }}.</span>
                <button type="button" class="ms-btn ms-btn--bg ms-btn--36" [disabled]="busy() === post.id" (click)="undo(post)">Undo</button>
              </div>
            } @else {
              <article class="card" [class.is-held]="post.status === 'on_hold'" [class.has-image]="!!post.image" [attr.aria-labelledby]="'post-' + post.id">
                @if (post.image) { <ms-image-block [post]="post" variant="tile" /> }
                <div>
                  <div class="meta">
                    <span class="ms-chip" [attr.data-tint]="pillar(post).tint">{{ pillar(post).name }}</span>
                    @if (post.source === 'user') { <span>Your post ·</span> }
                    <ms-post-channels [channels]="post.channels" />
                    @if (isHeldTwice(post)) { <span class="ms-chip ms-status" data-status="on_hold">Held twice</span> }
                    @else if (post.status === 'on_hold') { <span class="ms-chip ms-status" data-status="on_hold">On hold</span> }
                  </div>
                  @if (post.rewriteCount && post.status === 'needs_review') {
                    <p class="rewrite"><img class="ms-avatar ms-avatar--22" src="assets/maya-avatar.png" alt="" />You held the first draft. This is my rewrite.</p>
                  } @else if (isHeldTwice(post)) {
                    <p class="rewrite"><img class="ms-avatar ms-avatar--22" src="assets/maya-avatar.png" alt="" />You held my rewrite too. I’ll stop rewriting until you tell me what to change.</p>
                  }
                  <h2 [id]="'post-' + post.id">{{ post.title }}</h2>
                  <p class="body">{{ post.body }}</p>
                  @if (isHeldTwice(post)) {
                    <p class="body held-note">It still keeps {{ post.slotDate === today() ? 'today' : weekday(post.slotDate) }}’s slot. If it’s held at {{ wallClockOf(post) }}, nothing goes out and the {{ plural(behind(post), 'unpinned post') }} behind it move back another day.</p>
                  }
                </div>
                <div class="side">
                  <div class="slot">{{ slot(post) }}</div>
                  @if (post.status === 'needs_review' && post.autoApproveAt) {
                    <p class="auto">Auto-approves {{ autoWhen(post) }} unless you hold it{{ post.rewriteCount ? ' again' : '' }}. <ms-help topic="autoApprove" [hours]="hours()" /></p>
                  } @else if (post.status === 'on_hold') {
                    <p class="auto">Held. If its slot arrives still held, nothing goes out that day. <ms-help topic="hold" /></p>
                  }
                  @if (isHeldTwice(post)) {
                    <button type="button" class="ms-btn ms-btn--primary ms-btn--46 ms-btn--block" [disabled]="busy() === post.id" (click)="approve(post)">Approve</button>
                    <button type="button" class="ms-btn ms-btn--bg ms-btn--block" (click)="editing.set(post)">Edit it yourself</button>
                    <button type="button" class="ms-btn ms-btn--bg ms-btn--block" [disabled]="busy() === post.id" (click)="drop(post)">Drop this post</button>
                    <p class="drop-note">Drop: the posts behind it move up a day.</p>
                  } @else {
                  <button type="button" class="ms-btn ms-btn--primary ms-btn--46 ms-btn--block" [disabled]="busy() === post.id" (click)="approve(post)">Approve now</button>
                  <div class="pair">
                    <button type="button" class="ms-btn ms-btn--bg" (click)="editing.set(post)">Edit</button>
                    <!-- One pill, two buttons: "?" must not press Hold (1q). -->
                    <div class="ms-btn ms-btn--bg hold">
                      <button type="button" class="hold-btn" [disabled]="busy() === post.id || post.status === 'on_hold'" (click)="hold(post)">
                        @if (busy() === post.id + ':hold') { <span class="ms-spinner" aria-hidden="true"></span> } {{ post.status === 'on_hold' ? 'Held' : 'Hold' }}
                      </button>
                      <ms-help class="ms-help--small" topic="hold" />
                    </div>
                  </div>
                  }
                </div>
              </article>
              @if (post.rewriteCount && post.status === 'needs_review') {
                <p class="knock">If you hold it again, it keeps {{ weekday(post.slotDate) }}’s slot and the {{ plural(behind(post), 'unpinned post') }} behind it move back a day.</p>
              }
            }
          }
        </div>

        @if (strategy()) {
          <aside class="rail" aria-label="Plan">
            <section class="ms-card" aria-labelledby="next-title">
              <h2 class="ms-label" id="next-title">Going out next</h2>
              <div class="next">
                @for (day of nextDays(); track day.date) {
                  <span class="day">{{ day.label }}</span>
                  @if (day.post; as post) {
                    <div>
                      <div class="title">{{ post.title }}</div>
                      <div class="line" [attr.data-tint]="pillar(post).tint">
                        <span class="ms-dot"></span>{{ pillar(post).name }} · {{ statusLabel(post) }}
                        @if (post.pinned) { <span class="ms-pinned">Pinned</span><ms-help class="ms-help--small" topic="pinned" /> }
                        @if (post.movedBackDays) { <span class="ms-moved"><ms-icon name="moved" [size]="12" />Moved back {{ plural(post.movedBackDays, 'day') }}</span> }
                      </div>
                    </div>
                  } @else {
                    <div class="gap">{{ day.date <= (state.overview()?.plannedThrough || '') ? 'Nothing goes out. A held post kept this slot.' : 'Not planned yet' }}</div>
                  }
                }
              </div>
              <a class="open" routerLink="/calendar">Open calendar →</a>
            </section>

            @if (state.overview()?.plannedThrough; as through) {
              <section class="ms-card plan">
                <h2 class="ms-label" style="color: inherit">Plan</h2>
                <h3>Planned through {{ monthDay(through) }}</h3>
                <p>A post every day.@if (state.overview()?.nextPlanDate; as next) { I’ll plan the next two weeks on {{ weekdayLong(next) }}, {{ monthDay(next) }}.}</p>
              </section>
            }

            <a class="ms-card strategy" routerLink="/strategy">
              <h2 class="ms-label">Strategy</h2>
              <p>{{ strategy()!.pillars.length }} pillars, {{ strategy()!.channels.length }} channels. Goal: {{ strategy()!.goal }}</p>
            </a>
          </aside>
        }
      </div>
    </main>
    }

    @if (editing(); as post) {
      <ms-edit-sheet [post]="post" (saved)="edited($event)" (closed)="editing.set(null)" />
    }
  `,
} )
export class TodayComponent implements OnInit {
  readonly state = inject( MayaSocialState );
  private readonly api = inject( MayaSocialApi );
  private readonly notifications = inject( NotificationService );
  private readonly router = inject( Router );

  readonly posts = signal<Post[]>( [] );
  readonly loading = signal( true );
  /** undefined = no error; null = network; else the HTTP status. */
  readonly loadError = signal<number | null | undefined>( undefined );
  readonly busy = signal<string | null>( null );
  readonly justApproved = signal<Set<string>>( new Set() );
  readonly editing = signal<Post | null>( null );

  readonly strategy = this.state.strategy;
  readonly today = this.state.today;
  readonly hours = computed( () => this.state.overview()?.autoApproveHours ?? 6 );
  readonly longToday = computed( () => longDate( this.today() ) );

  /** Cards: posts in review or on hold, plus ones approved here (until reload). */
  readonly reviewList = computed( () => this.posts()
    .filter( ( post ) => PENDING.includes( post.status ) || this.justApproved().has( post.id ) )
    .sort( ( a, b ) => a.slotAt.localeCompare( b.slotAt ) ) );
  readonly pending = computed( () => this.reviewList().filter( ( post ) => !this.justApproved().has( post.id ) ) );

  readonly headline = computed( () => {
    if ( !this.strategy() ) return 'Nothing is planned yet.';
    const count = this.pending().length + this.failed().length + this.offStrategy().length;
    if ( !count ) return 'You’re clear for today.';
    return `${ plural( count, 'post' ) } ${ count === 1 ? 'needs' : 'need' } you today.`;
  } );

  readonly mayaLine = computed( () => {
    if ( !this.strategy() || this.loading() ) return '';
    const pending = this.pending();
    const off = this.offStrategy()[0];
    if ( off && !pending.length && !this.failed().length ) {
      return off.source === 'user' ? 'It’s yours, so I won’t change it without you. It keeps its slot either way.' : 'It’s already approved, so I won’t change it without you. It keeps its slot either way.';
    }
    const failed = this.failed()[0];
    if ( failed && !pending.length ) {
      const ok = ( failed.channelResults ?? [] ).filter( ( row ) => row.status === 'posted' ).map( ( row ) => this.channelName( row.channel ) );
      return `${ ok.length ? `“${ failed.title }” went out on ${ this.listNames( ok ) }. ` : '' }${ this.failedNames( failed ) } didn’t take it.`;
    }
    const inReview = pending.filter( ( post ) => post.status === 'needs_review' && post.autoApproveAt );
    if ( !pending.length ) {
      const next = this.posts()
        .filter( ( post ) => post.status === 'drafted' && post.reviewOpensAt )
        .sort( ( a, b ) => a.reviewOpensAt!.localeCompare( b.reviewOpensAt! ) )[0];
      return next ? `Next review: ${ relativeDayAt( next.reviewOpensAt!, this.state.timeZone(), this.today() ) }.` : 'Nothing needs you right now.';
    }
    if ( !inReview.length ) return pending.length === 1 ? 'It’s on hold. Approve or edit it before its slot, or nothing goes out that day.' : 'They’re on hold. Approve or edit them before their slots.';
    if ( pending.length === 1 ) return `It auto-approves ${ this.autoWhen( inReview[0] ) } unless you hold it.`;
    const tz = this.state.timeZone();
    const allThisAfternoon = inReview.length === pending.length && inReview.every( ( post ) => {
      if ( localDateKey( post.autoApproveAt!, tz ) !== this.today() ) return false;
      const hour = Number( new Intl.DateTimeFormat( 'en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: tz } ).format( new Date( post.autoApproveAt! ) ) );
      return hour >= 12 && hour < 18;
    } );
    const all = pending.length === 2 ? 'Both' : 'All';
    if ( allThisAfternoon ) return `${ all } auto-approve this afternoon unless you hold them.`;
    const last = inReview.map( ( post ) => post.autoApproveAt! ).sort().pop()!;
    return `${ inReview.length === pending.length ? all : 'The ones in review' } auto-approve by ${ relativeDayAt( last, tz, this.today() ).replace( /^Today at /, '' ) } unless you hold them.`;
  } );

  readonly unconnectedCount = computed( () => this.state.unconnectedChannels().length );
  readonly unconnected = computed( () => {
    const names = this.state.unconnectedChannels().map( ( channel ) => channel.name );
    return names.length > 1 ? `${ names.slice( 0, -1 ).join( ', ' ) } and ${ names[names.length - 1] }` : names.join( '' );
  } );

  readonly nextDays = computed( () => {
    const days = [];
    for ( let i = 1; i <= 6; i++ ) {
      const date = addDays( this.today(), i );
      const post = this.posts().find( ( item ) => item.slotDate === date && item.status !== 'expired' ) ?? null;
      days.push( { date, label: `${ weekdayShort( date ) } ${ dayOfMonth( date ) }`, post } );
    }
    return days;
  } );

  ngOnInit (): void {
    this.load();
  }

  load (): void {
    if ( !this.strategy() ) {
      this.loading.set( false );
      return;
    }
    this.api.posts( addDays( this.today(), -1 ), addDays( this.today(), 60 ) ).subscribe( {
      next: ( posts ) => {
        this.posts.set( posts );
        this.loading.set( false );
      },
      error: ( response ) => {
        this.loading.set( false );
        this.loadError.set( ( response as { status?: number } )?.status || null );
      },
    } );
  }

  /** 2h: posts that stopped fitting after an approved strategy change. */
  readonly offStrategy = computed( () => this.posts().filter( ( post ) => post.offStrategy && !post.offStrategyKept && ['approved', 'needs_review', 'drafted', 'planned', 'on_hold'].includes( post.status ) ) );

  pillarName ( key: string ): string {
    return pillarOf( this.strategy(), key ).name;
  }

  approvedOn ( post: Post ): string {
    return post.approvedAt ? monthDay( localDateKey( post.approvedAt, this.state.timeZone() ) ) : '';
  }

  offStrategyAction ( post: Post, action: 'use-edit' | 'keep' ): void {
    this.busy.set( post.id );
    this.api.offStrategy( post.id, action ).subscribe( {
      next: ( saved ) => {
        this.replace( saved );
        this.busy.set( null );
        if ( action === 'use-edit' ) this.notifications.show( 'Switched to my edit', `It still goes out ${ this.goesOut( saved ) }.`, 'success' );
      },
      error: ( error ) => this.fail( '', error ),
    } );
  }

  /** 2n: posts that went out today or yesterday with a channel that failed. */
  readonly failed = computed( () => this.posts().filter( ( post ) =>
    post.status === 'posted' && post.slotDate >= addDays( this.today(), -1 ) && ( post.channelResults ?? [] ).some( ( row ) => row.status === 'failed' ) ) );

  private readonly connect = inject( ChannelConnect );

  isHeldTwice ( post: Post ): boolean {
    return post.status === 'on_hold' && ( post.holdCount ?? 0 ) >= 2;
  }

  channelName ( key: string ): string {
    return this.state.channelNames()[key] || key;
  }

  listNames ( names: string[] ): string {
    return names.length > 1 ? `${ names.slice( 0, -1 ).join( ', ' ) } and ${ names[names.length - 1] }` : names.join( '' );
  }

  failedRows ( post: Post ): ChannelResult[] {
    return ( post.channelResults ?? [] ).filter( ( row ) => row.status === 'failed' );
  }

  failedNames ( post: Post ): string {
    return this.listNames( this.failedRows( post ).map( ( row ) => this.channelName( row.channel ) ) );
  }

  wallClockOf ( post: Post ): string {
    return wallClock( post.time );
  }

  /** Sign-in problems need a reconnect first; everything else can retry now. */
  isSignInError ( row: ChannelResult ): boolean {
    return ['account_reauth_required', 'account_disconnected', 'stale_social_account_binding', 'missing_social_account', 'missing_auth_token'].includes( row.reason ?? '' );
  }

  failureText ( row: ChannelResult ): string {
    const name = this.channelName( row.channel );
    const tries = row.retries ? ` Tried ${ row.retries } ${ row.retries === 1 ? 'time' : 'times' }.` : '';
    if ( this.isSignInError( row ) ) return `${ name } signed us out.${ tries }`;
    return `${ row.error || 'It didn’t take the post.' }${ tries }`;
  }

  channelAction ( post: Post, channel: string, action: 'retry' | 'skip' ): void {
    this.busy.set( post.id );
    this.api.channelAction( post.id, channel, action ).subscribe( {
      next: ( saved ) => {
        this.replace( saved );
        this.busy.set( null );
      },
      error: ( error ) => this.fail( '', error ),
    } );
  }

  /** Reconnect first; the retry happens when they come back and press Retry now. */
  reconnectAndRetry ( _post: Post, channel: string ): void {
    this.connect.connect( channel );
  }

  drop ( post: Post ): void {
    this.busy.set( post.id );
    this.api.drop( post.id ).subscribe( {
      next: () => {
        this.busy.set( null );
        this.notifications.show( 'Dropped', 'The posts behind it moved up a day.', 'success' );
        this.load();
      },
      error: ( error ) => this.fail( '', error ),
    } );
  }

  retry (): void {
    this.loadError.set( undefined );
    this.loading.set( true );
    this.load();
  }

  regenerate (): void {
    void this.router.navigate( ['/strategy'], { queryParams: { regenerate: 1 } } );
  }

  pillar ( post: Post ) { return pillarOf( this.strategy(), post.pillar ); }
  channels ( post: Post ) { return channelList( post.channels, this.state.channelNames(), this.strategy()?.channels.length ?? 0 ); }
  slot ( post: Post ) { return slotLabel( post, this.today() ); }
  statusLabel ( post: Post ) { return STATUS_LABELS[post.status]; }
  weekday ( date: string ) { return weekdayLong( date ); }

  autoWhen ( post: Post ): string {
    if ( !post.autoApproveAt ) return '';
    const tz = this.state.timeZone();
    if ( localDateKey( post.autoApproveAt, tz ) === this.today() ) return `at ${ clock( post.autoApproveAt, tz ) }`;
    return relativeDayAt( post.autoApproveAt, tz, this.today() ).replace( /^Tomorrow/, 'tomorrow' );
  }

  goesOut ( post: Post ): string {
    return slotLabel( post, this.today() ).replace( /^Today/, 'today' ).replace( /^Tomorrow/, 'tomorrow' ).replace( /^(\w{3}, )/, 'on $1' );
  }

  /** Unpinned posts after this one: what moves if it's held through its slot. */
  behind ( post: Post ): number {
    return this.posts().filter( ( item ) => !item.pinned && item.slotDate > post.slotDate && ['planned', 'drafted', 'needs_review', 'approved', 'on_hold'].includes( item.status ) ).length;
  }

  approve ( post: Post ): void {
    this.busy.set( post.id );
    this.api.approve( post.id ).subscribe( {
      next: ( saved ) => {
        this.replace( saved );
        this.justApproved.update( ( set ) => new Set( set ).add( saved.id ) );
        this.busy.set( null );
      },
      error: ( error ) => this.fail( 'Couldn’t approve', error ),
    } );
  }

  undo ( post: Post ): void {
    this.busy.set( post.id );
    this.api.undoApprove( post.id ).subscribe( {
      next: ( saved ) => {
        this.replace( saved );
        this.justApproved.update( ( set ) => {
          const next = new Set( set );
          next.delete( saved.id );
          return next;
        } );
        this.busy.set( null );
      },
      error: ( error ) => this.fail( 'Couldn’t undo', error ),
    } );
  }

  hold ( post: Post ): void {
    this.busy.set( `${ post.id }:hold` );
    this.api.hold( post.id ).subscribe( {
      next: ( saved ) => {
        this.replace( saved );
        this.busy.set( null );
        if ( saved.status === 'needs_review' && saved.rewriteCount ) {
          this.notifications.show( 'Held', 'Maya rewrote it. The new version is ready for you to review.', 'info' );
        }
      },
      error: ( error ) => this.fail( 'Couldn’t hold', error ),
    } );
  }

  edited ( post: Post ): void {
    this.editing.set( null );
    this.replace( post );
    this.justApproved.update( ( set ) => new Set( set ).add( post.id ) );
  }

  private replace ( saved: Post ): void {
    this.posts.update( ( posts ) => posts.map( ( post ) => ( post.id === saved.id ? saved : post ) ) );
  }

  /** 2r: the card stays as it was. */
  private fail ( _title: string, _error: unknown ): void {
    this.busy.set( null );
    this.notifications.show( 'That didn’t save', 'Try again.', 'error' );
  }

  protected readonly plural = plural;
  protected readonly monthDay = monthDay;
  protected readonly weekdayLong = weekdayLong;
}

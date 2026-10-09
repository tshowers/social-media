import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { NotificationService } from '../../services/notification.service';
import { ChannelResult, MayaSocialApi, Post, apiError } from '../api';
import { EditSheetComponent } from '../edit-sheet.component';
import { PostChannelsComponent } from '../post-channels.component';
import { PostDrawerComponent } from '../post-drawer.component';
import { ChannelWarningComponent, LoadErrorComponent, NotSetUpComponent, SkeletonComponent } from '../states.component';
import {
  STATUS_LABELS, addDays, channelList, dayOfMonth, daysBetween, monthDay, monthYear, pillarOf, plural, slotLabel,
  wallClock, weekdayLong, weekdayShort,
} from '../format';
import { IconComponent } from '../icon.component';
import { MayaSocialState } from '../state';

type View = 'week' | 'month' | 'queue';
const ACTIVE = ['planned', 'drafted', 'needs_review', 'approved', 'on_hold'];

interface Day {
  date: string;
  post: Post | null;
  /** Why a day has no post. */
  empty: 'held-past' | 'held-future' | 'unplanned' | 'before' | null;
  inMonth: boolean;
}

/**
 * Calendar (design 1d Week, 1e Month, 1f Queue; Week opens by default).
 * A held post's ring, "Moved back N days", pinned posts, and the yellow
 * days a hold left empty. Click a post to approve, hold or edit it.
 */
@Component( {
  selector: 'ms-calendar',
  standalone: true,
  imports: [IconComponent, EditSheetComponent, PostDrawerComponent, PostChannelsComponent, ChannelWarningComponent, LoadErrorComponent, NotSetUpComponent, SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .bar { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; margin-bottom: 24px; }
    .bar--queue { max-width: 940px; margin-left: auto; margin-right: auto; }
    .bar h1 { font-size: 32px; font-weight: 700; letter-spacing: -0.03em; }
    .nav { display: flex; gap: 6px; }
    .nav .ms-btn { width: 36px; padding: 0; }
    .legend { display: flex; gap: 16px; margin: 0 auto; font-size: 14px; font-weight: 600; }
    .legend span { display: inline-flex; align-items: center; gap: 6px; }
    .bar .ms-seg { margin-left: auto; }
    .legend + .ms-seg { margin-left: 0; }

    /* Week */
    .week { display: grid; grid-template-columns: repeat(var(--days, 7), minmax(0, 1fr)); gap: 10px; }
    .dhead { display: flex; align-items: baseline; gap: 6px; height: 38px; padding: 0 12px; margin-bottom: 10px; border-radius: 999px; font-size: 13px; font-weight: 700; color: var(--muted); }
    .dhead b { font-size: 18px; color: var(--text); }
    .dhead.is-today { align-items: center; background: var(--text); color: var(--bg); }
    .dhead.is-today b { color: var(--bg); }
    .dhead.is-today em { margin-left: auto; font-style: normal; font-size: 13px; }
    .day {
      display: flex; flex-direction: column; gap: 8px; min-height: 220px; width: 100%; margin: 0; padding: 14px;
      border: 0; border-radius: 20px; background: var(--surface); color: var(--text); text-align: left;
      font: inherit; box-shadow: none; transform: none; cursor: pointer;
    }
    .day:hover { background: var(--surface2); transform: none; }
    .day.is-faded > :not(.foot) { opacity: .55; }
    .exc { font-size: 12px; font-weight: 700; line-height: 1.35; color: var(--muted); }
    .exc--yellow { color: var(--t-yellow-fg); }
    .exc--pink { color: var(--t-pink-fg); }
    .retry { height: 30px; padding: 0 12px; font-size: 12px; }
    .day:focus-visible { outline: 2px solid var(--blue) !important; outline-offset: 2px; box-shadow: none !important; }
    .day.is-held { box-shadow: inset 0 0 0 2px var(--pink); }
    .day.is-past { opacity: .55; }
    .day h3 { font-size: 15px; font-weight: 700; line-height: 1.3; }
    .day .when { font-size: 12px; line-height: 1.45; color: var(--muted); }
    .day .foot { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; margin-top: auto; }
    .chips { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
    .gap { display: flex; flex-direction: column; gap: 6px; min-height: 220px; padding: 14px; border-radius: 20px; background: var(--t-yellow); color: var(--t-yellow-fg); font-size: 14px; font-weight: 700; line-height: 1.4; }
    .gap span { font-weight: 500; }
    .later { min-height: 220px; padding: 14px; border-radius: 20px; background: var(--surface); color: var(--muted); font-size: 13px; opacity: .7; }
    .rules { display: flex; flex-wrap: wrap; gap: 8px 40px; margin-top: 18px; font-size: 13px; color: var(--muted); }

    /* Month */
    .month { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 8px; }
    .mhead { padding: 0 10px 6px; font-size: 13px; font-weight: 700; color: var(--muted); }
    .cell {
      display: flex; flex-direction: column; align-items: flex-start; gap: 6px; min-height: 112px; width: 100%; margin: 0; padding: 10px;
      border: 0; border-radius: 18px; background: var(--surface); color: var(--text); text-align: left; font: inherit;
      box-shadow: none; transform: none;
    }
    button.cell { cursor: pointer; }
    button.cell:hover { background: var(--surface2); transform: none; }
    .cell.is-held { box-shadow: inset 0 0 0 2px var(--pink); }
    .cell.is-out { background: transparent; opacity: .4; }
    .cell.is-past { opacity: .6; }
    .cell.is-gap { background: var(--t-yellow); color: var(--t-yellow-fg); }
    .badge { display: inline-grid; place-items: center; min-width: 26px; height: 26px; padding: 0 6px; border-radius: 999px; font-size: 13px; font-weight: 700; }
    .badge.is-today { background: var(--text); color: var(--bg); }
    .cell .t { display: flex; gap: 6px; font-size: 12px; font-weight: 600; line-height: 1.35; }
    .cell .t .ms-dot { margin-top: 4px; }
    .cell .t span:last-child { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .cell .note { font-size: 12px; color: var(--muted); }
    .cell.is-gap .note { color: inherit; font-weight: 600; }

    /* Queue */
    .queue { max-width: 940px; margin: 0 auto; }
    .row { display: grid; grid-template-columns: 96px 24px minmax(0, 1fr); gap: 0 16px; }
    .row .label { padding-top: 14px; font-size: 15px; font-weight: 700; }
    .row .label small { display: block; font-size: 13px; font-weight: 500; color: var(--muted); }
    .rail { position: relative; display: flex; justify-content: center; }
    .rail::before { content: ""; position: absolute; top: 0; bottom: 0; width: 2px; background: var(--surface2); }
    .rail i { position: relative; width: 14px; height: 14px; margin-top: 20px; border-radius: 50%; background: var(--tint-fg, var(--muted)); }
    .rail i.is-held { background: var(--pink); }
    .row + .row .qcard, .row + .row .qgap { margin-top: 12px; }
    .qcard {
      display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; width: 100%; margin: 0; padding: 18px 20px;
      border: 0; border-radius: 24px; background: var(--surface); color: var(--text); text-align: left; font: inherit;
      box-shadow: none; transform: none; cursor: pointer;
    }
    .qcard:hover { background: var(--surface2); transform: none; }
    .qcard.is-held { box-shadow: inset 0 0 0 2px var(--pink); }
    .qcard .top { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; font-size: 13px; color: var(--muted); }
    .qcard h3 { margin-top: 8px; font-size: 17px; font-weight: 700; }
    .qcard .holding { margin-top: 6px; font-size: 14px; font-weight: 700; color: var(--t-pink-fg); }
    .qcard .right { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
    .qgap { padding: 16px 20px; border-radius: 999px; background: var(--t-yellow); color: var(--t-yellow-fg); font-size: 15px; font-weight: 700; }

    /* 2j: the open card gets a blue ring. */
    .day.is-open, .cell.is-open, .qcard.is-open { box-shadow: inset 0 0 0 3px var(--blue); }
    .warn { display: block; margin-bottom: 20px; }

    @media (max-width: 1000px) { .legend { display: none; } }
    @media (max-width: 760px) {
      .week { grid-template-columns: 1fr; gap: 0; }
      .week .dhead { margin: 14px 0 8px; }
      .day, .gap, .later { min-height: 0; }
      .rules { flex-direction: column; }
    }
    @media (max-width: 760px) {
      .bar h1 { font-size: 26px; }
      .bar .ms-seg { margin-left: 0; }
      .month { gap: 4px; }
      .cell { min-height: 64px; padding: 6px; border-radius: 12px; }
      .cell .t span:last-child, .cell .ms-status, .cell .note { display: none; }
      .row { grid-template-columns: 72px 18px minmax(0, 1fr); gap: 0 10px; }
      .qcard { grid-template-columns: 1fr; }
      .qcard .right { flex-direction: row; align-items: center; }
      .qgap { border-radius: 20px; }
    }
  `],
  template: `
    @if (!state.overview()?.onboardedAt) {
      <ms-not-set-up />
    } @else if (loadError() !== undefined) {
      <ms-load-error [status]="loadError() ?? null" (retry)="load()" />
    } @else if (loading()) {
      <ms-skeleton [layout]="view() === 'week' ? 'week' : 'today'" />
    } @else {
    <main class="ms-page">
      <ms-channel-warning class="warn" />
      <div class="bar" [class.bar--queue]="view() === 'queue'">
        @switch (view()) {
          @case ('week') {
            <h1>{{ weekTitle() }}</h1>
            <div class="nav"><button type="button" class="ms-btn ms-btn--36" aria-label="Previous week" (click)="shift(-weekLength())"><ms-icon name="chevron-left" /></button><button type="button" class="ms-btn ms-btn--36" aria-label="Next week" (click)="shift(weekLength())"><ms-icon name="chevron-right" /></button></div>
          }
          @case ('month') {
            <h1>{{ monthTitle() }}</h1>
            <div class="nav"><button type="button" class="ms-btn ms-btn--36" aria-label="Previous month" (click)="shiftMonth(-1)"><ms-icon name="chevron-left" /></button><button type="button" class="ms-btn ms-btn--36" aria-label="Next month" (click)="shiftMonth(1)"><ms-icon name="chevron-right" /></button></div>
            <div class="legend" aria-label="Pillars">
              @for (pillar of strategy()?.pillars ?? []; track pillar.key) { <span [attr.data-tint]="pillar.tint"><span class="ms-dot"></span>{{ pillar.name }}</span> }
            </div>
          }
          @case ('queue') { <h1>Up next</h1> }
        }
        <div class="ms-seg" role="tablist" aria-label="Calendar view">
          @for (option of views; track option.key) {
            <button type="button" role="tab" [attr.aria-selected]="view() === option.key" [class.is-on]="view() === option.key" (click)="setView(option.key)">{{ option.label }}</button>
          }
        </div>
      </div>

      @switch (view()) {
        @case ('week') {
          <div class="week" [style.--days]="weekLength()">
            @for (day of weekDays(); track day.date) {
              <div>
                <div class="dhead" [class.is-today]="day.date === today()">{{ weekdayShort(day.date) }} <b>{{ dayOfMonth(day.date) }}</b>@if (day.date === today()) { <em>Today</em> }</div>
                @if (day.post; as post) {
                  <div class="day" role="button" tabindex="0" [attr.aria-label]="shortLabel(post)" [class.is-open]="selected()?.id === post.id" [class.is-held]="post.status === 'on_hold'" [class.is-past]="day.date < today() && post.status === 'posted' && !failedRows(post).length" [class.is-faded]="post.status === 'expired' || post.status === 'paused' || post.status === 'dropped'" (click)="open(post)" (keydown.enter)="open(post)" (keydown.space)="$event.preventDefault(); open(post)">
                    <div class="chips">
                      <span class="ms-chip ms-chip--11" [attr.data-tint]="pillar(post).tint">{{ pillar(post).name }}</span>
                      @if (post.offStrategy) { <span class="ms-chip ms-chip--11" data-tint="pink">{{ post.offStrategyKept ? 'Kept' : 'Off-strategy' }}</span> }
                      @if (post.pinned) { <span class="ms-pinned"><ms-icon name="pin" [size]="12" />Pinned</span> }
                    </div>
                    <h3>{{ post.title }}</h3>
                    <p class="when">{{ wallClock(post.time) }} · <ms-post-channels [channels]="post.channels" [live]="post.status !== 'posted'" /></p>
                    <div class="foot">
                      <span class="ms-chip ms-status" [attr.data-status]="chip(post).status">{{ chip(post).label }}</span>
                      @switch (exception(post)) {
                        @case ('expired') { <span class="exc exc--yellow">Not approved by {{ wallClock(post.time) }}. Didn’t post.</span> }
                        @case ('failed') {
                          <span class="exc">{{ postedTo(post) }}</span>
                          @for (row of failedRows(post); track row.channel) {
                            <button type="button" class="ms-btn ms-btn--primary retry" (click)="$event.stopPropagation(); retryChannel(post, row.channel)"><ms-icon name="refresh" [size]="13" />Retry {{ channelName(row.channel) }}</button>
                          }
                        }
                        @case ('heldTwice') { <span class="exc exc--pink">Held twice</span> }
                      }
                      @if (post.movedBackDays && post.status !== 'posted') { <span class="ms-moved"><ms-icon name="moved" [size]="12" />Moved back {{ plural(post.movedBackDays, 'day') }}</span> }
                    </div>
                  </div>
                } @else if (day.empty === 'held-past' || day.empty === 'held-future') {
                  <div class="gap">{{ day.empty === 'held-past' ? 'Nothing went out' : 'Nothing goes out' }}<span>Waiting on the held post.</span></div>
                } @else {
                  <div class="later">{{ day.empty === 'unplanned' ? planNote() : '' }}</div>
                }
              </div>
            }
          </div>
          <div class="rules">
            <span>Posts auto-approve {{ hours() }} hours after Maya drafts them.</span>
            <span>A held post keeps its slot; unpinned posts behind it move back a day.</span>
            <span>Pinned posts never move. If one isn’t approved by its date, it expires.</span>
          </div>
        }

        @case ('month') {
          <div class="month" role="grid" [attr.aria-label]="monthTitle()">
            @for (name of weekdayNames; track name) { <div class="mhead" role="columnheader">{{ name }}</div> }
            @for (day of monthDays(); track day.date) {
              @if (day.post && day.inMonth) {
                <button type="button" class="cell" role="gridcell" [class.is-open]="selected()?.id === day.post!.id" [class.is-held]="day.post!.status === 'on_hold'" [class.is-past]="day.date < today()" (click)="open(day.post!)" [attr.aria-label]="shortLabel(day.post!)">
                  <span class="badge" [class.is-today]="day.date === today()">{{ dayOfMonth(day.date) }}</span>
                  <span class="t" [attr.data-tint]="pillar(day.post!).tint"><span class="ms-dot"></span><span>{{ day.post!.title }}</span></span>
                  <span class="ms-chip ms-chip--11 ms-status" [attr.data-status]="chip(day.post!).status">{{ chip(day.post!).label }}</span>
                </button>
              } @else {
                <div class="cell" role="gridcell" [class.is-out]="!day.inMonth" [class.is-gap]="day.inMonth && (day.empty === 'held-past' || day.empty === 'held-future')">
                  <span class="badge" [class.is-today]="day.date === today()">{{ dayOfMonth(day.date) }}</span>
                  @if (day.inMonth) {
                    @if (day.empty === 'unplanned') { <span class="note">{{ planNote() }}</span> }
                    @if (day.empty === 'held-past') { <span class="note">Nothing went out</span> }
                    @if (day.empty === 'held-future') { <span class="note">Nothing goes out</span> }
                  }
                </div>
              }
            }
          </div>
        }

        @case ('queue') {
          <div class="queue">
            @for (day of queueDays(); track day.date) {
              <div class="row">
                <div class="label">{{ queueLabel(day.date) }}<small>{{ weekdayShort(day.date) }} {{ dayOfMonth(day.date) }}</small></div>
                <div class="rail" [attr.data-tint]="day.post ? pillar(day.post).tint : 'yellow'"><i [class.is-held]="day.post?.status === 'on_hold'"></i></div>
                @if (day.post; as post) {
                  <button type="button" class="qcard" [class.is-open]="selected()?.id === post.id" [class.is-held]="post.status === 'on_hold'" (click)="open(post)">
                    <div>
                      <div class="top">
                        <span class="ms-chip ms-chip--11" [attr.data-tint]="pillar(post).tint">{{ pillar(post).name }}</span>
                        <span>{{ wallClock(post.time) }} · <ms-post-channels [channels]="post.channels" [live]="post.status !== 'posted'" /></span>
                        @if (post.pinned) { <span class="ms-pinned">Pinned</span> }
                      </div>
                      <h3>{{ post.title }}</h3>
                      @if (post.status === 'on_hold') { <p class="holding">Holding the line. {{ plural(behind(post), 'unpinned post') }} wait behind it{{ pinnedAhead(post) ? '; pinned posts don’t move.' : '.' }}</p> }
                    </div>
                    <div class="right">
                      <span class="ms-chip ms-status" [attr.data-status]="chip(post).status">{{ chip(post).label }}</span>
                      @if (post.movedBackDays && post.status !== 'posted') { <span class="ms-moved"><ms-icon name="moved" [size]="12" />Moved back {{ plural(post.movedBackDays, 'day') }}</span> }
                    </div>
                  </button>
                } @else if (day.empty === 'held-past' || day.empty === 'held-future') {
                  <div class="qgap">{{ day.empty === 'held-past' ? 'Nothing went out.' : 'Nothing goes out.' }} The held post kept this slot.</div>
                } @else {
                  <div class="qgap" style="background: var(--surface); color: var(--muted)">{{ planNote() }}</div>
                }
              </div>
            }
          </div>
        }
      }
    </main>
    }

    @if (selected(); as post) {
      <ms-post-drawer [post]="post" (closed)="selected.set(null)" (changed)="done($event)" (reload)="load()" (edit)="editing.set($event); selected.set(null)" />
    }

    @if (editing(); as post) {
      <ms-edit-sheet [post]="post" (saved)="edited($event)" (closed)="editing.set(null)" />
    }
  `,
} )
export class CalendarComponent implements OnInit {
  readonly state = inject( MayaSocialState );
  private readonly api = inject( MayaSocialApi );
  private readonly route = inject( ActivatedRoute );
  private readonly router = inject( Router );
  private readonly notifications = inject( NotificationService );

  readonly views: { key: View; label: string }[] = [{ key: 'week', label: 'Week' }, { key: 'month', label: 'Month' }, { key: 'queue', label: 'Queue' }];
  readonly weekdayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  readonly view = signal<View>( 'week' );
  readonly anchor = signal( this.state.today() );
  readonly posts = signal<Post[]>( [] );
  readonly selected = signal<Post | null>( null );
  readonly editing = signal<Post | null>( null );
  readonly busy = signal( false );
  readonly loading = signal( true );
  readonly loadError = signal<number | null | undefined>( undefined );

  readonly today = this.state.today;
  readonly strategy = this.state.strategy;
  readonly hours = computed( () => this.state.overview()?.autoApproveHours ?? 6 );
  private readonly startedOn = computed( () => ( this.strategy()?.approvedAt || '' ).slice( 0, 10 ) );

  readonly weekTitle = computed( () => {
    const start = this.anchor();
    const end = addDays( start, this.weekLength() - 1 );
    return start.slice( 0, 7 ) === end.slice( 0, 7 ) ? `${ monthDay( start ) } – ${ dayOfMonth( end ) }` : `${ monthDay( start ) } – ${ monthDay( end ) }`;
  } );
  readonly monthTitle = computed( () => monthYear( this.anchor() ) );

  /** 4d: at tablet width the week shows 4 days, and the arrows move by 4. */
  readonly tablet = signal( typeof window !== 'undefined' && window.matchMedia( '(min-width: 761px) and (max-width: 1000px)' ).matches );
  readonly weekLength = computed( () => ( this.tablet() ? 4 : 7 ) );
  readonly weekDays = computed( () => Array.from( { length: this.weekLength() }, ( _, i ) => this.day( addDays( this.anchor(), i ), true ) ) );

  readonly monthDays = computed( () => {
    const first = `${ this.anchor().slice( 0, 7 ) }-01`;
    const weekday = ( ( daysBetween( '2026-01-05', first ) % 7 ) + 7 ) % 7; // 0 = Monday
    const start = addDays( first, -weekday );
    const days: Day[] = [];
    for ( let i = 0; i < 42; i++ ) {
      const date = addDays( start, i );
      if ( i >= 35 && date.slice( 0, 7 ) !== first.slice( 0, 7 ) ) break;
      days.push( this.day( date, date.slice( 0, 7 ) === first.slice( 0, 7 ) ) );
    }
    return days;
  } );

  readonly queueDays = computed( () => Array.from( { length: 9 }, ( _, i ) => this.day( addDays( this.today(), i - 1 ), true ) ) );

  ngOnInit (): void {
    const view = this.route.snapshot.queryParamMap.get( 'view' ) as View | null;
    if ( view && ['week', 'month', 'queue'].includes( view ) ) this.view.set( view );
    this.load();
  }

  setView ( view: View ): void {
    this.view.set( view );
    this.anchor.set( this.today() );
    void this.router.navigate( [], { queryParams: { view }, replaceUrl: true } );
    this.load();
  }

  shift ( days: number ): void {
    this.anchor.update( ( date ) => addDays( date, days ) );
    this.load();
  }

  shiftMonth ( months: number ): void {
    const [y, m] = this.anchor().split( '-' ).map( Number );
    const date = new Date( Date.UTC( y, m - 1 + months, 1 ) ).toISOString().slice( 0, 10 );
    this.anchor.set( date );
    this.load();
  }

  load (): void {
    // Wide enough to count what's behind a held post, whatever the view.
    const from = this.view() === 'month' ? addDays( `${ this.anchor().slice( 0, 7 ) }-01`, -7 ) : addDays( this.anchor() < this.today() ? this.anchor() : this.today(), -1 );
    const to = addDays( from, 90 );
    this.loadError.set( undefined );
    this.api.posts( from, to ).subscribe( {
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

  private day ( date: string, inMonth: boolean ): Day {
    const post = this.posts().find( ( item ) => item.slotDate === date && item.status !== 'expired' )
      ?? this.posts().find( ( item ) => item.slotDate === date ) ?? null;
    if ( post ) return { date, post, empty: null, inMonth };
    const through = this.state.overview()?.plannedThrough || '';
    let empty: Day['empty'] = 'unplanned';
    if ( !this.startedOn() || date < this.startedOn() ) empty = 'before';
    else if ( through && date <= through ) empty = date < this.today() ? 'held-past' : 'held-future';
    return { date, post: null, empty, inMonth };
  }

  planNote (): string {
    const next = this.state.overview()?.nextPlanDate;
    return next ? `Maya plans this on ${ monthDay( next ) }` : 'Not planned yet';
  }

  queueLabel ( date: string ): string {
    const diff = daysBetween( this.today(), date );
    if ( diff === -1 ) return 'Yesterday';
    if ( diff === 0 ) return 'Today';
    if ( diff === 1 ) return 'Tomorrow';
    return weekdayLong( date );
  }

  pillar ( post: Post ) { return pillarOf( this.strategy(), post.pillar ); }
  channels ( post: Post ) { return channelList( post.channels, this.state.channelNames(), this.strategy()?.channels.length ?? 0 ); }
  status ( post: Post ) { return STATUS_LABELS[post.status]; }
  slotLabel ( post: Post ) { return slotLabel( post, this.today() ); }
  shortLabel ( post: Post ) { return `${ this.slotLabel( post ) }: ${ post.title }, ${ this.status( post ) }`; }
  isActive ( post: Post ) { return ACTIVE.includes( post.status ); }
  canApprove ( post: Post ) { return !!post.body && ['drafted', 'needs_review', 'on_hold'].includes( post.status ); }
  canHold ( post: Post ) { return ['planned', 'drafted', 'needs_review', 'approved'].includes( post.status ); }

  /** The chip a card shows (gaps 2c, 2o). */
  chip ( post: Post ): { status: string; label: string } {
    if ( this.state.publishingPaused() && ACTIVE.includes( post.status ) ) return { status: 'paused', label: 'Paused' };
    if ( this.exception( post ) === 'failed' ) return { status: 'failed', label: `Failed on ${ this.failedRows( post ).map( ( row ) => this.channelName( row.channel ) ).join( ', ' ) }` };
    return { status: post.status, label: this.status( post ) };
  }

  exception ( post: Post ): 'expired' | 'failed' | 'heldTwice' | null {
    if ( post.status === 'expired' ) return 'expired';
    if ( post.status === 'posted' && this.failedRows( post ).length ) return 'failed';
    if ( post.status === 'on_hold' && ( post.holdCount ?? 0 ) >= 2 ) return 'heldTwice';
    return null;
  }

  failedRows ( post: Post ): ChannelResult[] {
    return ( post.channelResults ?? [] ).filter( ( row ) => row.status === 'failed' );
  }

  channelName ( key: string ): string {
    return this.state.channelNames()[key] || key;
  }

  postedTo ( post: Post ): string {
    const names = ( post.channelResults ?? [] ).filter( ( row ) => row.status === 'posted' ).map( ( row ) => this.channelName( row.channel ) );
    if ( !names.length ) return 'Nothing went out.';
    return `Posted to ${ names.length > 1 ? `${ names.slice( 0, -1 ).join( ', ' ) } and ${ names[names.length - 1] }` : names[0] }`;
  }

  retryChannel ( post: Post, channel: string ): void {
    this.api.channelAction( post.id, channel, 'retry' ).subscribe( {
      next: ( saved ) => this.done( saved ),
      error: () => this.notifications.show( 'That didn’t save', 'Try again.', 'error' ),
    } );
  }

  draftWhen ( post: Post ): string {
    const day = addDays( post.slotDate, -3 );
    return day <= this.today() ? 'soon' : `on ${ weekdayLong( day ) }, ${ monthDay( day ) }`;
  }

  behind ( post: Post ): number {
    return this.posts().filter( ( item ) => !item.pinned && item.slotDate > post.slotDate && this.isActive( item ) ).length;
  }

  pinnedAhead ( post: Post ): boolean {
    return this.posts().some( ( item ) => item.pinned && item.slotDate > post.slotDate && this.isActive( item ) );
  }

  open ( post: Post ): void {
    this.selected.set( post );
  }

  approve ( post: Post ): void {
    this.busy.set( true );
    this.api.approve( post.id ).subscribe( {
      next: ( saved ) => this.done( saved ),
      error: ( error ) => this.fail( 'Couldn’t approve', error ),
    } );
  }

  hold ( post: Post ): void {
    this.busy.set( true );
    this.api.hold( post.id ).subscribe( {
      next: ( saved ) => {
        this.done( saved );
        if ( saved.rewriteCount && saved.status === 'needs_review' ) this.notifications.show( 'Held', 'Maya rewrote it. The new version is on Today.', 'info' );
      },
      error: ( error ) => this.fail( 'Couldn’t hold', error ),
    } );
  }

  edited ( post: Post ): void {
    this.editing.set( null );
    this.done( post );
  }

  done ( saved: Post ): void {
    this.busy.set( false );
    this.selected.set( null );
    this.posts.update( ( posts ) => posts.map( ( post ) => ( post.id === saved.id ? saved : post ) ) );
  }

  private fail ( title: string, error: unknown ): void {
    this.busy.set( false );
    this.notifications.show( title, apiError( error ).message || 'Try again.', 'error' );
  }

  protected readonly weekdayShort = weekdayShort;
  protected readonly dayOfMonth = dayOfMonth;
  protected readonly wallClock = wallClock;
  protected readonly plural = plural;
}

import { ChangeDetectionStrategy, Component, EventEmitter, Injectable, Input, Output, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { NotificationService } from '../services/notification.service';
import { MayaSocialApi, apiError } from './api';
import { IconComponent } from './icon.component';
import { MayaSocialState } from './state';

/**
 * Screen states shared by Today, Calendar and Strategy
 * (design_handoff_maya_social_gaps 2d, 2f, 2p, 2q, 2r).
 */

/** Starts a channel's sign-in (the provider's OAuth) and comes back to this page. */
@Injectable( { providedIn: 'root' } )
export class ChannelConnect {
  private readonly api = inject( MayaSocialApi );
  private readonly notifications = inject( NotificationService );
  readonly connecting = signal<string | null>( null );

  connect ( channel: string ): void {
    this.connecting.set( channel );
    const back = `${ window.location.origin }${ window.location.pathname }`;
    this.api.connectChannel( channel, back ).subscribe( {
      next: ( url ) => {
        if ( url ) window.location.href = url;
        else {
          this.connecting.set( null );
          this.notifications.show( 'Couldn’t connect', 'That channel isn’t available right now.', 'error' );
        }
      },
      error: ( error ) => {
        this.connecting.set( null );
        this.notifications.show( 'Couldn’t connect', apiError( error ).message || 'Try again.', 'error' );
      },
    } );
  }
}

const LATER_KEY = 'maya-social-channel-warning-later';

/** 2d: strategy channels that can't post, at the top of Today and Calendar. "Later" hides it for 24 hours. */
@Component( {
  selector: 'ms-channel-warning',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .warn { display: flex; flex-direction: column; gap: 10px; padding: 20px 22px 22px; border-radius: 28px; background: var(--t-yellow); color: var(--t-yellow-fg); }
    .head { display: flex; align-items: center; gap: 10px; }
    .head h2 { flex: 1; font-size: 18px; font-weight: 700; }
    .later { min-height: 0; padding: 4px 8px; border: 0; background: none; color: inherit; font: 700 13px/1 var(--font); box-shadow: none; transform: none; cursor: pointer; }
    .later:hover { text-decoration: underline; transform: none; }
    .row { display: grid; grid-template-columns: 150px 1fr auto; gap: 12px; align-items: center; padding: 8px 8px 8px 18px; border-radius: 999px; background: var(--bg); color: var(--text); }
    .row strong { font-size: 16px; }
    .row span { font-size: 14px; color: var(--muted); }
    @media (max-width: 760px) {
      .row { grid-template-columns: 1fr auto; border-radius: 22px; }
      .row span { grid-column: 1; grid-row: 2; }
      .row .ms-btn { grid-row: 1 / span 2; grid-column: 2; }
    }
  `],
  template: `
    @if (visible()) {
      <section class="warn" role="status" aria-labelledby="warn-title">
        <div class="head">
          <ms-icon name="alert" [size]="20" />
          <h2 id="warn-title">{{ title() }}</h2>
          <button type="button" class="later" (click)="later()">Later</button>
        </div>
        @for (channel of channels(); track channel.key) {
          <div class="row">
            <strong>{{ channel.name }}</strong>
            <span>Never connected. Its posts are skipped until you connect.</span>
            <button type="button" class="ms-btn ms-btn--primary ms-btn--36" [disabled]="connect.connecting() === channel.key" (click)="connect.connect(channel.key)">Connect</button>
          </div>
        }
      </section>
    }
  `,
} )
export class ChannelWarningComponent {
  private readonly state = inject( MayaSocialState );
  readonly connect = inject( ChannelConnect );
  private readonly hiddenUntil = signal( this.readLater() );

  readonly channels = this.state.unconnectedChannels;
  readonly visible = computed( () => this.channels().length > 0 && !this.state.publishingPaused() && Date.now() > this.hiddenUntil() );
  readonly title = computed( () => {
    const count = this.channels().length;
    return count === 1 ? '1 channel in your strategy can’t post' : `${ count } channels in your strategy can’t post`;
  } );

  later (): void {
    const until = Date.now() + 24 * 60 * 60 * 1000;
    this.hiddenUntil.set( until );
    try { localStorage.setItem( LATER_KEY, String( until ) ); } catch { /* storage blocked: hidden for this visit */ }
  }

  private readLater (): number {
    try { return Number( localStorage.getItem( LATER_KEY ) ) || 0; } catch { return 0; }
  }
}

/** 2f: the first strategy waits for approval. On Strategy and Today until approved. */
@Component( {
  selector: 'ms-first-strategy-banner',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .banner { display: grid; grid-template-columns: 44px 1fr auto auto; gap: 18px; align-items: center; padding: 24px; border-radius: 28px; background: var(--t-blue); color: var(--t-blue-fg); }
    h2 { font-size: 20px; font-weight: 700; }
    p { font-size: 14px; line-height: 1.5; }
    .approved { display: flex; align-items: center; gap: 12px; padding: 22px 24px; border-radius: 28px; background: var(--t-green); color: var(--t-green-fg); font-size: 16px; }
    .tick { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; background: var(--bg); }
    @media (max-width: 900px) {
      .banner { grid-template-columns: 44px 1fr; }
      .banner .ms-btn { grid-column: 1 / -1; }
    }
  `],
  template: `
    @if (approving()) {
      <div class="approved" role="status">
        <span class="tick"><ms-icon name="check" [size]="14" [stroke]="3" /></span>
        <span><strong>Approved.</strong> Planning your calendar now…</span>
        <span class="ms-spinner" aria-hidden="true"></span>
      </div>
    } @else {
      <section class="banner" aria-labelledby="first-title">
        <img class="ms-avatar" style="width: 44px; height: 44px" src="assets/maya-avatar.png" alt="" />
        <div>
          <h2 id="first-title">Here’s my first strategy for you.</h2>
          <p>Nothing is scheduled until you approve it. Then I’ll plan three weeks and draft the first posts.</p>
        </div>
        <button type="button" class="ms-btn ms-btn--bg ms-btn--44" (click)="regenerate.emit()">Regenerate</button>
        <button type="button" class="ms-btn ms-btn--primary ms-btn--52" (click)="approve()">Approve and plan my calendar</button>
      </section>
    }
  `,
} )
export class FirstStrategyBannerComponent {
  @Output() regenerate = new EventEmitter<void>();

  private readonly api = inject( MayaSocialApi );
  private readonly state = inject( MayaSocialState );
  private readonly router = inject( Router );
  private readonly notifications = inject( NotificationService );
  readonly approving = signal( false );

  approve (): void {
    this.approving.set( true );
    this.api.approveStrategy().subscribe( {
      next: ( overview ) => {
        this.state.set( { ...overview, entitled: true } );
        this.approving.set( false );
        void this.router.navigate( ['/today'] );
      },
      error: () => {
        this.approving.set( false );
        this.notifications.show( 'That didn’t save', 'Try again.', 'error' );
      },
    } );
  }
}

/** 2p: after "Not now". Today, Calendar and Strategy show the same. */
@Component( {
  selector: 'ms-not-set-up',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .col { display: flex; flex-direction: column; align-items: flex-start; gap: 18px; max-width: 880px; margin: 0 auto; padding: 56px 40px 72px; }
    h1 { font-size: 48px; font-weight: 700; letter-spacing: -0.03em; line-height: 1.05; }
    p { font-size: 18px; line-height: 1.6; color: var(--muted); }
    @media (max-width: 760px) { .col { padding: 24px 16px 120px; } h1 { font-size: 32px; } }
  `],
  template: `
    <main class="col">
      <img class="ms-avatar ms-avatar--64" src="assets/maya-avatar.png" alt="Maya" />
      <h1>I’m not running your social media yet.</h1>
      <p>Nothing is planned and nothing will post. Setup takes about two minutes: how I work, one setting, then your strategy.</p>
      <a class="ms-btn ms-btn--primary ms-btn--56" routerLink="/welcome">Set up Maya Social</a>
    </main>
  `,
} )
export class NotSetUpComponent {}

/** 2r: a page couldn't load. */
@Component( {
  selector: 'ms-load-error',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .col { display: flex; flex-direction: column; align-items: flex-start; gap: 18px; max-width: 880px; margin: 0 auto; padding: 56px 40px 72px; }
    .icon { display: grid; place-items: center; width: 64px; height: 64px; border-radius: 50%; background: var(--t-pink); color: var(--t-pink-fg); }
    h1 { font-size: 48px; font-weight: 700; letter-spacing: -0.03em; line-height: 1.05; }
    p { font-size: 18px; line-height: 1.6; color: var(--muted); }
    .row { display: flex; align-items: center; flex-wrap: wrap; gap: 16px; }
    .code { font-size: 13px; color: var(--muted); }
    @media (max-width: 760px) { .col { padding: 24px 16px 120px; } h1 { font-size: 32px; } }
  `],
  template: `
    <main class="col" role="alert">
      <span class="icon"><ms-icon name="alert" [size]="28" /></span>
      <h1>{{ title }}</h1>
      <p>{{ body }}</p>
      <div class="row">
        <button type="button" class="ms-btn ms-btn--primary ms-btn--52" (click)="retry.emit()"><ms-icon name="refresh" />Try again</button>
        <span class="code">Error {{ status || 'network' }} · {{ when }}</span>
      </div>
    </main>
  `,
} )
export class LoadErrorComponent {
  @Input() title = 'I couldn’t load your calendar.';
  @Input() body = 'Your posts are safe and still going out on schedule. This is a problem loading the page, not with your plan.';
  @Input() status: number | null = null;
  @Output() retry = new EventEmitter<void>();
  readonly when = new Intl.DateTimeFormat( 'en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' } ).format( new Date() );
}

/** 2q: skeleton in the page's layout while it loads. */
@Component( {
  selector: 'ms-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .grid { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 40px; }
    .col { display: flex; flex-direction: column; gap: 16px; }
    .bar { height: 14px; border-radius: 999px; background: var(--surface); }
    .card { display: flex; flex-direction: column; gap: 14px; height: 220px; padding: 24px; border-radius: 28px; background: var(--surface); }
    .card .bar { background: var(--surface2); }
    .rail { height: 380px; border-radius: 28px; background: var(--surface); }
    .week { display: grid; grid-template-columns: repeat(7, 1fr); gap: 10px; }
    .day { height: 220px; border-radius: 20px; background: var(--surface); }
    @media (prefers-reduced-motion: no-preference) {
      .bar, .card, .rail, .day { animation: pulse 1.4s ease-in-out infinite; }
    }
    @keyframes pulse { 50% { opacity: .55; } }
    @media (max-width: 1000px) { .grid { grid-template-columns: 1fr; } .rail { display: none; } .week { grid-template-columns: repeat(4, 1fr); } }
  `],
  template: `
    <div class="ms-page" aria-busy="true" aria-label="Loading">
      @if (layout === 'week') {
        <div class="col">
          <div class="bar" style="width: 240px; height: 40px"></div>
          <div class="week">@for (day of [1,2,3,4,5,6,7]; track day) { <div class="day"></div> }</div>
        </div>
      } @else {
        <div class="grid">
          <div class="col">
            <div class="bar" style="width: 180px"></div>
            <div class="bar" style="width: 460px; max-width: 100%; height: 44px"></div>
            <div class="bar" style="width: 380px; max-width: 100%; height: 18px"></div>
            <div class="card"><div class="bar" style="width: 90px; height: 22px"></div><div class="bar" style="width: 60%; height: 22px"></div><div class="bar" style="width: 85%"></div><div class="bar" style="width: 75%"></div></div>
            <div class="card"></div>
          </div>
          <div class="rail"></div>
        </div>
      }
    </div>
  `,
} )
export class SkeletonComponent {
  @Input() layout: 'today' | 'week' = 'today';
}

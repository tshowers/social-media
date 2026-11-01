import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { NotificationService } from '../services/notification.service';

import { ChannelState, MayaSocialApi, apiError } from './api';
import { monthDay, plural } from './format';
import { IconComponent } from './icon.component';
import { MayaSocialState } from './state';
import { ChannelConnect } from './states.component';

interface AccountRow {
  key: string;
  name: string;
  status: ChannelState['status'];
  /** "Connected as …", "Needs reconnecting", "Not connected". */
  statusLabel: string;
  detail: string;
  available: boolean;
  /** Bluesky signs in with a handle and app password, here, instead of OAuth. */
  direct: boolean;
  disconnectNote: string;
}

/** The OAuth return (outreach/social account.service getFrontendReturnUrl) adds these. */
const RETURN_PARAMS = ['authProvider', 'authStatus', 'message', 'connectedAccountId'];

/**
 * Profile › Connected accounts: every social account, strategy or not, with
 * where it stands. Connect and Reconnect use the existing Social accounts
 * sign-in (ChannelConnect) and come back to Profile; Disconnect removes the
 * account, an expired one too.
 */
@Component( {
  selector: 'ms-connected-accounts',
  standalone: true,
  imports: [FormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: flex; flex-direction: column; gap: 16px; }
    h2 { font-size: 28px; font-weight: 700; letter-spacing: -0.02em; }
    .lead { font-size: 15px; color: var(--muted); }
    .list { display: flex; flex-direction: column; gap: 8px; }
    .row { display: grid; grid-template-columns: 210px minmax(0, 1fr) auto; gap: 16px; align-items: center; min-height: 58px; padding: 10px 10px 10px 22px; border-radius: 999px; background: var(--surface); }
    .name strong { display: block; font-size: 16px; }
    .name small { font-size: 13px; color: var(--muted); overflow-wrap: anywhere; }
    .detail { font-size: 14px; color: var(--muted); }
    .act { display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
    .chip-ok { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 999px; background: var(--t-green); color: var(--t-green-fg); font-size: 12px; font-weight: 700; }
    .chip-warn { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 999px; background: var(--bg); color: var(--t-yellow-fg); font-size: 12px; font-weight: 700; }
    .chip-off { padding: 4px 10px; border-radius: 999px; background: var(--bg); color: var(--muted); font-size: 12px; font-weight: 700; }
    .row.is-signed-out { border-radius: 28px; background: var(--t-yellow); }
    .row.is-signed-out .detail, .row.is-signed-out .name small { color: var(--t-yellow-fg); }
    .panel { display: flex; flex-direction: column; gap: 12px; max-width: 560px; margin: 0 0 8px 24px; padding: 22px; border-radius: 24px; background: var(--bg); box-shadow: var(--shadow); }
    .panel h3 { font-size: 18px; font-weight: 700; }
    .panel p { font-size: 15px; line-height: 1.55; color: var(--muted); }
    .panel .field { display: flex; flex-direction: column; }
    .panel-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    @media (max-width: 900px) {
      .row { grid-template-columns: 1fr; gap: 8px; border-radius: 24px; padding: 14px 14px 14px 18px; }
      .act { justify-content: flex-start; flex-wrap: wrap; }
      .panel { margin-left: 0; }
    }
  `],
  template: `
    <h2 id="accounts-title">Connected accounts</h2>
    <p class="lead">I only post to accounts that are connected. If one says it needs reconnecting, its sign-in expired: reconnect it, or disconnect it if you removed that account.</p>
    <div class="list" role="list" aria-labelledby="accounts-title">
      @for (row of rows(); track row.key) {
        <div class="row" role="listitem" [class.is-signed-out]="row.status === 'needs_reconnect'" [attr.data-account]="row.key">
          <div class="name">
            <strong>{{ row.name }}</strong>
            <small>{{ row.statusLabel }}</small>
          </div>
          <span class="detail">{{ row.detail }}</span>
          <div class="act">
            @switch (row.status) {
              @case ('connected') {
                <span class="chip-ok"><ms-icon name="check" [size]="12" [stroke]="3" />Connected</span>
                <button type="button" class="ms-btn ms-btn--36" [class.ms-btn--ink]="confirming() === row.key" [class.ms-btn--bg]="confirming() !== row.key" (click)="toggleConfirm(row.key)">Disconnect</button>
              }
              @case ('needs_reconnect') {
                <span class="chip-warn"><ms-icon name="alert" [size]="12" [stroke]="3" />Needs reconnecting</span>
                <button type="button" class="ms-btn ms-btn--primary ms-btn--36" [disabled]="busyKey() === row.key || !row.available" (click)="start(row)">
                  @if (busyKey() === row.key) { <span class="ms-spinner" aria-hidden="true"></span> } @else { <ms-icon name="refresh" [size]="14" /> }
                  Reconnect
                </button>
                <button type="button" class="ms-btn ms-btn--36" [class.ms-btn--ink]="confirming() === row.key" [class.ms-btn--bg]="confirming() !== row.key" (click)="toggleConfirm(row.key)">Disconnect</button>
              }
              @default {
                <span class="chip-off">Not connected</span>
                <button type="button" class="ms-btn ms-btn--primary ms-btn--36" [disabled]="busyKey() === row.key || !row.available" (click)="start(row)">
                  @if (busyKey() === row.key) { <span class="ms-spinner" aria-hidden="true"></span> } @else { <ms-icon name="link" [size]="14" /> }
                  Connect
                </button>
              }
            }
          </div>
        </div>

        @if (blueskyOpen() && row.direct) {
          <form class="panel" (ngSubmit)="connectBluesky()" aria-labelledby="bsky-title">
            <h3 id="bsky-title">{{ row.status === 'not_connected' ? 'Connect' : 'Reconnect' }} Bluesky</h3>
            <p>Bluesky uses an app password, not your main one. Make one in Bluesky under Settings, Privacy and security, App passwords.</p>
            <div class="field">
              <label class="ms-field-label" for="bsky-handle">Handle</label>
              <input id="bsky-handle" class="ms-input" name="handle" [ngModel]="handle()" (ngModelChange)="handle.set($event)" placeholder="yourname.bsky.social" autocomplete="username" autocapitalize="off" spellcheck="false" />
            </div>
            <div class="field">
              <label class="ms-field-label" for="bsky-password">App password</label>
              <input id="bsky-password" class="ms-input" type="password" name="appPassword" [ngModel]="appPassword()" (ngModelChange)="appPassword.set($event)" placeholder="xxxx-xxxx-xxxx-xxxx" autocomplete="off" />
            </div>
            <div class="panel-actions">
              <button type="submit" class="ms-btn ms-btn--primary ms-btn--44" [disabled]="!blueskyReady() || busyKey() === 'bluesky'">
                @if (busyKey() === 'bluesky') { <span class="ms-spinner" aria-hidden="true"></span> }
                Connect Bluesky
              </button>
              <button type="button" class="ms-btn ms-btn--44" (click)="closeBluesky()">Cancel</button>
            </div>
          </form>
        }

        @if (confirming() === row.key) {
          <div class="panel" role="alertdialog" [attr.aria-label]="'Disconnect ' + row.name + '?'">
            <h3>Disconnect {{ row.name }}?</h3>
            <p>{{ row.disconnectNote }}</p>
            <div class="panel-actions">
              <button type="button" class="ms-btn ms-btn--ink ms-btn--44" [disabled]="disconnecting()" (click)="disconnect(row)">Disconnect</button>
              <button type="button" class="ms-btn ms-btn--44" (click)="confirming.set(null)">{{ row.status === 'connected' ? 'Keep connected' : 'Cancel' }}</button>
            </div>
          </div>
        }
      }
    </div>
  `,
} )
export class ConnectedAccountsComponent implements OnInit {
  private readonly state = inject( MayaSocialState );
  private readonly api = inject( MayaSocialApi );
  private readonly route = inject( ActivatedRoute );
  private readonly router = inject( Router );
  private readonly notifications = inject( NotificationService );
  private readonly channelConnect = inject( ChannelConnect );

  readonly confirming = signal<string | null>( null );
  readonly disconnecting = signal( false );
  readonly blueskyOpen = signal( false );
  readonly blueskyBusy = signal( false );
  readonly handle = signal( '' );
  readonly appPassword = signal( '' );
  readonly blueskyReady = computed( () => !!this.handle().trim() && !!this.appPassword().trim() );
  /** Which row's button shows a spinner. */
  readonly busyKey = computed( () => ( this.blueskyBusy() ? 'bluesky' : this.channelConnect.connecting() ) );

  readonly rows = computed<AccountRow[]>( () => {
    const overview = this.state.overview();
    const list = overview?.accounts ?? overview?.channelStatus ?? [];
    const strategy = overview?.strategy;
    return list.map( ( account ) => {
      const planned = strategy?.channels.find( ( channel ) => channel.key === account.key );
      const available = account.available !== false;
      const posts = planned ? plural( planned.perWeek, 'post' ) : '';
      let statusLabel = 'Not connected';
      let detail: string;
      if ( account.status === 'connected' ) {
        statusLabel = account.account ? `Connected as ${ account.account }` : 'Connected';
        detail = planned ? `${ planned.role } · ${ posts } a week` : 'Not in your strategy right now.';
      } else if ( account.status === 'needs_reconnect' ) {
        statusLabel = account.account ? `Needs reconnecting · ${ account.account }` : 'Needs reconnecting';
        const when = account.signedOutAt ? ` on ${ monthDay( account.signedOutAt.slice( 0, 10 ) ) }` : '';
        detail = planned
          ? `Signed out${ when }. Its ${ posts } a week are skipped until you reconnect.`
          : `Signed out${ when }. Nothing posts here until you reconnect.`;
      } else if ( !available ) {
        detail = 'Not available to connect yet.';
      } else if ( account.key === 'bluesky' ) {
        detail = 'Connect with your handle and an app password.';
      } else if ( account.key === 'instagram' ) {
        detail = 'Needs a business account linked to a Facebook Page.';
      } else {
        detail = planned ? `${ planned.role } · ${ posts } a week once connected` : 'Connect it and I can post there.';
      }
      const disconnectNote = account.status === 'needs_reconnect'
        ? `This removes the expired ${ account.name } sign-in. Connect again any time.`
        : planned
          ? `I’ll stop posting there. The ${ posts } a week for ${ account.name } go to the other channels until you reconnect. Posts already on ${ account.name } stay up.`
          : `I’ll stop posting there. Posts already on ${ account.name } stay up.`;
      return { key: account.key, name: account.name, status: account.status, statusLabel, detail, available, direct: account.key === 'bluesky', disconnectNote };
    } );
  } );

  ngOnInit (): void {
    // Back from a provider's sign-in: say how it went, then tidy the URL.
    const params = this.route.snapshot.queryParamMap;
    const status = params.get( 'authStatus' );
    if ( !status ) return;
    const provider = params.get( 'authProvider' ) || '';
    const name = this.state.channelNames()[provider] || ( provider === 'google' ? 'Google Business' : provider ) || 'That account';
    if ( status === 'success' ) this.notifications.show( 'Connected', `${ name } is connected.`, 'success' );
    else this.notifications.show( `Couldn’t connect ${ name }`, params.get( 'message' ) || 'Try again.', 'error' );
    const cleared = Object.fromEntries( RETURN_PARAMS.map( ( key ) => [key, null] ) );
    void this.router.navigate( [], { queryParams: cleared, queryParamsHandling: 'merge', replaceUrl: true } );
  }

  toggleConfirm ( key: string ): void {
    this.blueskyOpen.set( false );
    this.confirming.set( this.confirming() === key ? null : key );
  }

  start ( row: AccountRow ): void {
    this.confirming.set( null );
    if ( row.direct ) {
      this.blueskyOpen.set( true );
      return;
    }
    this.channelConnect.connect( row.key );
  }

  closeBluesky (): void {
    this.blueskyOpen.set( false );
    this.appPassword.set( '' );
  }

  connectBluesky (): void {
    if ( !this.blueskyReady() ) return;
    this.blueskyBusy.set( true );
    this.api.connectBluesky( this.handle().trim(), this.appPassword().trim() ).subscribe( {
      next: () => {
        void this.state.refresh().then( () => {
          this.blueskyBusy.set( false );
          this.closeBluesky();
          this.notifications.show( 'Connected', 'Bluesky is connected.', 'success' );
        } );
      },
      error: ( error ) => {
        this.blueskyBusy.set( false );
        this.notifications.show( 'Couldn’t connect Bluesky', apiError( error ).message || 'Check the handle and app password, then try again.', 'error' );
      },
    } );
  }

  disconnect ( row: AccountRow ): void {
    this.disconnecting.set( true );
    this.api.disconnect( row.key ).subscribe( {
      next: ( overview ) => {
        this.state.set( { ...overview, entitled: true } );
        this.disconnecting.set( false );
        this.confirming.set( null );
        this.notifications.show( 'Disconnected', `${ row.name } is disconnected.`, 'success' );
      },
      error: () => {
        this.disconnecting.set( false );
        this.notifications.show( 'That didn’t save', 'Try again.', 'error' );
      },
    } );
  }
}

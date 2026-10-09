import { ChangeDetectionStrategy, Component, Input, inject, signal } from '@angular/core';

import { NotificationService } from '../services/notification.service';

import { ChannelState, MayaSocialApi, Strategy } from './api';
import { monthDay } from './format';
import { IconComponent } from './icon.component';
import { MayaSocialState } from './state';
import { ChannelConnect } from './states.component';

/**
 * Strategy › Channels, "Where I post" (gaps 2b): each channel's job and
 * cadence next to whether it's connected. Connect opens the provider's
 * sign-in and comes back here.
 */
@Component( {
  selector: 'ms-strategy-channels',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: block; max-width: 1000px; }
    .intro { display: flex; flex-direction: column; gap: 8px; margin-bottom: 18px; }
    h2 { font-size: 32px; font-weight: 700; letter-spacing: -0.03em; }
    .row { display: grid; grid-template-columns: 200px minmax(0, 1fr) 70px 250px; gap: 16px; align-items: center; min-height: 58px; padding: 10px 10px 10px 22px; border-radius: 999px; background: var(--surface); }
    .row + .row { margin-top: 8px; }
    .name strong { display: block; font-size: 16px; }
    .name small { font-size: 13px; color: var(--muted); }
    .role { font-size: 14px; color: var(--muted); }
    .per { font-size: 14px; font-weight: 700; }
    .act { display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
    .chip-ok { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 999px; background: var(--t-green); color: var(--t-green-fg); font-size: 12px; font-weight: 700; }
    .chip-off { padding: 4px 10px; border-radius: 999px; background: var(--bg); color: var(--muted); font-size: 12px; font-weight: 700; }
    .row.is-signed-out { border-radius: 28px; background: var(--t-yellow); }
    .row.is-signed-out .role, .row.is-signed-out .name small { color: var(--t-yellow-fg); }
    .chip-warn { padding: 4px 10px; border-radius: 999px; background: var(--bg); color: var(--t-yellow-fg); font-size: 12px; font-weight: 700; }
    .confirm { display: flex; flex-direction: column; gap: 10px; max-width: 560px; margin: 8px 0 8px 24px; padding: 22px; border-radius: 24px; background: var(--bg); box-shadow: var(--shadow); }
    .confirm h3 { font-size: 18px; font-weight: 700; }
    .confirm p { font-size: 15px; line-height: 1.55; color: var(--muted); }
    .confirm-actions { display: flex; gap: 8px; }
    .foot { margin-top: 14px; font-size: 13px; color: var(--muted); }
    @media (max-width: 900px) {
      .row { grid-template-columns: 1fr auto; border-radius: 24px; padding: 14px 14px 14px 18px; }
      .role { grid-column: 1 / -1; grid-row: 2; }
      .per { grid-column: 2; grid-row: 1; text-align: right; }
      .act { grid-column: 1 / -1; justify-content: flex-start; }
    }
  `],
  template: `
    <div class="intro">
      <p class="ms-kicker">Social strategy · Channels</p>
      <h2 id="channels-title">Where I post</h2>
      <p class="ms-maya-line"><img class="ms-avatar" src="assets/maya-avatar.png" alt="" />Each channel has a job in the strategy. I only post to the ones you connect.</p>
    </div>
    @for (channel of strategy.channels; track channel.key) {
      @let info = stateOf(channel.key);
      <div class="row" [class.is-signed-out]="info?.status === 'needs_reconnect'">
        <div class="name">
          <strong>{{ channel.name }}</strong>
          <small>{{ info?.status === 'not_connected' || !info ? 'Not connected' : info.account }}</small>
        </div>
        <span class="role">
          @if (info?.status === 'needs_reconnect') {
            Signed out{{ signedOut(info?.signedOutAt) }}. {{ channel.perWeek }} {{ channel.perWeek === 1 ? 'post' : 'posts' }} a week are skipping {{ channel.name }}.
          } @else {
            {{ channel.role }}@if (channel.key === 'instagram' && info?.status !== 'connected') { Needs a business account linked to a Facebook Page.}
          }
        </span>
        <span class="per">{{ channel.perWeek }}/wk</span>
        <div class="act">
          @switch (info?.status) {
            @case ('connected') {
              <span class="chip-ok"><ms-icon name="check" [size]="12" [stroke]="3" />Connected</span>
              <button type="button" class="ms-btn ms-btn--36" [class.ms-btn--ink]="confirming() === channel.key" [class.ms-btn--bg]="confirming() !== channel.key" (click)="confirming.set(confirming() === channel.key ? null : channel.key)">Disconnect</button>
            }
            @case ('needs_reconnect') {
              <span class="chip-warn">Needs reconnecting</span>
              <button type="button" class="ms-btn ms-btn--primary ms-btn--36" [disabled]="connect.connecting() === channel.key" (click)="connect.connect(channel.key)">Reconnect</button>
            }
            @default {
              <span class="chip-off">Not connected</span>
              <button type="button" class="ms-btn ms-btn--primary ms-btn--36" [disabled]="connect.connecting() === channel.key" (click)="connect.connect(channel.key)">
                @if (connect.connecting() === channel.key) { <span class="ms-spinner" aria-hidden="true"></span> } @else { <ms-icon name="link" [size]="14" /> }
                Connect
              </button>
            }
          }
        </div>
      </div>
      @if (confirming() === channel.key) {
        <div class="confirm" role="alertdialog" [attr.aria-label]="'Disconnect ' + channel.name + '?'">
          <h3>Disconnect {{ channel.name }}?</h3>
          <p>I’ll stop posting there. The {{ channel.perWeek }} {{ channel.name }} {{ channel.perWeek === 1 ? 'post' : 'posts' }} a week go to their other channels until you reconnect. Posts already on {{ channel.name }} stay up.</p>
          <div class="confirm-actions">
            <button type="button" class="ms-btn ms-btn--ink ms-btn--44" [disabled]="disconnecting()" (click)="disconnect(channel.key)">Disconnect</button>
            <button type="button" class="ms-btn ms-btn--44" (click)="confirming.set(null)">Keep connected</button>
          </div>
        </div>
      }
    }
    <p class="foot">Cadence is Maya’s. Changing which channels are in the strategy goes through a strategy change.</p>
  `,
} )
export class StrategyChannelsComponent {
  @Input( { required: true } ) strategy!: Strategy;

  private readonly state = inject( MayaSocialState );
  private readonly api = inject( MayaSocialApi );
  private readonly notifications = inject( NotificationService );
  readonly connect = inject( ChannelConnect );
  readonly confirming = signal<string | null>( null );
  readonly disconnecting = signal( false );

  stateOf ( key: string ): ChannelState | undefined {
    return this.state.overview()?.channelStatus?.find( ( channel ) => channel.key === key );
  }

  signedOut ( iso: string | null | undefined ): string {
    return iso ? ` on ${ monthDay( iso.slice( 0, 10 ) ) }` : '';
  }

  disconnect ( key: string ): void {
    this.disconnecting.set( true );
    this.api.disconnect( key ).subscribe( {
      next: ( overview ) => {
        this.state.set( { ...overview, entitled: true } );
        this.disconnecting.set( false );
        this.confirming.set( null );
      },
      error: () => {
        this.disconnecting.set( false );
        this.notifications.show( 'That didn’t save', 'Try again.', 'error' );
      },
    } );
  }
}

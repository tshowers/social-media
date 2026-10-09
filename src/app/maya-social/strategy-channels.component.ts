import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';

import { Strategy } from './api';
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
      <div class="row">
        <div class="name">
          <strong>{{ channel.name }}</strong>
          @if (!isConnected(channel.key)) { <small>Not connected</small> }
        </div>
        <span class="role">{{ channel.role }}@if (channel.key === 'instagram' && !isConnected(channel.key)) { Needs a business account linked to a Facebook Page.}</span>
        <span class="per">{{ channel.perWeek }}/wk</span>
        <div class="act">
          @if (isConnected(channel.key)) {
            <span class="chip-ok"><ms-icon name="check" [size]="12" [stroke]="3" />Connected</span>
          } @else {
            <span class="chip-off">Not connected</span>
            <button type="button" class="ms-btn ms-btn--primary ms-btn--36" [disabled]="connect.connecting() === channel.key" (click)="connect.connect(channel.key)">
              @if (connect.connecting() === channel.key) { <span class="ms-spinner" aria-hidden="true"></span> } @else { <ms-icon name="link" [size]="14" /> }
              Connect
            </button>
          }
        </div>
      </div>
    }
    <p class="foot">Cadence is Maya’s. Changing which channels are in the strategy goes through a strategy change.</p>
  `,
} )
export class StrategyChannelsComponent {
  @Input( { required: true } ) strategy!: Strategy;

  private readonly state = inject( MayaSocialState );
  readonly connect = inject( ChannelConnect );

  isConnected ( key: string ): boolean {
    return ( this.state.overview()?.connectedChannels ?? [] ).includes( key );
  }
}

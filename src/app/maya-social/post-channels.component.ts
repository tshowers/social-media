import { ChangeDetectionStrategy, Component, Input, computed, inject, signal } from '@angular/core';

import { MayaSocialState } from './state';

/**
 * A post's channels, with the ones that can't post struck through:
 * "Threads · ~~Instagram~~ skipped" (gaps 2d). "All 5 channels" when every
 * strategy channel is on and connected.
 */
@Component( {
  selector: 'ms-post-channels',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (all()) { All {{ total() }} channels } @else {
      {{ ok() }}@if (skipped()) {<span>{{ sep() }}</span><span class="ms-skipped">{{ skipped() }}</span> skipped}
    }
  `,
} )
export class PostChannelsComponent {
  private readonly state = inject( MayaSocialState );
  private readonly keys = signal<string[]>( [] );

  @Input( { required: true } ) set channels ( value: string[] ) { this.keys.set( value ?? [] ); }
  /** Posts that already went out show what they were sent to, unstruck. */
  @Input() live = true;

  readonly total = computed( () => this.state.strategy()?.channels.length ?? 0 );
  private readonly split = computed( () => {
    const names = this.state.channelNames();
    const connected = this.state.overview()?.connectedChannels ?? [];
    const ok: string[] = [];
    const off: string[] = [];
    this.keys().forEach( ( key ) => ( !this.live || connected.includes( key ) ? ok : off ).push( names[key] || key ) );
    return { ok, off };
  } );
  readonly ok = computed( () => this.split().ok.join( ', ' ) );
  readonly skipped = computed( () => this.split().off.join( ', ' ) );
  readonly sep = computed( () => ( this.ok() ? ' · ' : '' ) );
  readonly all = computed( () => this.total() > 2 && this.keys().length === this.total() && !this.skipped() );
}

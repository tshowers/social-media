import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';

import { Strategy, StrategyChange } from './api';
import { dayOfMonth, monthDay, weekdayShort } from './format';
import { IconComponent } from './icon.component';

/**
 * A proposed strategy change after a profile save (gaps 2g): what changed
 * in the profile, old → new pillars and channels, which planned posts it
 * affects, and Approve changes / Keep current strategy.
 */
@Component( {
  selector: 'ms-strategy-change',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .grid { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 48px; align-items: start; }
    .kicker { color: var(--t-blue-fg); }
    h1 { margin: 8px 0 12px; }
    section { margin-top: 32px; }
    section > h2 { margin-bottom: 12px; }
    .pill { display: flex; align-items: center; gap: 12px; min-height: 48px; padding: 8px 22px; border-radius: 999px; background: var(--surface); }
    .pill + .pill { margin-top: 8px; }
    .pill strong { font-size: 16px; }
    .pill span:last-child { font-size: 14px; color: var(--muted); }
    .kind { padding: 3px 9px; border-radius: 999px; font-size: 12px; font-weight: 700; }
    .kind[data-kind="added"] { background: var(--t-green); color: var(--t-green-fg); }
    .kind[data-kind="removed"] { background: var(--t-pink); color: var(--t-pink-fg); }
    .kind[data-kind="changed"] { background: var(--surface2); color: var(--text); }
    .cards { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .delta { display: flex; align-items: center; gap: 12px; min-height: 70px; padding: 16px 22px; border-radius: 28px; background: var(--tint, var(--surface)); color: var(--tint-fg, var(--text)); }
    .delta strong { flex: 1; font-size: 17px; }
    .delta s { opacity: .55; font-size: 18px; font-weight: 700; }
    .delta b { font-size: 28px; font-weight: 700; letter-spacing: -0.02em; }
    .rest { display: flex; align-items: center; padding: 16px 22px; border-radius: 28px; background: var(--surface); font-size: 14px; line-height: 1.5; color: var(--muted); }
    .post { display: grid; grid-template-columns: 72px minmax(0, 1fr) 110px; gap: 12px; align-items: center; padding: 14px 20px; border-radius: 24px; background: var(--surface); }
    .post + .post { margin-top: 8px; }
    .post .day { font-size: 16px; font-weight: 700; }
    .post s { display: block; font-size: 13px; color: var(--muted); }
    .post strong { display: block; font-size: 15px; }
    .post small { display: block; font-size: 13px; color: var(--muted); }
    .post .tag { justify-self: end; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; }
    .tag[data-action="replace"] { background: var(--t-violet); color: var(--t-violet-fg); }
    .tag[data-action="rewrite"] { background: var(--surface2); color: var(--text); }
    .post.is-off { background: var(--t-pink); }
    .post.is-off small { color: var(--t-pink-fg); }
    .tag[data-action="off_strategy"] { background: var(--bg); color: var(--t-pink-fg); }
    .side { position: sticky; top: 24px; display: flex; flex-direction: column; gap: 14px; }
    .side .ms-card { display: flex; flex-direction: column; gap: 10px; }
    .side h3 { font-size: 15px; font-weight: 700; }
    .side p { font-size: 14px; line-height: 1.5; color: var(--muted); }
    .note { font-size: 13px; color: var(--muted); text-align: center; }
    @media (max-width: 1000px) { .grid { grid-template-columns: minmax(0, 1fr); } .side { position: static; } }
    @media (max-width: 760px) { .cards { grid-template-columns: 1fr; } .post { grid-template-columns: 56px 1fr; } .post .tag { grid-column: 2; justify-self: start; } .pill { border-radius: 22px; flex-wrap: wrap; } }
  `],
  template: `
    <div class="grid">
      <div>
        <p class="ms-kicker kicker">Proposed change · After your profile save, {{ savedOn() }}</p>
        <h1 class="ms-h1">{{ change.headline }}</h1>
        <p class="ms-maya-line"><img class="ms-avatar" src="assets/maya-avatar.png" alt="" />Nothing changes until you approve. Your profile is already saved either way.</p>

        @if (change.profileChanges.length) {
          <section aria-labelledby="what-changed">
            <h2 class="ms-label" id="what-changed">What changed in your profile</h2>
            @for (row of change.profileChanges; track $index) {
              <div class="pill">
                <span class="kind" [attr.data-kind]="row.kind">{{ kindLabel(row.kind) }}</span>
                <strong>{{ row.name }}</strong>
                <span>{{ row.detail }}</span>
              </div>
            }
          </section>
        }

        @if (change.pillars.length || change.channels.length) {
          <section aria-labelledby="pillars-channels">
            <h2 class="ms-label" id="pillars-channels">Pillars and channels</h2>
            <div class="cards">
              @for (pillar of change.pillars; track pillar.key) {
                <div class="delta" [attr.data-tint]="tintOf(pillar.key, pillar.tint)">
                  <strong>{{ pillar.name }}</strong><s>{{ pillar.from }}%</s><ms-icon name="chevron-right" /><b>{{ pillar.to }}%</b>
                </div>
              }
              @for (channel of change.channels; track channel.key) {
                <div class="delta">
                  <strong>{{ channel.name }}</strong><s>{{ channel.from }}/wk</s><ms-icon name="chevron-right" /><b>{{ channel.to }}/wk</b>
                </div>
              }
              @if (unchanged()) { <div class="rest">{{ unchanged() }}</div> }
            </div>
          </section>
        }

        @if (change.affectedPosts.length) {
          <section aria-labelledby="affected">
            <h2 class="ms-label" id="affected">Planned posts this affects · {{ change.affectedPosts.length }}</h2>
            @for (post of change.affectedPosts; track post.id) {
              <div class="post" [class.is-off]="post.action === 'off_strategy'">
                <span class="day">{{ weekdayShort(post.slotDate) }} {{ dayOfMonth(post.slotDate) }}</span>
                <div>
                  @switch (post.action) {
                    @case ('replace') { <s>{{ post.title }}</s><strong>{{ post.newTitle }}</strong> }
                    @case ('rewrite') { <strong>{{ post.title }}</strong><small>{{ post.note || 'Rewritten to fit the new strategy' }}</small> }
                    @default {
                      <strong>{{ post.title }}</strong>
                      <small>{{ post.source === 'user' ? 'Your post' : 'Already approved' }}{{ post.status === 'approved' ? ', already approved' : '' }}. I won’t change it. It gets the Off-strategy chip and my suggested edit.</small>
                    }
                  }
                </div>
                <span class="tag" [attr.data-action]="post.action">{{ actionLabel(post.action) }}</span>
              </div>
            }
          </section>
        }
      </div>

      <aside class="side">
        <div class="ms-card">
          <h3>If you approve</h3>
          @if (counts().replace || counts().rewrite) { <p>{{ planned() }}</p> }
          @if (counts().off) { <p>{{ counts().off }} of your {{ counts().off === 1 ? 'posts is' : 'posts are' }} marked Off-strategy.</p> }
          <p>Approved Maya posts, pinned posts and dates don’t change.</p>
          @if (firstDate()) { <p>Starts with posts from {{ firstDate() }}.</p> }
        </div>
        <div class="ms-card">
          <h3>If you keep the current strategy</h3>
          <p>{{ keepText() }}</p>
        </div>
        <button type="button" class="ms-btn ms-btn--primary ms-btn--52 ms-btn--block" [disabled]="busy" (click)="approve.emit()">
          @if (busy) { <span class="ms-spinner" aria-hidden="true"></span> } Approve changes
        </button>
        <button type="button" class="ms-btn ms-btn--46 ms-btn--block" [disabled]="busy" (click)="keep.emit()">Keep current strategy</button>
        <p class="note">Until you choose, a banner on Today links back here.</p>
      </aside>
    </div>
  `,
} )
export class StrategyChangeComponent {
  @Input( { required: true } ) set value ( change: StrategyChange ) { this.change = change; this.changeSignal.set( change ); }
  @Input( { required: true } ) current!: Strategy;
  @Input() busy = false;
  @Output() approve = new EventEmitter<void>();
  @Output() keep = new EventEmitter<void>();

  change!: StrategyChange;
  private readonly changeSignal = signal<StrategyChange | null>( null );
  protected readonly weekdayShort = weekdayShort;
  protected readonly dayOfMonth = dayOfMonth;

  readonly savedOn = computed( () => monthDay( ( this.changeSignal()?.at ?? '' ).slice( 0, 10 ) || new Date().toISOString().slice( 0, 10 ) ).toUpperCase() );

  readonly counts = computed( () => {
    const posts = this.changeSignal()?.affectedPosts ?? [];
    return {
      replace: posts.filter( ( post ) => post.action === 'replace' ).length,
      rewrite: posts.filter( ( post ) => post.action === 'rewrite' ).length,
      off: posts.filter( ( post ) => post.action === 'off_strategy' ).length,
    };
  } );

  readonly firstDate = computed( () => {
    const dates = ( this.changeSignal()?.affectedPosts ?? [] ).map( ( post ) => post.slotDate ).sort();
    return dates.length ? `${ weekdayShort( dates[0] ) }, ${ monthDay( dates[0] ) }` : '';
  } );

  /** "How-to 30%, Behind the scenes 15% and the other channels stay the same." */
  readonly unchanged = computed( () => {
    const change = this.changeSignal();
    if ( !change || !this.current ) return '';
    const moved = new Set( change.pillars.map( ( pillar ) => pillar.key ) );
    const same = this.current.pillars.filter( ( pillar ) => !moved.has( pillar.key ) ).map( ( pillar ) => `${ pillar.name } ${ pillar.share }%` );
    const channels = change.channels.length ? 'the other channels' : 'every channel';
    if ( !same.length ) return `${ channels[0].toUpperCase() }${ channels.slice( 1 ) } stay the same.`;
    return `${ same.join( ', ' ) } and ${ channels } stay the same.`;
  } );

  planned (): string {
    const { replace, rewrite } = this.counts();
    const parts = [];
    if ( replace ) parts.push( `${ replace } planned ${ replace === 1 ? 'post is' : 'posts are' } replaced` );
    if ( rewrite ) parts.push( `${ rewrite } ${ rewrite === 1 ? 'is' : 'are' } rewritten` );
    return `${ parts.join( ' and ' ) }.`;
  }

  keepText (): string {
    const change = this.changeSignal();
    const added = change?.profileChanges.filter( ( row ) => row.kind === 'added' && row.field === 'product' ).map( ( row ) => row.name ) ?? [];
    const removed = change?.profileChanges.filter( ( row ) => row.kind === 'removed' && row.field === 'product' ).map( ( row ) => row.name ) ?? [];
    const parts = [];
    if ( added.length ) parts.push( `${ added.join( ' and ' ) } ${ added.length === 1 ? 'gets' : 'get' } no posts of ${ added.length === 1 ? 'its' : 'their' } own.` );
    if ( removed.length ) parts.push( `The ${ removed.join( ' and ' ) } posts stay planned, so they’ll mention a product that isn’t in your profile.` );
    return parts.join( ' ' ) || 'Nothing changes. Planned posts stay as they are.';
  }

  kindLabel ( kind: string ): string {
    return kind === 'added' ? 'Added' : kind === 'removed' ? 'Removed' : 'Changed';
  }

  actionLabel ( action: string ): string {
    return action === 'replace' ? 'Replaced' : action === 'rewrite' ? 'Rewritten' : 'Off-strategy';
  }

  tintOf ( key: string, tint?: string ): string {
    return tint || this.current?.pillars.find( ( pillar ) => pillar.key === key )?.tint || 'blue';
  }
}

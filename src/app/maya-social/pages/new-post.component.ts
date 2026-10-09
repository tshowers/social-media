import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, switchMap, tap } from 'rxjs/operators';

import { NotificationService } from '../../services/notification.service';
import { MayaSocialApi, NewPost, PostCheck, apiError } from '../api';
import { addDays, pillarOf, shortDate, slotLabel, wallClock } from '../format';
import { IconComponent } from '../icon.component';
import { MayaSocialState } from '../state';

const MIN_CHARS = 20;

/**
 * New post (design 1k). The owner's post goes through Maya: blocked until it
 * fits the strategy, with her reasons and her version; once it fits, it
 * takes the next open slot for its pillar (or a pinned date) and the queue
 * behind it moves (rule 7). Maya checks again as you type.
 */
@Component( {
  selector: 'ms-new-post',
  standalone: true,
  imports: [FormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .grid { display: grid; grid-template-columns: minmax(0, 1fr) 420px; gap: 40px; align-items: start; }
    .left { display: flex; flex-direction: column; gap: 22px; }
    .draft { min-height: 240px; padding: 24px; border: 0; border-radius: 28px; background: var(--surface); color: var(--text); font: 400 18px/1.6 var(--font); resize: vertical; box-shadow: none; }
    .draft:focus-visible { outline: 2px solid var(--blue) !important; outline-offset: 2px; box-shadow: none !important; }
    .group h2 { margin-bottom: 10px; font-size: 16px; font-weight: 700; }
    .pills { display: flex; flex-wrap: wrap; gap: 8px; }
    .pills .ms-btn[aria-pressed="true"] { background: var(--blue); color: #fff; }
    .pin { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
    .pin .ms-input { width: auto; }
    .right { display: flex; flex-direction: column; gap: 14px; position: sticky; top: 24px; }
    .panel { display: flex; flex-direction: column; gap: 12px; padding: 24px; border-radius: 28px; background: var(--tint, var(--surface)); color: var(--tint-fg, var(--text)); }
    .panel h2 { display: flex; align-items: center; gap: 10px; font-size: 20px; font-weight: 700; letter-spacing: -0.01em; }
    .panel ul { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 6px; font-size: 14px; line-height: 1.5; }
    .panel li::before { content: "• "; }
    .panel p { font-size: 14px; line-height: 1.5; }
    .mine { padding: 16px 18px; border-radius: 20px; background: var(--bg); color: var(--text); }
    .mine .ms-label { display: block; margin-bottom: 6px; font-size: 12px; }
    .mine p { font-size: 15px; line-height: 1.55; }
    .idle { color: var(--muted); }
    .checking { display: flex; align-items: center; gap: 10px; color: var(--muted); font-size: 15px; }
    .add:disabled { opacity: 1; background: var(--surface); color: var(--muted); }
    @media (max-width: 1000px) { .grid { grid-template-columns: minmax(0, 1fr); } .right { position: static; } }
  `],
  template: `
    <main class="ms-page">
      <div class="grid">
        <div class="left">
          <h1 class="ms-h1">New post</h1>
          <label class="ms-sr-only" for="draft">Your post</label>
          <textarea id="draft" class="draft" [ngModel]="body()" (ngModelChange)="type($event)" name="body" placeholder="Write your post. Maya checks it against your strategy as you type."></textarea>

          <div class="group">
            <h2 id="channels-label">Channels</h2>
            <div class="pills" role="group" aria-labelledby="channels-label">
              @for (channel of strategyChannels(); track channel.key) {
                <button type="button" class="ms-btn ms-btn--44" [attr.aria-pressed]="channels().includes(channel.key)" (click)="toggleChannel(channel.key)">{{ channel.name }}</button>
              }
            </div>
          </div>

          <div class="group">
            <h2 id="when-label">When</h2>
            <div class="pills" role="radiogroup" aria-labelledby="when-label">
              <button type="button" role="radio" class="ms-btn ms-btn--44" [attr.aria-pressed]="!pinned()" [attr.aria-checked]="!pinned()" (click)="setPinned(false)">Next open slot</button>
              <button type="button" role="radio" class="ms-btn ms-btn--44" [attr.aria-pressed]="pinned()" [attr.aria-checked]="pinned()" (click)="setPinned(true)">Pick a date and pin it</button>
            </div>
            @if (pinned()) {
              <div class="pin">
                <label class="ms-sr-only" for="pin-date">Date</label>
                <input id="pin-date" class="ms-input" type="date" [min]="tomorrow()" [ngModel]="slotDate()" (ngModelChange)="slotDate.set($event); recheck()" name="slotDate" />
                <label class="ms-sr-only" for="pin-time">Time</label>
                <input id="pin-time" class="ms-input" type="time" [ngModel]="time()" (ngModelChange)="time.set($event); recheck()" name="time" />
              </div>
            }
          </div>
        </div>

        <aside class="right" aria-live="polite">
          @if (checking()) {
            <div class="panel"><p class="checking"><span class="ms-spinner" aria-hidden="true"></span>Maya is checking it against your strategy…</p></div>
          } @else {
          @if (check(); as result) {
            @if (!result.aligned) {
              <div class="panel" data-tint="pink">
                <h2><img class="ms-avatar ms-avatar--32" src="assets/maya-avatar.png" alt="" />This doesn’t fit the strategy yet</h2>
                <ul>@for (reason of result.reasons; track reason) { <li>{{ reason }}</li> }</ul>
                @if (result.version) {
                  <div class="mine">
                    <span class="ms-label">My version · {{ pillarName(result.pillar) }} pillar</span>
                    <p>{{ result.version.body }}</p>
                  </div>
                  <button type="button" class="ms-btn ms-btn--primary ms-btn--50 ms-btn--block" (click)="useMaya()">Use Maya’s version</button>
                }
                <p style="font-size: 13px">Or edit yours. I’ll check it again as you type.</p>
              </div>
            } @else {
              <div class="panel" data-tint="green">
                <h2><img class="ms-avatar ms-avatar--32" src="assets/maya-avatar.png" alt="" />Fits the strategy</h2>
                @if (result.slot) {
                  <p>It takes the {{ pinned() ? 'pinned date' : 'next ' + pillarName(result.pillar) + ' slot' }}: <strong>{{ slotText(result) }}</strong>.</p>
                  @if (knockOn(result); as effect) { <p>{{ effect }}</p> }
                } @else if (result.placementError) {
                  <p>{{ result.placementError }}</p>
                }
                @if (original()) { <button type="button" class="ms-link" style="align-self: flex-start; color: inherit" (click)="goBack()">Go back to my version</button> }
              </div>
            }
          } @else {
            <div class="panel"><p class="idle">Write at least a sentence and Maya will check it against your strategy, then show you where it lands on the calendar.</p></div>
          }
          }
          <button type="button" class="ms-btn ms-btn--primary ms-btn--52 ms-btn--block add" [disabled]="!canAdd() || adding()" (click)="add()">
            @if (!canAdd()) { <ms-icon name="lock" /> } @else if (adding()) { <span class="ms-spinner" aria-hidden="true"></span> }
            Add to calendar
          </button>
        </aside>
      </div>
    </main>
  `,
} )
export class NewPostComponent implements OnInit {
  private readonly api = inject( MayaSocialApi );
  private readonly state = inject( MayaSocialState );
  private readonly router = inject( Router );
  private readonly notifications = inject( NotificationService );
  private readonly destroyRef = inject( DestroyRef );

  readonly body = signal( '' );
  readonly original = signal<string | null>( null );
  readonly channels = signal<string[]>( [] );
  readonly pinned = signal( false );
  readonly slotDate = signal( '' );
  readonly time = signal( '09:00' );
  readonly check = signal<PostCheck | null>( null );
  readonly checking = signal( false );
  readonly adding = signal( false );

  readonly strategyChannels = computed( () => this.state.strategy()?.channels ?? [] );
  readonly tomorrow = computed( () => addDays( this.state.today(), 1 ) );
  readonly canAdd = computed( () => !!this.check()?.aligned && !!this.check()?.slot && this.channels().length > 0 && !this.checking() );

  private readonly checks = new Subject<void>();

  ngOnInit (): void {
    this.channels.set( this.strategyChannels().map( ( channel ) => channel.key ) );
    this.slotDate.set( this.tomorrow() );
    this.checks.pipe(
      tap( () => this.check.set( null ) ),
      debounceTime( 1200 ),
      switchMap( () => {
        if ( this.body().trim().length < MIN_CHARS ) {
          this.checking.set( false );
          return of( null );
        }
        this.checking.set( true );
        return this.api.check( this.draft() ).pipe( catchError( ( error ) => {
          this.notifications.show( 'Maya couldn’t check it', apiError( error ).message || 'Try again.', 'error' );
          return of( null );
        } ) );
      } ),
      takeUntilDestroyed( this.destroyRef ),
    ).subscribe( ( result ) => {
      this.checking.set( false );
      this.check.set( result );
    } );
  }

  private draft (): NewPost {
    return {
      body: this.body().trim(),
      channels: this.channels(),
      pinned: this.pinned(),
      ...( this.pinned() ? { slotDate: this.slotDate(), time: this.time() } : {} ),
    };
  }

  type ( value: string ): void {
    this.body.set( value );
    this.recheck();
  }

  recheck (): void {
    this.checks.next();
  }

  toggleChannel ( key: string ): void {
    this.channels.update( ( list ) => ( list.includes( key ) ? list.filter( ( item ) => item !== key ) : [...list, key] ) );
  }

  setPinned ( pinned: boolean ): void {
    this.pinned.set( pinned );
    this.recheck();
  }

  pillarName ( key: string ): string {
    return pillarOf( this.state.strategy(), key ).name;
  }

  slotText ( result: PostCheck ): string {
    if ( !result.slot ) return '';
    const label = slotLabel( result.slot, this.state.today() );
    return label.startsWith( 'Tomorrow' ) ? `tomorrow at ${ wallClock( result.slot.time ) }` : label;
  }

  knockOn ( result: PostCheck ): string {
    const moved = result.moved;
    if ( !moved.length ) return 'Nothing else moves.';
    const first = moved[0];
    const rest = moved.length - 1;
    return `“${ first.title || 'The post there' }” moves to ${ shortDate( first.to ) }${ rest ? `, and ${ rest } more unpinned ${ rest === 1 ? 'post moves' : 'posts move' } back a day` : '' }. Pinned posts stay put.`;
  }

  useMaya (): void {
    const version = this.check()?.version;
    if ( !version ) return;
    this.original.set( this.body() );
    this.body.set( version.body );
    this.recheck();
  }

  goBack (): void {
    const original = this.original();
    if ( original === null ) return;
    this.original.set( null );
    this.body.set( original );
    this.recheck();
  }

  add (): void {
    this.adding.set( true );
    this.api.create( this.draft() ).subscribe( {
      next: ( { post } ) => {
        this.notifications.show( 'Added to your calendar', `It goes out ${ slotLabel( post, this.state.today() ).replace( /^(Today|Tomorrow)/, ( day ) => day.toLowerCase() ) }.`, 'success' );
        void this.router.navigate( ['/calendar'], { queryParams: { view: 'queue' } } );
      },
      error: ( response ) => {
        this.adding.set( false );
        const error = apiError( response );
        if ( error.check ) this.check.set( { ...error.check } );
        else this.notifications.show( 'Couldn’t add it', error.message || 'Try again.', 'error' );
      },
    } );
  }
}

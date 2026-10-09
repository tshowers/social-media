import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { NotificationService } from '../services/notification.service';
import { MayaSocialApi, Post, apiError } from './api';
import { clock } from './format';
import { IconComponent } from './icon.component';
import { MayaSocialState } from './state';

const MIN_WIDTH = 1080;
const MAX_BYTES = 10 * 1024 * 1024;
/** Uploads are re-encoded to this width at most, to fit the API's request limit. */
const UPLOAD_WIDTH = 2400;
const POLL_MS = 5000;

type State = 'maya' | 'making' | 'user' | 'missing' | 'none';

/**
 * A post's image (gaps 2l): Maya's (brief, Edit brief, Replace, Remake),
 * making (Cancel), the owner's upload (Replace, Use Maya's), or missing
 * (Try again, Upload). Three sizes: `tile` on Today's review cards, `row` in
 * the Edit sheet, `block` in the post drawer.
 */
@Component( {
  selector: 'ms-image-block',
  standalone: true,
  imports: [FormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: block; }
    .pic { position: relative; display: grid; place-items: center; overflow: hidden; border-radius: 22px; background: var(--surface2); }
    .pic img { width: 100%; height: 100%; object-fit: cover; }
    .pic .chip { position: absolute; left: 10px; bottom: 10px; display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 999px; background: var(--bg); color: var(--text); font-size: 12px; font-weight: 700; }
    .making { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 12px; background: var(--bg); color: var(--muted); font-size: 13px; font-weight: 700; text-align: center; }
    .spin { width: 22px; height: 22px; border-radius: 50%; border: 3px solid var(--surface2); border-top-color: var(--blue); animation: ms-spin .9s linear infinite; }
    .missing { display: flex; flex-direction: column; align-items: center; gap: 8px; background: var(--bg); color: var(--t-pink-fg); box-shadow: inset 0 0 0 2px var(--pink); font-size: 14px; font-weight: 700; text-align: center; padding: 12px; }
    .none { color: var(--muted); font-size: 13px; font-weight: 600; text-align: center; padding: 12px; }
    .text { font-size: 13px; line-height: 1.5; color: var(--muted); }
    .text strong { color: var(--text); }
    .text.is-missing { color: var(--t-pink-fg); }
    .actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .actions .ms-btn { height: 40px; padding: 0 10px; font-size: 13px; }
    .block .ms-btn--bg { background: var(--surface); }
    .brief { display: flex; flex-direction: column; gap: 8px; }
    .brief textarea { min-height: 70px; font-size: 14px; }

    /* tile: Today's review card, 200px square */
    .tile .pic { width: 200px; height: 200px; }
    /* block: the post drawer */
    .block { display: flex; flex-direction: column; gap: 10px; }
    .block .pic { height: 150px; }
    /* row: the Edit sheet */
    .row { display: grid; grid-template-columns: 84px 1fr auto; gap: 14px; align-items: center; padding: 10px 10px 10px 10px; border-radius: 24px; background: var(--surface); }
    .row .pic { width: 84px; height: 84px; border-radius: 18px; }
    .row .pic .chip { display: none; }
    .row .making, .row .missing, .row .none { padding: 4px; font-size: 11px; }
    .row-actions { display: flex; gap: 6px; }
    .row-actions .ms-btn { height: 36px; padding: 0 14px; font-size: 13px; }
    @media (max-width: 760px) { .tile .pic { width: 100%; height: 220px; } }
  `],
  template: `
    <input #file type="file" accept="image/jpeg,image/png" hidden (change)="picked($event)" />
    <div [class]="variant">
      <!-- the picture -->
      <div class="pic" [class.making]="state() === 'making'" [class.missing]="state() === 'missing'" [class.none]="state() === 'none'">
        @switch (state()) {
          @case ('making') { <span class="spin" aria-hidden="true"></span>@if (variant !== 'row') { <span>Making the image from my brief…</span> } }
          @case ('missing') { <ms-icon name="image" [size]="variant === 'row' ? 20 : 26" />@if (variant !== 'row') { <span>{{ needsImage() ? 'Instagram needs an image' : 'No image' }}</span> } }
          @case ('none') { No image }
          @default {
            <a [href]="image()!.url" target="_blank" rel="noopener" [attr.aria-label]="'Open the image full size'"><img [src]="image()!.url" [alt]="image()!.brief || 'Post image'" loading="lazy" /></a>
            @if (variant !== 'tile') {
              <span class="chip">@if (state() === 'maya') { <ms-icon name="sparkle" [size]="12" />Made by Maya } @else { Your image }</span>
            }
          }
        }
      </div>

      @if (variant !== 'tile') {
        <!-- what it is -->
        @if (editingBrief()) {
          <div class="brief">
            <label class="ms-sr-only" [for]="'brief-' + post.id">Image brief</label>
            <textarea class="ms-input" [id]="'brief-' + post.id" [ngModel]="brief()" (ngModelChange)="brief.set($event)" name="brief"></textarea>
            <div class="row-actions">
              <button type="button" class="ms-btn ms-btn--primary" [disabled]="busy() || !brief().trim()" (click)="act('brief', { brief: brief() })">Make it</button>
              <button type="button" class="ms-btn" (click)="editingBrief.set(false)">Cancel</button>
            </div>
          </div>
        } @else {
          <p class="text" [class.is-missing]="state() === 'missing'">
            @switch (state()) {
              @case ('maya') { @if (variant === 'row') { <strong>Image · made by Maya</strong><br /> } <strong>Brief:</strong> {{ image()!.brief }} <button type="button" class="ms-link" style="font-size: 13px" (click)="startBrief()">Edit brief</button> }
              @case ('making') { Usually under a minute. The post can be approved while it’s making. }
              @case ('user') { @if (variant === 'row') { <strong>Your image</strong><br /> } {{ image()!.fileName || 'Your upload' }}@if (image()!.width) { · {{ image()!.width }} × {{ image()!.height }}}. I keep my brief in case you want it back. }
              @case ('missing') { {{ missingText() }} }
              @default { This post goes out as text. }
            }
          </p>
        }

        <!-- what you can do -->
        @if (!editingBrief()) {
          <div [class]="variant === 'row' ? 'row-actions' : 'actions'">
            @switch (state()) {
              @case ('maya') {
                <button type="button" class="ms-btn ms-btn--bg" [disabled]="busy()" (click)="file.click()"><ms-icon name="upload" [size]="14" />Replace</button>
                <button type="button" class="ms-btn ms-btn--bg" [disabled]="busy()" (click)="act('remake')"><ms-icon name="refresh" [size]="14" />Remake</button>
              }
              @case ('making') {
                <button type="button" class="ms-btn ms-btn--bg" [disabled]="busy()" (click)="act('cancel')">Cancel</button>
              }
              @case ('user') {
                <button type="button" class="ms-btn ms-btn--bg" [disabled]="busy()" (click)="file.click()">Replace</button>
                <button type="button" class="ms-btn ms-btn--bg" [disabled]="busy()" (click)="act('maya')">Use Maya’s</button>
              }
              @default {
                <button type="button" class="ms-btn ms-btn--primary" [disabled]="busy()" (click)="act('remake')">Try again</button>
                <button type="button" class="ms-btn ms-btn--bg" [disabled]="busy()" (click)="file.click()">Upload</button>
              }
            }
          </div>
        }
      }
    </div>
  `,
} )
export class ImageBlockComponent implements OnChanges, OnDestroy {
  @Input( { required: true } ) post!: Post;
  @Input() variant: 'tile' | 'row' | 'block' = 'block';
  @Output() changed = new EventEmitter<Post>();
  @ViewChild( 'file' ) file?: ElementRef<HTMLInputElement>;

  private readonly api = inject( MayaSocialApi );
  private readonly state$ = inject( MayaSocialState );
  private readonly notifications = inject( NotificationService );
  private readonly current = signal<Post | null>( null );
  private poll: ReturnType<typeof setInterval> | null = null;

  readonly busy = signal( false );
  readonly editingBrief = signal( false );
  readonly brief = signal( '' );

  readonly image = computed( () => this.current()?.image ?? null );
  readonly needsImage = computed( () => ( this.current()?.channels ?? [] ).includes( 'instagram' ) );
  readonly state = computed<State>( () => {
    const image = this.image();
    if ( !image ) return 'none';
    if ( image.status === 'pending' || image.status === 'making' ) return 'making';
    if ( image.status === 'ready' && image.url ) return image.source === 'user' ? 'user' : 'maya';
    return image.reason === 'cancelled' && !this.needsImage() ? 'none' : 'missing';
  } );

  ngOnChanges (): void {
    this.current.set( this.post );
    this.syncPolling();
  }

  ngOnDestroy (): void {
    this.stopPolling();
  }

  missingText (): string {
    const post = this.current();
    if ( !this.needsImage() || !post ) return 'I couldn’t make this one. Try again, or upload your own.';
    const names = this.state$.channelNames();
    const others = post.channels.filter( ( key ) => key !== 'instagram' ).map( ( key ) => names[key] || key );
    const when = post.autoApproveAt ? clock( post.autoApproveAt, this.state$.timeZone() ) : 'its slot';
    return `I couldn’t make this one. If there’s still no image at ${ when }, it posts to ${ others.join( ', ' ) || 'its other channels' } only.`;
  }

  startBrief (): void {
    this.brief.set( this.image()?.brief ?? '' );
    this.editingBrief.set( true );
  }

  act ( action: 'maya' | 'remake' | 'brief' | 'cancel' | 'upload', body: { brief?: string; dataUrl?: string; fileName?: string } = {} ): void {
    const post = this.current();
    if ( !post ) return;
    this.busy.set( true );
    // Remake and a new brief take up to a minute: show "making" meanwhile.
    if ( action === 'remake' || action === 'brief' ) {
      this.current.set( { ...post, image: { source: 'maya', status: 'making', brief: body.brief ?? post.image?.brief ?? '' } } );
    }
    this.api.imageAction( post.id, action, body ).subscribe( {
      next: ( saved ) => {
        this.busy.set( false );
        this.editingBrief.set( false );
        this.update( saved );
      },
      error: ( response ) => {
        this.busy.set( false );
        this.current.set( post );
        this.notifications.show( 'That didn’t save', apiError( response ).message || 'Try again.', 'error' );
      },
    } );
  }

  /** JPG or PNG, up to 10 MB, at least 1080px wide; re-encoded to fit the upload limit. */
  async picked ( event: Event ): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if ( !file ) return;
    if ( !['image/jpeg', 'image/png'].includes( file.type ) ) return this.reject( 'Upload a JPG or PNG.' );
    if ( file.size > MAX_BYTES ) return this.reject( 'That image is over 10 MB.' );
    try {
      const bitmap = await createImageBitmap( file );
      if ( bitmap.width < MIN_WIDTH ) return this.reject( `That image is ${ bitmap.width }px wide. It needs to be at least ${ MIN_WIDTH }px.` );
      const scale = Math.min( 1, UPLOAD_WIDTH / bitmap.width );
      const canvas = document.createElement( 'canvas' );
      canvas.width = Math.round( bitmap.width * scale );
      canvas.height = Math.round( bitmap.height * scale );
      canvas.getContext( '2d' )!.drawImage( bitmap, 0, 0, canvas.width, canvas.height );
      const dataUrl = canvas.toDataURL( 'image/jpeg', 0.9 );
      this.act( 'upload', { dataUrl, fileName: file.name } );
    } catch {
      this.reject( 'That file isn’t an image I can read.' );
    }
  }

  private reject ( message: string ): void {
    this.notifications.show( 'Can’t use that image', message, 'error' );
  }

  private update ( saved: Post ): void {
    this.current.set( saved );
    this.changed.emit( saved );
    this.syncPolling();
  }

  /** While Maya is making the image, check back every few seconds. */
  private syncPolling (): void {
    if ( this.state() === 'making' && !this.busy() ) {
      if ( !this.poll ) this.poll = setInterval( () => this.refresh(), POLL_MS );
    } else {
      this.stopPolling();
    }
  }

  private refresh (): void {
    const post = this.current();
    if ( !post ) return;
    this.api.posts( post.slotDate, post.slotDate ).subscribe( ( posts ) => {
      const fresh = posts.find( ( item ) => item.id === post.id );
      if ( fresh && fresh.image?.status !== 'making' && fresh.image?.status !== 'pending' ) this.update( fresh );
    } );
  }

  private stopPolling (): void {
    if ( this.poll ) clearInterval( this.poll );
    this.poll = null;
  }
}

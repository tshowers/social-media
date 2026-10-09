import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, EventEmitter, HostListener, Input, OnInit, Output, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, switchMap, tap } from 'rxjs/operators';

import { MayaSocialApi, Post, PostCheck, apiError } from './api';
import { channelList, pillarOf, slotLabel } from './format';
import { IconComponent } from './icon.component';
import { ImageBlockComponent } from './image-block.component';
import { MayaSocialState } from './state';

/**
 * Edit post (gaps 2i; confirms the interim sheet). Maya checks the edit as
 * you type (~600 ms after you stop). Blocked: her reasons and her version;
 * Save stays locked. Aligned: saving approves it for its slot. Cancel keeps
 * Maya's draft and its auto-approve time. Same sheet from Today, Calendar
 * and the post drawer; full height on a phone.
 */
@Component( {
  selector: 'ms-edit-sheet',
  standalone: true,
  imports: [FormsModule, IconComponent, ImageBlockComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .scrim { position: fixed; inset: 0; z-index: 40; display: grid; place-items: center; padding: 16px; background: rgba(15, 17, 21, .45); }
    .sheet {
      display: grid; grid-template-columns: minmax(0, 1fr) 380px; width: min(1000px, 100%); max-height: calc(100vh - 32px);
      overflow: hidden; border-radius: 32px; background: var(--bg); box-shadow: var(--shadow);
    }
    .left { display: flex; flex-direction: column; gap: 14px; padding: 28px; overflow: auto; }
    .top { display: flex; align-items: center; justify-content: space-between; }
    h2 { font-size: 28px; font-weight: 700; letter-spacing: -0.02em; }
    .close { display: grid; place-items: center; width: 40px; height: 40px; min-height: 0; padding: 0; border: 0; border-radius: 50%; background: var(--surface); color: var(--text); box-shadow: none; }
    .close:hover { background: var(--surface2); transform: none; }
    .meta { display: flex; align-items: center; gap: 10px; font-size: 13px; font-weight: 600; color: var(--muted); }
    label { font-size: 15px; font-weight: 700; }
    .title-input { height: 48px; }
    textarea.ms-input { min-height: 170px; border-radius: 24px; }
    textarea.ms-input:focus { outline: none !important; box-shadow: inset 0 0 0 2px var(--blue) !important; }
    .right { display: flex; flex-direction: column; gap: 14px; padding: 28px; background: var(--surface); }
    .panel { display: flex; flex-direction: column; gap: 12px; padding: 20px; border-radius: 24px; background: var(--tint, var(--bg)); color: var(--tint-fg, var(--muted)); font-size: 14px; line-height: 1.5; }
    .panel h3 { display: flex; align-items: center; gap: 10px; font-size: 18px; font-weight: 700; }
    .panel ul { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; }
    .panel li::before { content: "• "; }
    .mine { padding: 16px; border-radius: 18px; background: var(--bg); color: var(--text); }
    .mine .ms-label { display: block; margin-bottom: 6px; font-size: 12px; }
    .checking { display: flex; align-items: center; gap: 10px; }
    .spacer { flex: 1; }
    .save:disabled { opacity: 1; background: var(--bg); color: var(--muted); }
    .note { font-size: 13px; color: var(--muted); text-align: center; }
    @media (max-width: 900px) {
      .scrim { padding: 0; place-items: stretch; }
      .sheet { grid-template-columns: 1fr; width: 100%; max-height: none; height: 100%; border-radius: 0; overflow: auto; }
      .left { overflow: visible; }
    }
  `],
  template: `
    <div class="scrim" (click)="cancel()">
      <section class="sheet" role="dialog" aria-modal="true" aria-labelledby="edit-title" (click)="$event.stopPropagation()">
        <div class="left">
          <div class="top">
            <h2 id="edit-title">Edit post</h2>
            <button type="button" class="close" aria-label="Close" (click)="cancel()"><ms-icon name="x" [size]="18" [stroke]="2.75" /></button>
          </div>
          <div class="meta">
            <span class="ms-chip" [attr.data-tint]="pillar().tint">{{ pillar().name }}</span>
            <span>{{ slot() }} · {{ channels() }}</span>
          </div>
          <label for="edit-title-input">Title</label>
          <input #first id="edit-title-input" class="ms-input title-input" [ngModel]="title()" (ngModelChange)="title.set($event); changed()" name="title" />
          <label for="edit-body">Post</label>
          <textarea id="edit-body" class="ms-input" rows="7" [ngModel]="body()" (ngModelChange)="body.set($event); changed()" name="body"></textarea>
          @if (post.image) { <ms-image-block [post]="post" variant="row" /> }
        </div>

        <div class="right" aria-live="polite">
          @if (checking()) {
            <div class="panel"><p class="checking"><span class="ms-spinner" aria-hidden="true"></span>Checking…</p></div>
          } @else {
          @if (check(); as result) {
            @if (result.aligned) {
              <div class="panel" data-tint="green">
                <h3><img class="ms-avatar ms-avatar--32" src="assets/maya-avatar.png" alt="" />Fits the strategy</h3>
                <p>Saving approves it for {{ slot() }}. Auto-approve no longer applies.</p>
                @if (yours() !== null) { <button type="button" class="ms-link" style="align-self: flex-start; color: inherit; font-size: 14px" (click)="goBack()">Go back to my edit</button> }
              </div>
            } @else {
              <div class="panel" data-tint="pink">
                <h3><img class="ms-avatar ms-avatar--32" src="assets/maya-avatar.png" alt="" />This edit doesn’t fit yet</h3>
                <ul>@for (reason of result.reasons; track reason) { <li>{{ reason }}</li> }</ul>
                @if (result.version) {
                  <div class="mine"><span class="ms-label">My version</span>{{ result.version.body }}</div>
                  <button type="button" class="ms-btn ms-btn--primary ms-btn--46 ms-btn--block" (click)="useMaya()">Use Maya’s version</button>
                }
              </div>
            }
          } @else {
            <div class="panel"><p>Edit the title or the post, and I’ll check it against your strategy as you type.</p></div>
          }
          }
          <div class="spacer"></div>
          <button type="button" class="ms-btn ms-btn--primary ms-btn--52 ms-btn--block save" [disabled]="!canSave() || saving()" (click)="save()">
            @if (saving()) { <span class="ms-spinner" aria-hidden="true"></span> } @else if (!canSave()) { <ms-icon name="lock" /> }
            Save and approve
          </button>
          <p class="note">Cancel keeps Maya’s draft and its auto-approve time.</p>
        </div>
      </section>
    </div>
  `,
} )
export class EditSheetComponent implements OnInit {
  @Input( { required: true } ) post!: Post;
  @Output() saved = new EventEmitter<Post>();
  @Output() closed = new EventEmitter<void>();
  @ViewChild( 'first', { static: true } ) first?: ElementRef<HTMLInputElement>;

  private readonly api = inject( MayaSocialApi );
  private readonly state = inject( MayaSocialState );
  private readonly destroyRef = inject( DestroyRef );

  readonly title = signal( '' );
  readonly body = signal( '' );
  readonly saving = signal( false );
  readonly checking = signal( false );
  readonly check = signal<PostCheck | null>( null );
  /** The owner's own edit, kept when they take Maya's version. */
  readonly yours = signal<{ title: string; body: string } | null>( null );
  private readonly edits = new Subject<void>();

  readonly pillar = computed( () => pillarOf( this.state.strategy(), this.post.pillar ) );
  readonly slot = computed( () => slotLabel( this.post, this.state.today() ) );
  readonly channels = computed( () => channelList( this.post.channels, this.state.channelNames(), this.state.strategy()?.channels.length ?? 0 ) );
  readonly canSave = computed( () => !!this.check()?.aligned && !this.checking() && !!this.body().trim() );

  ngOnInit (): void {
    this.title.set( this.post.title );
    this.body.set( this.post.body );
    queueMicrotask( () => this.first?.nativeElement.focus() );
    this.edits.pipe(
      tap( () => this.check.set( null ) ),
      debounceTime( 600 ),
      switchMap( () => {
        if ( !this.body().trim() ) return of( null );
        this.checking.set( true );
        return this.api.check( { title: this.title().trim(), body: this.body().trim(), channels: this.post.channels, pinned: false } )
          .pipe( catchError( () => of( null ) ) );
      } ),
      takeUntilDestroyed( this.destroyRef ),
    ).subscribe( ( result ) => {
      this.checking.set( false );
      this.check.set( result );
    } );
  }

  @HostListener( 'document:keydown.escape' )
  cancel (): void {
    this.closed.emit();
  }

  changed (): void {
    this.edits.next();
  }

  useMaya (): void {
    const version = this.check()?.version;
    if ( !version ) return;
    this.yours.set( { title: this.title(), body: this.body() } );
    this.title.set( version.title || this.title() );
    this.body.set( version.body );
    this.changed();
  }

  goBack (): void {
    const mine = this.yours();
    if ( !mine ) return;
    this.yours.set( null );
    this.title.set( mine.title );
    this.body.set( mine.body );
    this.changed();
  }

  save (): void {
    this.saving.set( true );
    this.api.edit( this.post.id, { title: this.title().trim(), body: this.body().trim() } ).subscribe( {
      next: ( post ) => {
        this.saving.set( false );
        this.saved.emit( post );
      },
      error: ( response ) => {
        this.saving.set( false );
        const error = apiError( response );
        this.check.set( error.check ?? { aligned: false, pillar: this.post.pillar, reasons: ['That didn’t save. Try again.'], version: null, slot: null, moved: [], placementError: null } );
      },
    } );
  }
}

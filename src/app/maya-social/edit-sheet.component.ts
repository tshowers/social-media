import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, HostListener, Input, OnInit, Output, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { MayaSocialApi, Post, PostCheck, apiError } from './api';

/**
 * Edit on a post (1a). Saving checks the edit against the strategy like a
 * new post (rule 7): if it fits, it's saved and approved in its slot; if
 * not, Maya says why and offers her version.
 */
@Component( {
  selector: 'ms-edit-sheet',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .scrim { position: fixed; inset: 0; z-index: 40; display: grid; place-items: center; padding: 16px; background: rgba(15, 17, 21, .45); }
    .sheet {
      display: flex; flex-direction: column; gap: 16px; width: min(640px, 100%); max-height: calc(100vh - 32px); overflow: auto;
      padding: 28px; border-radius: 28px; background: var(--bg); box-shadow: var(--shadow);
    }
    h2 { font-size: 24px; font-weight: 700; letter-spacing: -0.02em; }
    .blocked { display: flex; flex-direction: column; gap: 10px; padding: 18px 20px; border-radius: 22px; background: var(--t-pink); color: var(--t-pink-fg); font-size: 14px; line-height: 1.5; }
    .blocked strong { font-size: 16px; }
    .blocked ul { margin: 0; padding-left: 18px; }
    .version { padding: 14px 16px; border-radius: 18px; background: var(--bg); color: var(--text); }
    .version b { display: block; margin-bottom: 4px; font-size: 15px; }
    .actions { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 10px; }
    @media (max-width: 760px) { .scrim { place-items: end center; padding: 0; } .sheet { border-radius: 28px 28px 0 0; padding: 22px 16px calc(22px + env(safe-area-inset-bottom)); } }
  `],
  template: `
    <div class="scrim" (click)="cancel()">
      <section class="sheet" role="dialog" aria-modal="true" aria-labelledby="edit-title" (click)="$event.stopPropagation()">
        <h2 id="edit-title">Edit post</h2>
        <label class="ms-field-label" for="edit-title-input">Title</label>
        <input #first id="edit-title-input" class="ms-input" [ngModel]="title()" (ngModelChange)="title.set($event)" name="title" />
        <label class="ms-field-label" for="edit-body">Post</label>
        <textarea id="edit-body" class="ms-input" rows="7" [ngModel]="body()" (ngModelChange)="body.set($event)" name="body"></textarea>

        @if (check(); as result) {
          <div class="blocked" role="alert">
            <strong>This doesn’t fit the strategy yet</strong>
            <ul>@for (reason of result.reasons; track reason) { <li>{{ reason }}</li> }</ul>
            @if (result.version) {
              <div class="version"><b>{{ result.version.title }}</b>{{ result.version.body }}</div>
              <button type="button" class="ms-btn ms-btn--primary" (click)="useMaya()">Use Maya’s version</button>
            }
          </div>
        }

        <div class="actions">
          <button type="button" class="ms-btn" (click)="cancel()">Cancel</button>
          <button type="button" class="ms-btn ms-btn--primary" [disabled]="busy() || !body().trim()" (click)="save()">
            @if (busy()) { <span class="ms-spinner" aria-hidden="true"></span> Maya is checking… } @else { Save and approve }
          </button>
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

  readonly title = signal( '' );
  readonly body = signal( '' );
  readonly busy = signal( false );
  readonly check = signal<PostCheck | null>( null );

  ngOnInit (): void {
    this.title.set( this.post.title );
    this.body.set( this.post.body );
    queueMicrotask( () => this.first?.nativeElement.focus() );
  }

  @HostListener( 'document:keydown.escape' )
  cancel (): void {
    this.closed.emit();
  }

  useMaya (): void {
    const version = this.check()?.version;
    if ( !version ) return;
    this.title.set( version.title || this.title() );
    this.body.set( version.body );
    this.check.set( null );
  }

  save (): void {
    this.busy.set( true );
    this.check.set( null );
    this.api.edit( this.post.id, { title: this.title().trim(), body: this.body().trim() } ).subscribe( {
      next: ( post ) => {
        this.busy.set( false );
        this.saved.emit( post );
      },
      error: ( response ) => {
        this.busy.set( false );
        const error = apiError( response );
        if ( error.check ) this.check.set( error.check );
        else this.check.set( { aligned: false, pillar: this.post.pillar, reasons: [error.message || 'Couldn’t save. Try again.'], version: null, slot: null, moved: [], placementError: null } );
      },
    } );
  }
}

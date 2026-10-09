import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { MayaSocialApi, OneTapResult } from '../api';
import { IconComponent } from '../icon.component';

/**
 * Where one-tap Approve / Hold links from Maya's email land (gaps 2t). No
 * sign-in: the signed, single-use link is the permission. Undo is another
 * one-tap link, also good once.
 */
@Component( {
  selector: 'ms-act',
  standalone: true,
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .col { display: flex; flex-direction: column; align-items: flex-start; gap: 18px; max-width: 720px; margin: 0 auto; padding: 56px 40px 72px; }
    .mark { display: grid; place-items: center; width: 64px; height: 64px; border-radius: 50%; background: var(--tint); color: var(--tint-fg); }
    h1 { font-size: 40px; font-weight: 700; letter-spacing: -0.03em; }
    p { font-size: 17px; line-height: 1.6; color: var(--muted); }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; }
    @media (max-width: 760px) { .col { padding: 32px 16px; } h1 { font-size: 32px; } }
  `],
  template: `
    <main class="col" aria-live="polite">
      @if (outcome(); as out) {
        <span class="mark" [attr.data-tint]="tint(out.result)"><ms-icon [name]="icon(out.result)" [size]="24" [stroke]="3" /></span>
        <h1>{{ heading(out) }}</h1>
        <p>{{ detail(out) }}</p>
        <div class="actions">
          @if (out.undo && !undone()) {
            <button type="button" class="ms-btn ms-btn--46" (click)="run(out.undo, true)">Undo</button>
          }
          <a class="ms-btn ms-btn--primary ms-btn--46" routerLink="/today">Open Today</a>
        </div>
      } @else {
        <p class="ms-maya-line"><span class="ms-spinner" aria-hidden="true"></span>One moment…</p>
      }
    </main>
  `,
} )
export class ActComponent implements OnInit {
  private readonly api = inject( MayaSocialApi );
  private readonly route = inject( ActivatedRoute );

  readonly working = signal( true );
  readonly outcome = signal<OneTapResult | null>( null );
  readonly undone = signal( false );

  ngOnInit (): void {
    this.run( this.route.snapshot.queryParamMap.get( 't' ) || '', false );
  }

  run ( token: string, undo: boolean ): void {
    this.working.set( true );
    this.outcome.set( null );
    this.api.oneTap( token ).subscribe( {
      next: ( result ) => {
        this.working.set( false );
        if ( undo ) this.undone.set( true );
        this.outcome.set( result );
      },
      error: () => {
        this.working.set( false );
        this.outcome.set( { result: 'error' } );
      },
    } );
  }

  heading ( out: OneTapResult ): string {
    switch ( out.result ) {
      case 'approved': return 'Approved.';
      case 'held': return 'Held.';
      case 'undone': return 'Undone.';
      case 'already_out': return 'This post already went out.';
      case 'used': return 'This link was already used.';
      case 'expired': return 'This link has expired.';
      case 'error': return 'That didn’t save.';
      default: return 'This link doesn’t work.';
    }
  }

  detail ( out: OneTapResult ): string {
    const title = out.title ? `“${ out.title }”` : 'The post';
    const when = ( out.slotLabel || '' ).replace( /^Today/, 'today' ).replace( /^(\w{3}) at/, 'on $1 at' );
    switch ( out.result ) {
      case 'approved': return `${ title } goes out ${ when }.`;
      case 'held': return out.rewriteBy ? `I’ll rewrite it by ${ out.rewriteBy }. It keeps its slot.` : 'It keeps its slot. If the slot arrives still held, nothing goes out that day.';
      case 'undone': return `${ title } is back in review.`;
      case 'already_out': return 'Links work until a post’s slot. Open Today to see what’s next.';
      case 'used': return 'Each link works once. Open Today to approve or hold from there.';
      case 'expired': return 'Links last 24 hours. Open Today to approve or hold from there.';
      case 'error': return 'Try the link again, or open Today.';
      default: return 'Open Today to approve or hold from there.';
    }
  }

  tint ( result: string ): string {
    return result === 'approved' || result === 'undone' ? 'green' : result === 'held' ? 'blue' : 'yellow';
  }

  icon ( result: string ): 'check' | 'alert' | 'moved' {
    return result === 'approved' || result === 'undone' ? 'check' : result === 'held' ? 'moved' : 'alert';
  }
}

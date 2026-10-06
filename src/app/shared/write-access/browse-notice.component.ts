// Synced from taliferro-ui/write-access - edit there, then run sync.sh.
import { AsyncPipe, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { WriteAccessService } from '../../services/write-access.service';
import { WRITE_ACCESS_APP } from './write-access.config';

/**
 * The note at the top of a page for anyone who can only view: sign in
 * (signed out) or get the app (signed in without it). Nothing for someone
 * who can make changes. `what` names the thing on the page: "this document".
 */
@Component( {
  selector: 'app-browse-notice',
  standalone: true,
  imports: [AsyncPipe, NgIf, RouterLink],
  template: `
    <ng-container *ngIf="state$ | async as state">
      <aside *ngIf="state !== 'canWrite'" class="bn" role="note" data-cy="browse-notice">
        <p *ngIf="state === 'signedOut'"><strong>You’re viewing {{ what }}.</strong> Sign in to make changes.</p>
        <p *ngIf="state === 'browsing'"><strong>You can view {{ what }}.</strong> Changing it needs the {{ app.name }} app.</p>
        <button *ngIf="state === 'signedOut'" type="button" class="bn__btn" (click)="signIn()">Sign in</button>
        <a *ngIf="state === 'browsing'" class="bn__btn" routerLink="/ios">Get {{ app.name }}</a>
      </aside>
    </ng-container>
  `,
  styles: [`
    .bn { display: flex; align-items: center; gap: 12px; margin: 0 0 16px; padding: 12px 12px 12px 18px; border-radius: 18px; background: var(--t-blue); color: var(--t-blue-fg); font-family: var(--font); }
    .bn p { flex: 1; margin: 0; font-size: 14px; line-height: 1.45; }
    .bn__btn { display: inline-flex; align-items: center; height: 36px; padding: 0 16px; border: 0; border-radius: 999px; background: var(--text); color: var(--bg) !important; font: 700 14px/1 var(--font); text-decoration: none; white-space: nowrap; cursor: pointer; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
} )
export class BrowseNoticeComponent {
  @Input() what = 'this page';
  readonly app = WRITE_ACCESS_APP;
  readonly state$ = inject( WriteAccessService ).state( WRITE_ACCESS_APP.product );
  private readonly router = inject( Router );

  signIn (): void {
    void this.router.navigate( [this.app.signInRoute], { queryParams: { returnUrl: this.router.url } } );
  }
}

// Synced from taliferro-ui/write-access - edit there, then run sync.sh.
import { AsyncPipe, NgIf } from '@angular/common';
import { Component, HostListener, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { WRITE_ACCESS_APP } from './write-access.config';
import { WriteAccessPromptService } from './write-access-prompt.service';

/** The prompt WriteActionDirective opens: sign in, or get the app. Put it once in the root component. */
@Component( {
  selector: 'app-write-access-prompt',
  standalone: true,
  imports: [AsyncPipe, NgIf, RouterLink],
  template: `
    <div class="wap" *ngIf="prompts.prompt$ | async as prompt" (click)="prompts.close()" role="presentation">
      <section class="wap__card" role="dialog" aria-modal="true" aria-labelledby="wap-title" (click)="$event.stopPropagation()">
        <ng-container *ngIf="prompt.state === 'signedOut'; else getApp">
          <h2 id="wap-title">Sign in to {{ prompt.action }}</h2>
          <p>You can look around {{ app.name }} without an account. Sign in with your TODD account to make changes.</p>
          <div class="wap__actions">
            <button type="button" class="wap__primary" (click)="signIn()">Sign in</button>
            <button type="button" class="wap__secondary" (click)="prompts.close()">Keep browsing</button>
          </div>
        </ng-container>
        <ng-template #getApp>
          <h2 id="wap-title">Get {{ app.name }} for iOS to {{ prompt.action }}</h2>
          <p>Viewing is free. Creating, changing and deleting come with the {{ app.name }} app on your iPhone or iPad, and one subscription unlocks them here too.</p>
          <div class="wap__actions">
            <a class="wap__primary" routerLink="/ios" (click)="prompts.close()">Get the app</a>
            <button type="button" class="wap__secondary" (click)="prompts.close()">Keep browsing</button>
          </div>
        </ng-template>
      </section>
    </div>
  `,
  styles: [`
    .wap { position: fixed; inset: 0; z-index: 10010; display: grid; place-items: center; padding: 16px; background: rgba(15, 17, 21, .45); font-family: var(--font); }
    .wap__card { width: min(440px, 100%); padding: 24px; border-radius: 24px; background: var(--bg); color: var(--text); box-shadow: var(--shadow); }
    .wap__card h2 { margin: 0; font-size: 22px !important; letter-spacing: -0.02em; }
    .wap__card p { margin: 8px 0 0; color: var(--muted); font-size: 15px; line-height: 1.5; }
    .wap__actions { display: flex; gap: 8px; margin-top: 20px; }
    .wap__primary, .wap__secondary { display: inline-flex; align-items: center; justify-content: center; height: 44px; padding: 0 20px; border: 0; border-radius: 999px; font-size: 15px; font-weight: 700; text-decoration: none; cursor: pointer; }
    .wap__primary { background: var(--blue); color: #fff !important; }
    .wap__secondary { background: var(--surface); color: var(--text); }
  `]
} )
export class WriteAccessPromptComponent {
  readonly prompts = inject( WriteAccessPromptService );
  readonly app = WRITE_ACCESS_APP;
  private readonly router = inject( Router );

  @HostListener( 'document:keydown.escape' )
  close (): void {
    this.prompts.close();
  }

  signIn (): void {
    this.prompts.close();
    void this.router.navigate( [this.app.signInRoute], { queryParams: { returnUrl: this.router.url } } );
  }
}

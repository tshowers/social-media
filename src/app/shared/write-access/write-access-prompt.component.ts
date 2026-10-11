// Synced from taliferro-ui/write-access - edit there, then run sync.sh.
import { AsyncPipe, NgIf } from '@angular/common';
import { Component, HostListener, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { GET_THE_APP_PRODUCTS } from '@taliferro/ui/platform/get-the-app.model';

import { WebCheckoutService } from './web-checkout.service';
import { WRITE_ACCESS_APP } from './write-access.config';
import { WriteAccessPrompt, WriteAccessPromptService } from './write-access-prompt.service';

type Phase = 'ask' | 'starting' | 'waiting' | 'done' | 'error';

/**
 * The prompt WriteActionDirective opens: sign in, or subscribe right here
 * (Ty, 2026-10-11 - pay at the moment of intent, buy once, use everywhere).
 * Stripe opens in a new tab so the unsaved work stays on this page; once
 * the webhook unlocks the product, the stopped button is pressed again.
 * Put it once in the root component.
 */
@Component( {
  selector: 'app-write-access-prompt',
  standalone: true,
  imports: [AsyncPipe, NgIf, RouterLink],
  template: `
    <div class="wap" *ngIf="prompts.prompt$ | async as prompt" (click)="dismiss()" role="presentation">
      <section class="wap__card" role="dialog" aria-modal="true" aria-labelledby="wap-title" (click)="$event.stopPropagation()" data-cy="write-access-prompt">
        <ng-container *ngIf="prompt.state === 'signedOut'">
          <h2 id="wap-title">Sign in to {{ prompt.action }}</h2>
          <p>You can look around {{ app.name }} without an account. Sign in with your TODD account to make changes.</p>
          <div class="wap__actions">
            <button type="button" class="wap__primary" (click)="signIn()">Sign in</button>
            <button type="button" class="wap__secondary" (click)="dismiss()">Keep browsing</button>
          </div>
        </ng-container>

        <ng-container *ngIf="prompt.state === 'browsing' && price">
          <ng-container *ngIf="phase === 'ask' || phase === 'starting' || phase === 'error'">
            <h2 id="wap-title">Subscribe to {{ prompt.action }}</h2>
            <p>{{ app.name }} is {{ price }}/month. Cancel anytime. Your work stays right here while you pay.</p>
            <p *ngIf="phase === 'error'" class="wap__error" role="alert">{{ error }}</p>
            <div class="wap__actions">
              <button type="button" class="wap__primary" [disabled]="phase === 'starting'" (click)="subscribe( prompt )" data-cy="write-access-subscribe">
                {{ phase === 'starting' ? 'Opening checkout…' : 'Continue · ' + price + '/mo' }}
              </button>
              <button type="button" class="wap__secondary" (click)="dismiss()">Not now</button>
            </div>
            <p class="wap__fine">One subscription works here and in the {{ app.name }} iPhone app. <a routerLink="/ios" (click)="dismiss()">Get the app</a></p>
          </ng-container>
          <ng-container *ngIf="phase === 'waiting'">
            <h2 id="wap-title">Finish checkout in the new tab</h2>
            <p>We’ll pick up where you left off as soon as your payment goes through.</p>
            <div class="wap__actions">
              <button type="button" class="wap__secondary" (click)="dismiss()">Cancel</button>
            </div>
          </ng-container>
          <ng-container *ngIf="phase === 'done'">
            <h2 id="wap-title">You’re subscribed to {{ app.name }}</h2>
            <p>Thanks! Everything in {{ app.name }} is unlocked, here and in the iPhone app.</p>
            <div class="wap__actions">
              <button type="button" class="wap__primary" (click)="dismiss()">Continue</button>
            </div>
          </ng-container>
        </ng-container>

        <ng-container *ngIf="prompt.state === 'browsing' && !price">
          <h2 id="wap-title">{{ app.name }} subscriptions are coming soon</h2>
          <p>You can look around {{ app.name }} now. Creating and changing things opens up when subscriptions launch.</p>
          <div class="wap__actions">
            <button type="button" class="wap__secondary" (click)="dismiss()">Keep browsing</button>
          </div>
        </ng-container>
      </section>
    </div>
  `,
  styles: [`
    .wap { position: fixed; inset: 0; z-index: 10010; display: grid; place-items: center; padding: 16px; background: rgba(15, 17, 21, .45); font-family: var(--font); }
    .wap__card { width: min(440px, 100%); padding: 24px; border-radius: 24px; background: var(--bg); color: var(--text); box-shadow: var(--shadow); }
    .wap__card h2 { margin: 0; font-size: 22px !important; letter-spacing: -0.02em; }
    .wap__card p { margin: 8px 0 0; color: var(--muted); font-size: 15px; line-height: 1.5; }
    .wap__card .wap__error { color: var(--red, #d70015); }
    .wap__card .wap__fine { margin-top: 16px; font-size: 13px; }
    .wap__fine a { color: var(--blue); }
    .wap__actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 20px; }
    .wap__primary, .wap__secondary { display: inline-flex; align-items: center; justify-content: center; height: 44px; padding: 0 20px; border: 0; border-radius: 999px; font-size: 15px; font-weight: 700; text-decoration: none; cursor: pointer; }
    .wap__primary { background: var(--blue); color: #fff !important; }
    .wap__primary[disabled] { opacity: .6; cursor: progress; }
    .wap__secondary { background: var(--surface); color: var(--text); }
  `]
} )
export class WriteAccessPromptComponent implements OnInit {
  readonly prompts = inject( WriteAccessPromptService );
  readonly app = WRITE_ACCESS_APP;
  /** The monthly price, or '' while the product isn't sold yet (Social). */
  readonly price = GET_THE_APP_PRODUCTS[WRITE_ACCESS_APP.product]?.monthlyPrice || '';
  phase: Phase = 'ask';
  error = '';
  private readonly router = inject( Router );
  private readonly checkout = inject( WebCheckoutService );
  private waitId = 0;

  ngOnInit (): void {
    void this.handleReturnFromCheckout();
  }

  @HostListener( 'document:keydown.escape' )
  dismiss (): void {
    this.waitId += 1;
    this.phase = 'ask';
    this.error = '';
    this.prompts.close();
  }

  signIn (): void {
    this.prompts.close();
    void this.router.navigate( [this.app.signInRoute], { queryParams: { returnUrl: this.router.url } } );
  }

  async subscribe ( prompt: WriteAccessPrompt ): Promise<void> {
    // Opened synchronously, inside the click, or the browser blocks it.
    const tab = window.open( '', '_blank' );
    this.phase = 'starting';
    try {
      const result = await this.checkout.start( this.app.product, tab );
      if ( result === 'alreadySubscribed' ) {
        this.finish( prompt );
        return;
      }
    } catch ( error ) {
      this.phase = 'error';
      this.error = ( error as Error ).message;
      return;
    }
    // No tab (pop-up blocked): this page is on its way to Stripe.
    if ( !tab ) return;
    this.phase = 'waiting';
    const id = ++this.waitId;
    const unlocked = await this.checkout.waitForAccess( this.app.product, () => id !== this.waitId );
    if ( unlocked && id === this.waitId ) this.finish( prompt );
  }

  /** Unlocks the page and presses the button that was stopped. */
  private finish ( prompt: WriteAccessPrompt ): void {
    this.prompts.unlock();
    const button = prompt.element;
    if ( button?.isConnected ) {
      this.prompts.close();
      this.phase = 'ask';
      setTimeout( () => button.click() );
      return;
    }
    this.phase = 'done';
  }

  /** Stripe sends people back here with ?checkout=... (resume=tab when it ran in its own tab). */
  private async handleReturnFromCheckout (): Promise<void> {
    // Pages are prerendered on the server, where there's no URL to read.
    if ( typeof window === 'undefined' ) return;
    const params = new URLSearchParams( location.search );
    const result = params.get( 'checkout' );
    if ( !result ) return;
    ['checkout', 'product', 'resume', 'session_id', 'pack'].forEach( ( key ) => params.delete( key ) );
    const rest = params.toString();
    history.replaceState( history.state, '', `${location.pathname}${rest ? `?${rest}` : ''}${location.hash}` );

    if ( result === 'success' && window.opener ) {
      // The checkout tab: the original page is waiting for the purchase.
      window.close();
      return;
    }
    if ( result !== 'success' ) return;
    // Same-tab checkout (pop-up was blocked): confirm, then show it's done.
    const unlocked = await this.checkout.waitForAccess( this.app.product, () => false, 60 * 1000 );
    if ( !unlocked ) return;
    this.prompts.unlock();
    this.phase = 'done';
    this.prompts.open( { state: 'browsing', action: 'make changes' } );
  }
}

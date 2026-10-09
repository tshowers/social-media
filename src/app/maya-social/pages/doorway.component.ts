import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { SiteFooterComponent } from '../../shared/site-footer/site-footer.component';

import { SocialAuthService } from '../../services/social-auth.service';
import { MAYA_PRICING_URL } from '../header.component';
import { MayaSocialState } from '../state';

/**
 * 1o, the doorway at social.taliferro.tech: what Maya Social is, for
 * people signed out or without Maya. "Get Maya" is the only action for a
 * signed-in visitor without it.
 */
@Component( {
  selector: 'ms-doorway',
  standalone: true,
  imports: [RouterLink, SiteFooterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    /* app-root is a full-height column while this page shows (styles.css), so the footer sits at the bottom. */
    :host { display: flex; flex-direction: column; flex: 1 0 auto; }
    .door {
      box-sizing: border-box; width: 100%;
      display: grid; grid-template-columns: 1.1fr 1fr; gap: 56px; align-items: center;
      max-width: 1280px; margin: 0 auto; padding: 48px 40px 64px;
    }
    .left { display: flex; flex-direction: column; align-items: flex-start; gap: 24px; }
    .tag {
      padding: 6px 14px; border-radius: 999px; background: var(--t-green); color: var(--t-green-fg);
      font-size: 13px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
    }
    h1 { font-size: 60px; font-weight: 700; letter-spacing: -0.045em; line-height: 1; text-wrap: balance; }
    .lead { max-width: 540px; font-size: 18px; line-height: 1.6; color: var(--muted); }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; }
    .channels { display: flex; flex-wrap: wrap; gap: 8px; }
    .channels span { padding: 6px 12px; border-radius: 999px; background: var(--surface); font-size: 13px; font-weight: 700; }
    .note { font-size: 15px; color: var(--muted); }
    .how { display: flex; flex-direction: column; gap: 14px; padding: 26px; border-radius: 32px; background: var(--surface); }
    .how-head { display: flex; align-items: center; gap: 10px; font-size: 15px; font-weight: 700; }
    .step { display: grid; grid-template-columns: 30px 1fr; gap: 14px; padding: 16px; border-radius: 22px; background: var(--bg); }
    .num { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 50%; font-size: 14px; font-weight: 700; background: var(--tint); color: var(--tint-fg); }
    .step h2 { font-size: 16px; font-weight: 700; margin-bottom: 4px; }
    .step p { font-size: 14px; line-height: 1.5; color: var(--muted); }
    @media (max-width: 900px) {
      .door { grid-template-columns: 1fr; gap: 32px; padding: 24px 16px 40px; }
      h1 { font-size: 42px; }
    }
  `],
  template: `
    <main class="door">
      <section class="left">
        <span class="tag">Included with Maya</span>
        <h1>Maya runs your social media.</h1>
        <p class="lead">She builds a posting strategy from your company profile and keeps something going out every day. You approve or hold posts. The plan and the calendar are hers.</p>
        <div class="actions">
          <a class="ms-btn ms-btn--primary ms-btn--54" [href]="pricingUrl">Get Maya</a>
          @if (!state.signedIn()) {
            <button type="button" class="ms-btn ms-btn--54" (click)="signIn()">I have Maya. Sign in</button>
          }
        </div>
        @if (state.signedIn()) {
          <p class="note">You're signed in as {{ state.email() }}, but this account doesn't have Maya yet. Maya Social comes with every Maya plan.</p>
        }
        <div class="channels" aria-label="Channels">
          @for (channel of channels; track channel) { <span>{{ channel }}</span> }
        </div>
      </section>

      <aside class="how" aria-labelledby="how-title">
        <div class="how-head"><img class="ms-avatar ms-avatar--32" src="assets/maya-avatar.png" alt="" /><span id="how-title">How it works</span></div>
        <div class="step" data-tint="blue">
          <span class="num">1</span>
          <div><h2>Maya reads your profile</h2><p>Company name, goal, and what you sell. That's all she needs to build a strategy.</p></div>
        </div>
        <div class="step" data-tint="violet">
          <span class="num">2</span>
          <div><h2>She plans the calendar</h2><p>A post every day, about three weeks ahead, across your channels.</p></div>
        </div>
        <div class="step" data-tint="green">
          <span class="num">3</span>
          <div><h2>You check in when you want</h2><p>Posts approve themselves {{ defaultHours }} hours after she drafts them, unless you hold them.</p></div>
        </div>
      </aside>
    </main>

    <app-site-footer><a routerLink="/help">Help</a><a routerLink="/about">About</a></app-site-footer>
  `,
} )
export class DoorwayComponent {
  readonly state = inject( MayaSocialState );
  private readonly auth = inject( SocialAuthService );

  readonly pricingUrl = MAYA_PRICING_URL;
  readonly defaultHours = 6;
  readonly channels = ['LinkedIn', 'Instagram', 'Facebook', 'Threads', 'Google Business'];

  signIn (): void {
    this.auth.signIn( '/' );
  }
}

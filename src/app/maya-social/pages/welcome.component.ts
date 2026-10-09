import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { NotificationService } from '../../services/notification.service';
import { AutoApproveHours, MayaSocialApi, apiError } from '../api';
import { MayaSocialState } from '../state';

/**
 * 1p, first run: how Maya works, and the auto-approve hours. "Set up Maya
 * Social" records the visit and goes to the profile check (Strategy shows
 * 1h or 1i). "Not now" goes to Today for this visit; 1p shows again next
 * time until set up.
 */
@Component( {
  selector: 'ms-welcome',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .col { display: flex; flex-direction: column; gap: 32px; max-width: 880px; margin: 0 auto; padding: 48px 40px 72px; }
    .tag {
      align-self: flex-start; padding: 5px 12px; border-radius: 999px; background: var(--t-green); color: var(--t-green-fg);
      font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
    }
    .intro { display: flex; flex-direction: column; gap: 16px; }
    h1 { font-size: 48px; font-weight: 700; letter-spacing: -0.03em; line-height: 1.05; }
    ol { display: flex; flex-direction: column; gap: 14px; margin: 0; padding: 0; list-style: none; }
    li { display: grid; grid-template-columns: 30px 1fr; gap: 14px; align-items: start; font-size: 16px; line-height: 1.5; }
    .num { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 50%; background: var(--surface); font-size: 13px; font-weight: 700; }
    li span:last-child { padding-top: 3px; }
    .setting { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; padding: 22px 24px; border-radius: 28px; background: var(--surface); }
    .setting h2 { font-size: 16px; font-weight: 700; }
    .setting p { font-size: 14px; color: var(--muted); }
    .actions { display: flex; align-items: center; flex-wrap: wrap; gap: 20px; }
    @media (max-width: 760px) {
      .col { padding: 24px 16px 48px; gap: 24px; }
      h1 { font-size: 34px; }
    }
  `],
  template: `
    <main class="col">
      <img class="ms-avatar ms-avatar--64" src="assets/maya-avatar.png" alt="Maya" />
      <div class="intro">
        <span class="tag">Included with your Maya plan</span>
        <h1>Before I take over your calendar, here’s how I work.</h1>
      </div>

      <ol>
        <li><span class="num">1</span><span><strong>I decide what goes out and when.</strong> Every post fits the strategy I build from your profile.</span></li>
        <li><span class="num">2</span><span><strong>Posts approve themselves</strong> after the time you pick below, unless you hold them.</span></li>
        <li><span class="num">3</span><span><strong>A held post keeps its slot.</strong> Unpinned posts behind it move back a day.</span></li>
        <li><span class="num">4</span><span><strong>Pinned posts never move.</strong> If one isn’t approved by its date, it expires.</span></li>
      </ol>

      <section class="setting" aria-labelledby="auto-approve-label">
        <h2 id="auto-approve-label">Auto-approve after</h2>
        <div class="ms-seg ms-seg--blue" role="radiogroup" aria-labelledby="auto-approve-label">
          @for (option of options; track option) {
            <button type="button" role="radio" [attr.aria-checked]="hours() === option" [class.is-on]="hours() === option" (click)="hours.set(option)">{{ option }} hours</button>
          }
        </div>
        <p>You can change this later in Profile.</p>
      </section>

      <div class="actions">
        <button type="button" class="ms-btn ms-btn--primary ms-btn--56" [disabled]="busy()" (click)="setUp()">
          @if (busy()) { <span class="ms-spinner" aria-hidden="true"></span> }
          Set up Maya Social
        </button>
        <button type="button" class="ms-link" (click)="notNow()">Not now</button>
      </div>
    </main>
  `,
} )
export class WelcomeComponent {
  private readonly api = inject( MayaSocialApi );
  private readonly state = inject( MayaSocialState );
  private readonly router = inject( Router );
  private readonly notifications = inject( NotificationService );

  readonly options: AutoApproveHours[] = [2, 4, 6];
  readonly hours = signal<AutoApproveHours>( 6 );
  readonly busy = signal( false );

  setUp (): void {
    this.busy.set( true );
    this.api.onboard( this.hours() ).subscribe( {
      next: ( overview ) => {
        this.state.set( { ...overview, entitled: true } );
        void this.router.navigate( [overview.strategy ? '/today' : '/strategy'] );
      },
      error: ( error ) => {
        this.busy.set( false );
        this.notifications.show( 'Couldn’t set up', apiError( error ).message || 'Try again.', 'error' );
      },
    } );
  }

  notNow (): void {
    this.state.setNotNow();
    void this.router.navigate( ['/today'] );
  }
}

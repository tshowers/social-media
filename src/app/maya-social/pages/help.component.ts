import { ChangeDetectionStrategy, Component } from '@angular/core';

import { ProductPagesComponent } from '../../shared/product-pages/product-pages.component';

/**
 * Help: the shared template, plus how Maya runs the calendar - where every
 * "More in Help" link in the 1q popovers lands (#how-it-works).
 */
@Component( {
  selector: 'ms-help-page',
  standalone: true,
  imports: [ProductPagesComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .how { display: flex; flex-direction: column; gap: 16px; scroll-margin-top: 24px; }
    .how > h2 { font-size: 28px; font-weight: 700; letter-spacing: -0.02em; }
    .how > p { max-width: 720px; font-size: 16px; line-height: 1.6; color: var(--muted); }
    .cards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    article { display: flex; flex-direction: column; gap: 8px; padding: 24px; border-radius: 28px; background: var(--tint); color: var(--tint-fg); scroll-margin-top: 24px; }
    article h3 { font-size: 19px; font-weight: 700; }
    article p { font-size: 15px; line-height: 1.6; color: var(--text); }
    @media (max-width: 760px) { .cards { grid-template-columns: 1fr; } }
  `],
  template: `
    <app-product-pages page="help">
      <section class="how" id="how-it-works" aria-labelledby="how-title">
        <h2 id="how-title">How Maya runs your calendar</h2>
        <p>Maya keeps a post going out every day. She plans about three weeks ahead, writes each post three days before its slot, and asks you only when one needs you.</p>
        <div class="cards">
          <article id="auto-approve" data-tint="blue">
            <h3>Auto-approve</h3>
            <p>Each post opens for review a few hours before its slot. If you don’t hold it within your auto-approve time (2, 4 or 6 hours, set in Profile), it’s approved and goes out in its slot.</p>
          </article>
          <article id="hold" data-tint="pink">
            <h3>Hold</h3>
            <p>A held post keeps its slot, and Maya rewrites it for you to review. If the slot arrives and it’s still held, nothing goes out that day, it moves to the next day, and every unpinned post behind it moves back a day.</p>
          </article>
          <article id="pinned" data-tint="violet">
            <h3>Pinned posts</h3>
            <p>Pinned posts are tied to a date, like an event or a launch. They never move, and sliding posts skip over them. If one isn’t approved by its date, it expires.</p>
          </article>
          <article id="off-strategy" data-tint="yellow">
            <h3>Off-strategy</h3>
            <p>Maya checks every post against your strategy, yours included. A post that doesn’t fit a pillar, or makes a price, discount or claim that isn’t in your profile, is blocked until it fits. Maya says why and offers her version.</p>
          </article>
        </div>
      </section>
    </app-product-pages>
  `,
} )
export class HelpPageComponent {}

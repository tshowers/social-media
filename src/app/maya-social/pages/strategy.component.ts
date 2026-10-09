import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { NotificationService } from '../../services/notification.service';
import { MayaSocialApi, Product, RequiredField, Strategy, apiError } from '../api';
import { monthDay } from '../format';
import { IconComponent } from '../icon.component';
import { MayaSocialState } from '../state';
import { FirstStrategyBannerComponent, LoadErrorComponent, NotSetUpComponent } from '../states.component';
import { StrategyChannelsComponent } from '../strategy-channels.component';

const FIELD_LABELS: Record<RequiredField, string> = {
  companyName: 'Company name',
  companyGoal: 'Company goal',
  products: 'Products and services',
};

/**
 * Strategy (design 1g), and before one exists: 1h (profile complete, ready
 * to generate) or 1i (fields missing, filled in place). A generated
 * strategy waits here for approval before anything is scheduled; so does a
 * change Maya proposes after a profile edit (rule 8).
 */
@Component( {
  selector: 'ms-strategy',
  standalone: true,
  imports: [FormsModule, RouterLink, IconComponent, FirstStrategyBannerComponent, LoadErrorComponent, NotSetUpComponent, StrategyChannelsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .avatar88 { width: 88px; height: 88px; border-radius: 50%; object-fit: cover; object-position: left center; box-shadow: 0 0 0 6px var(--t-blue); }
    .steps { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }
    .steps li { display: flex; align-items: center; gap: 14px; min-height: 56px; padding: 0 22px; border-radius: 999px; background: var(--surface); font-size: 16px; font-weight: 700; }
    .steps li.is-next { background: transparent; color: var(--muted); }
    .steps small { font-size: 14px; font-weight: 500; color: var(--muted); }
    .step-ok { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; background: var(--t-green); color: var(--t-green-fg); }
    .step-spin { width: 22px; height: 22px; margin: 0 2px; border-radius: 50%; border: 3px solid var(--surface2); border-top-color: var(--blue); animation: ms-spin .9s linear infinite; }
    .step-todo { width: 22px; height: 22px; margin: 0 2px; border-radius: 50%; border: 2px solid var(--surface2); }
    .channels-section { margin-top: 48px; }
    .narrow { display: flex; flex-direction: column; gap: 24px; max-width: 880px; margin: 0 auto; padding: 56px 40px 72px; }
    .narrow h1 { font-size: 48px; font-weight: 700; letter-spacing: -0.03em; line-height: 1.05; }
    .narrow .lead { font-size: 18px; line-height: 1.6; color: var(--muted); }
    .req { display: flex; flex-direction: column; gap: 8px; }
    .req-row { display: grid; grid-template-columns: 26px 190px 1fr; gap: 14px; align-items: center; padding: 14px 20px; border-radius: 999px; background: var(--surface); }
    .req-row strong { font-size: 16px; }
    .req-row span:last-child { font-size: 15px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ok { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; background: var(--t-green); color: var(--t-green-fg); }
    .bad { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; background: var(--t-pink); color: var(--t-pink-fg); font-size: 13px; font-weight: 800; }
    .row-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 20px; }
    .error { display: grid; grid-template-columns: 28px 1fr; gap: 12px; padding: 24px 24px; border-radius: 28px; background: var(--t-pink); color: var(--t-pink-fg); }
    .error h2 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
    .error p { font-size: 15px; line-height: 1.5; }
    .field { display: flex; flex-direction: column; }
    .field .ms-field-label { align-items: center; }
    .product { display: grid; grid-template-columns: 1fr 1.6fr auto; gap: 10px; }
    .product + .product { margin-top: 8px; }
    .helper { font-size: 14px; color: var(--muted); }
    .building { display: flex; align-items: center; gap: 12px; font-size: 18px; color: var(--muted); }

    .head { display: grid; grid-template-columns: 1fr auto; gap: 24px; align-items: end; }
    .head .ms-h1 { margin: 8px 0 12px; }
    .head .ms-maya-line { max-width: 720px; }
    .head-actions { display: flex; gap: 10px; }
    .review { margin-bottom: 28px; }
    section { margin-top: 40px; }
    section > h2 { margin-bottom: 14px; font-size: 20px; font-weight: 700; }
    .pillars { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    .pillar { display: flex; flex-direction: column; gap: 6px; padding: 22px; border-radius: 28px; background: var(--tint); color: var(--tint-fg); }
    .pillar .pct { font-size: 36px; font-weight: 700; letter-spacing: -0.03em; }
    .pillar h3 { font-size: 18px; font-weight: 700; }
    .pillar p { font-size: 14px; line-height: 1.5; }
    .two { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
    .two section { margin-top: 0; }
    .lower { margin-top: 40px; }
    .channel { display: grid; grid-template-columns: 150px 1fr 90px; gap: 12px; align-items: center; padding: 14px 20px; border-radius: 999px; background: var(--surface); }
    .channel + .channel { margin-top: 8px; }
    .channel strong { font-size: 16px; }
    .channel .role { font-size: 14px; color: var(--muted); }
    .channel .role a { font-weight: 700; text-decoration: none; }
    .channel .per { font-size: 14px; font-weight: 700; text-align: right; }
    .rules { display: flex; flex-direction: column; gap: 14px; margin: 0; padding: 0; list-style: none; }
    .rules li { display: grid; grid-template-columns: 26px 1fr; gap: 12px; font-size: 15px; line-height: 1.55; }
    .rules .n { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; background: var(--surface); font-size: 12px; font-weight: 700; }
    .hours { display: inline-block; margin: 0 4px; padding: 1px 10px; border-radius: 999px; background: var(--surface); font-weight: 600; }

    @media (max-width: 900px) {
      .pillars { grid-template-columns: 1fr 1fr; }
      .two { grid-template-columns: 1fr; }
      .head { grid-template-columns: 1fr; }
    }
    @media (max-width: 760px) {
      .narrow { padding: 20px 16px 120px; }
      .narrow h1 { font-size: 32px; }
      .req-row { grid-template-columns: 26px 1fr; border-radius: 22px; }
      .req-row span:last-child { grid-column: 2; white-space: normal; }
      .product { grid-template-columns: 1fr; }
      .pillars { grid-template-columns: 1fr; }
      .channel { grid-template-columns: 1fr auto; border-radius: 22px; }
      .channel .role { grid-column: 1 / -1; grid-row: 2; }
      .submit { position: sticky; bottom: 76px; }
    }
  `],
  template: `
    @if (!state.overview()?.onboardedAt) {
      <ms-not-set-up />
    } @else if (buildFailed()) {
      <ms-load-error title="I couldn’t finish the strategy." body="Your profile is saved. Try again, and I’ll start over from it." [status]="buildFailed()!.status" (retry)="generate()" />
    } @else if (building()) {
      <!-- 2e -->
      <main class="narrow" aria-live="polite">
        <img class="avatar88" src="assets/maya-avatar.png" alt="" />
        <h1>Building your strategy…</h1>
        <p class="lead">About a minute. Stay on this page, and I’ll show it to you as soon as it’s ready.</p>
        <ol class="steps">
          <li><span class="step-ok"><ms-icon name="check" [size]="14" [stroke]="3" /></span>Read your profile <small>{{ profile()?.companyName }} · {{ productCount() }}</small></li>
          <li><span class="step-spin" aria-hidden="true"></span>Picking content pillars and how often to post on each channel</li>
          <li class="is-next"><span class="step-todo" aria-hidden="true"></span>Planning three weeks of posts, once you approve</li>
        </ol>
      </main>
    } @else {
    @if (shown(); as strategy) {
      <main class="ms-page">
        @if (pending() && !active()) {
          <ms-first-strategy-banner class="review" (regenerate)="generate()" />
        } @else if (pending()) {
          <div class="ms-notice review" data-tint="yellow" role="status">
            <span><strong>Your profile changed, so I’m suggesting this strategy.</strong> Nothing changes until you approve it.</span>
            <button type="button" class="ms-btn ms-btn--bg ms-btn--36" [disabled]="busy()" (click)="discard()">Keep my current strategy</button>
            <button type="button" class="ms-btn ms-btn--primary ms-btn--36" [disabled]="busy()" (click)="approve()">Approve changes</button>
          </div>
        }

        <div class="head">
          <div>
            <p class="ms-kicker">Social strategy · Built {{ builtOn(strategy) }} from your profile</p>
            <h1 class="ms-h1">{{ strategy.goal }}</h1>
            <p class="ms-maya-line"><img class="ms-avatar" src="assets/maya-avatar.png" alt="" />That goal comes from your profile. I re-check this strategy whenever your profile changes, and I won’t schedule anything that doesn’t fit it.</p>
          </div>
          @if (active()) {
            <div class="head-actions">
              <a class="ms-btn ms-btn--44" routerLink="/profile">View profile</a>
              <button type="button" class="ms-btn ms-btn--ink ms-btn--44" [disabled]="busy()" (click)="generate()">Regenerate</button>
            </div>
          }
        </div>

        <section aria-labelledby="pillars-title">
          <h2 id="pillars-title">Content pillars</h2>
          <div class="pillars">
            @for (pillar of strategy.pillars; track pillar.key) {
              <div class="pillar" [attr.data-tint]="pillar.tint">
                <span class="pct">{{ pillar.share }}%</span>
                <h3>{{ pillar.name }}</h3>
                <p>{{ pillar.description }}@if (pillar.maxOneIn > 1) { Never more than 1 in {{ pillar.maxOneIn }} posts.}</p>
              </div>
            }
          </div>
        </section>

        <section class="channels-section" aria-labelledby="channels-title">
          <ms-strategy-channels [strategy]="strategy" />
        </section>

        <div class="lower">
          <section aria-labelledby="rules-title">
            <h2 id="rules-title">Rules Maya follows</h2>
            <ol class="rules">
              <li><span class="n">1</span><span>At least one post goes out every day.</span></li>
              <li><span class="n">2</span><span>Every post fits a pillar. Your posts too: I block anything that doesn’t, and suggest a version that does.</span></li>
              <li><span class="n">3</span><span>Posts auto-approve <span class="hours">{{ hours() }} hours</span> after I draft them, unless you hold them.</span></li>
              <li><span class="n">4</span><span>A held post keeps its slot. Unpinned posts behind it move back a day.</span></li>
              <li><span class="n">5</span><span>Pinned posts never move. If one isn’t approved by its date, it expires.</span></li>
              <li><span class="n">6</span><span>No prices, discounts or claims that aren’t in your profile.</span></li>
            </ol>
          </section>
        </div>
      </main>
    } @else if (missing().length === 0) {
      <!-- 1h -->
      <main class="narrow">
        <img class="ms-avatar ms-avatar--64" src="assets/maya-avatar.png" alt="Maya" />
        <h1>I don’t have a social strategy for you yet.</h1>
        <p class="lead">I’ll build one from your profile: pillars, channels, how often to post and the rules I follow. Nothing goes on the calendar until you’ve seen it.</p>
        <div class="req">
          <div class="req-row"><span class="ok"><ms-icon name="check" [size]="14" [stroke]="3" /></span><strong>Company name</strong><span>{{ profile()?.companyName }}</span></div>
          <div class="req-row"><span class="ok"><ms-icon name="check" [size]="14" [stroke]="3" /></span><strong>Company goal</strong><span>{{ profile()?.companyGoal }}</span></div>
          <div class="req-row"><span class="ok"><ms-icon name="check" [size]="14" [stroke]="3" /></span><strong>Products and services</strong><span>{{ productNames() }}</span></div>
        </div>
        <div class="row-actions">
          <button type="button" class="ms-btn ms-btn--primary ms-btn--56" (click)="generate()"><ms-icon name="sparkle" [size]="18" />Generate strategy from my profile</button>
          <a class="ms-link" routerLink="/profile">Review profile first</a>
        </div>
      </main>
    } @else {
      <!-- 1i -->
      <main class="narrow">
        <div class="error" role="alert">
          <ms-icon name="alert" [size]="26" />
          <div>
            <h2>I can’t build a strategy yet.</h2>
            <p>Your profile is missing {{ missingCount() }} of the 3 things I need. Fill {{ missingCount() === 1 ? 'it' : 'them' }} in here and {{ missingCount() === 1 ? 'it’ll' : 'they’ll' }} save to your profile.</p>
          </div>
        </div>

        <div class="field">
          <label class="ms-field-label" for="company-name">
            @if (nameOk()) { <span class="ok"><ms-icon name="check" [size]="12" [stroke]="3" /></span> } @else { <span class="bad">!</span> }
            Company name
          </label>
          <input id="company-name" class="ms-input" [class.ms-input--missing]="!nameOk()" [ngModel]="companyName()" (ngModelChange)="companyName.set($event)" name="companyName" autocomplete="organization" />
        </div>

        <div class="field">
          <label class="ms-field-label" for="company-goal">
            @if (goalOk()) { <span class="ok"><ms-icon name="check" [size]="12" [stroke]="3" /></span> } @else { <span class="bad">!</span> }
            Company goal <small class="ms-hint">What should social media help you do?</small>
          </label>
          <input id="company-goal" class="ms-input" [class.ms-input--missing]="!goalOk()" [ngModel]="companyGoal()" (ngModelChange)="companyGoal.set($event)" name="companyGoal" placeholder="e.g. Book 20 discovery calls a month" />
        </div>

        <div class="field">
          <span class="ms-field-label">
            @if (productsOk()) { <span class="ok"><ms-icon name="check" [size]="12" [stroke]="3" /></span> } @else { <span class="bad">!</span> }
            Products and services <small class="ms-hint">At least one</small>
          </span>
          @for (product of products(); track $index; let i = $index; let last = $last) {
            <div class="product">
              <input class="ms-input" [class.ms-input--missing]="!productsOk()" [ngModel]="product.name" (ngModelChange)="setProduct(i, 'name', $event)" [name]="'product-name-' + i" placeholder="Name" [attr.aria-label]="'Product ' + (i + 1) + ' name'" />
              <input class="ms-input" [class.ms-input--missing]="!productsOk()" [ngModel]="product.description" (ngModelChange)="setProduct(i, 'description', $event)" [name]="'product-desc-' + i" placeholder="One line on what it does" [attr.aria-label]="'Product ' + (i + 1) + ' description'" />
              @if (last) { <button type="button" class="ms-btn ms-btn--44" (click)="addProduct()">+ Add</button> } @else { <span></span> }
            </div>
          }
        </div>

        <div class="row-actions submit">
          <button type="button" class="ms-btn ms-btn--primary ms-btn--56" [disabled]="!formOk() || busy()" (click)="saveAndGenerate()">
            @if (busy()) { <span class="ms-spinner" aria-hidden="true"></span> }
            Save and generate strategy
          </button>
          @if (!formOk()) { <span class="helper">{{ helper() }}</span> }
        </div>
      </main>
    }
    }
  `,
} )
export class StrategyComponent implements OnInit, OnDestroy {
  private readonly api = inject( MayaSocialApi );
  readonly state = inject( MayaSocialState );
  private readonly router = inject( Router );
  private readonly notifications = inject( NotificationService );

  readonly building = signal( false );
  readonly buildFailed = signal<{ status: number | null } | null>( null );
  readonly productCount = computed( () => {
    const count = this.profile()?.products.length ?? 0;
    return `${ count } ${ count === 1 ? 'product' : 'products' }`;
  } );
  private readonly route = inject( ActivatedRoute );
  readonly busy = signal( false );

  readonly active = this.state.strategy;
  readonly pending = computed( () => this.state.overview()?.pendingStrategy ?? null );
  readonly shown = computed( () => this.pending() ?? this.active() );
  readonly profile = computed( () => this.state.overview()?.profile ?? null );
  readonly missing = computed( () => this.state.overview()?.missing ?? [] );
  readonly hours = computed( () => this.state.overview()?.autoApproveHours ?? this.shown()?.autoApproveHours ?? 6 );
  readonly productNames = computed( () => ( this.profile()?.products ?? [] ).map( ( product ) => product.name ).join( ', ' ) );

  // 1i form, seeded from the profile.
  readonly companyName = signal( this.profile()?.companyName ?? '' );
  readonly companyGoal = signal( this.profile()?.companyGoal ?? '' );
  readonly products = signal<Product[]>( this.seedProducts() );

  readonly nameOk = computed( () => !!this.companyName().trim() );
  readonly goalOk = computed( () => !!this.companyGoal().trim() );
  readonly productsOk = computed( () => this.products().some( ( product ) => product.name.trim() ) );
  readonly formOk = computed( () => this.nameOk() && this.goalOk() && this.productsOk() );
  readonly missingCount = computed( () => this.missing().length );

  private seedProducts (): Product[] {
    const existing = this.state.overview()?.profile.products ?? [];
    return existing.length ? existing.map( ( product ) => ( { ...product } ) ) : [{ name: '', description: '' }];
  }

  helper (): string {
    const left: string[] = [];
    if ( !this.nameOk() ) left.push( FIELD_LABELS.companyName.toLowerCase() );
    if ( !this.goalOk() ) left.push( 'goal' );
    if ( !this.productsOk() ) left.push( 'a product or service' );
    if ( left.length === 1 ) return `Available once you add your ${ left[0] }`;
    return `Available once ${ left.length === 2 ? 'both' : 'all' } fields are filled`;
  }

  builtOn ( strategy: Strategy ): string {
    return monthDay( ( strategy.builtAt || new Date().toISOString() ).slice( 0, 10 ) ).toUpperCase();
  }

  setProduct ( index: number, field: 'name' | 'description', value: string ): void {
    this.products.update( ( list ) => list.map( ( product, i ) => ( i === index ? { ...product, [field]: value } : product ) ) );
  }

  addProduct (): void {
    this.products.update( ( list ) => [...list, { name: '', description: '' }] );
  }

  saveAndGenerate (): void {
    if ( !this.formOk() ) return;
    this.busy.set( true );
    const products = this.products().filter( ( product ) => product.name.trim() );
    this.api.saveProfile( { companyName: this.companyName().trim(), companyGoal: this.companyGoal().trim(), products } ).subscribe( {
      next: ( overview ) => {
        this.state.set( { ...overview, entitled: true } );
        this.busy.set( false );
        this.generate();
      },
      error: ( error ) => {
        this.busy.set( false );
        this.notifications.show( 'Couldn’t save your profile', apiError( error ).message || 'Try again.', 'error' );
      },
    } );
  }

  ngOnInit (): void {
    // "Regenerate" on Today's 2f banner lands here.
    if ( this.route.snapshot.queryParamMap.get( 'regenerate' ) ) {
      void this.router.navigate( [], { queryParams: {}, replaceUrl: true } );
      this.generate();
    }
  }

  ngOnDestroy (): void {
    this.state.headerOverride.set( null );
  }

  generate (): void {
    this.building.set( true );
    this.buildFailed.set( null );
    this.state.headerOverride.set( 'welcome' );
    const done = () => {
      this.building.set( false );
      this.state.headerOverride.set( null );
    };
    this.api.generateStrategy().subscribe( {
      next: () => {
        void this.state.refresh().then( done );
      },
      error: ( response ) => {
        done();
        const error = apiError( response );
        if ( error.error === 'profile_incomplete' ) {
          void this.state.refresh();
          return;
        }
        this.buildFailed.set( { status: ( response as { status?: number } )?.status || null } );
      },
    } );
  }

  approve (): void {
    this.busy.set( true );
    const first = !this.active();
    this.api.approveStrategy().subscribe( {
      next: ( overview ) => {
        this.state.set( { ...overview, entitled: true } );
        this.busy.set( false );
        if ( first ) void this.router.navigate( ['/today'] );
        else this.notifications.show( 'Strategy updated', 'Maya will plan with the new strategy from here on.', 'success' );
      },
      error: ( error ) => {
        this.busy.set( false );
        this.notifications.show( 'Couldn’t approve', apiError( error ).message || 'Try again.', 'error' );
      },
    } );
  }

  discard (): void {
    this.busy.set( true );
    this.api.discardPendingStrategy().subscribe( {
      next: ( overview ) => {
        this.state.set( { ...overview, entitled: true } );
        this.busy.set( false );
      },
      error: () => this.busy.set( false ),
    } );
  }
}

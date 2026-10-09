import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter, map } from 'rxjs/operators';

import { currentTheme, toggleTheme, ThemeMode } from '@taliferro/ui/platform/theme';
import { environment } from '../../environments/environment';
import { SocialAuthService } from '../services/social-auth.service';
import { PlatformMenuComponent } from '../shared/platform-menu/platform-menu.component';
import { IconComponent } from './icon.component';
import { MayaSocialState } from './state';

/** Which header a route shows (route data `header`). */
export type HeaderMode = 'doorway' | 'welcome' | 'app' | 'none';

export const MAYA_PRICING_URL = 'https://maya.taliferro.tech/pricing';

const TABS = [
  { label: 'Today', route: '/today' },
  { label: 'Calendar', route: '/calendar' },
  { label: 'Strategy', route: '/strategy' },
  { label: 'Profile', route: '/profile' },
];

/**
 * The Maya Social header on every desktop screen (design 1a: avatar + "Maya
 * Social", tabs in the middle, "+ New post" on the right), plus the theme
 * pill and the universal Menu (PRODUCT-STANDARD: one Menu per screen). On a
 * phone it becomes the 1l header (avatar + page title + round "+") with a
 * bottom tab bar.
 */
@Component( {
  selector: 'ms-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, PlatformMenuComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: block; }
    /* 2a: brand and actions take equal space so the tabs sit dead center. */
    .ah { display: grid; grid-template-columns: 1fr auto 1fr; gap: 16px; padding: 20px 40px; }
    .ah-brand { justify-self: start; }
    .ah-actions { justify-self: end; gap: 8px; margin-left: 0; }
    .ms-center { display: flex; justify-content: center; }
    .ms-brand-name { font-size: 22px; letter-spacing: -0.02em; }
    .ms-brand-name small { font-weight: 700; margin-left: 4px; }
    .ms-tabs { display: flex; gap: 4px; }
    .ms-tab {
      display: inline-flex; align-items: center; height: 34px; padding: 0 14px; border-radius: 999px;
      font-size: 14px; font-weight: 600; color: var(--text); text-decoration: none;
    }
    .ms-tab:hover, .ms-tab.is-active { background: var(--surface); }
    .ms-signed-in { font-size: 14px; font-weight: 600; color: var(--muted); white-space: nowrap; }
    .ms-new:disabled { opacity: 1; background: var(--surface); color: var(--muted); }
    .ah-actions .ah-theme { height: 42px; padding: 0 16px; font-size: 14px; font-weight: 700; }
    .ah-actions .ah-theme ms-icon { margin-right: 2px; }
    .ms-phone-title { display: none; }
    .ms-round {
      display: none; width: 42px; height: 42px; min-height: 0; padding: 0; border: 0; border-radius: 50%;
      align-items: center; justify-content: center; background: var(--blue); color: #fff; box-shadow: none;
    }
    .ms-round:hover { transform: none; background: var(--blue-ink); }
    .ms-round:disabled { background: var(--surface); color: var(--muted); }
    .ms-bottom { display: none; }

    /* Tablet (808): New post and the theme pill become circles; tabs stay. */
    @media (max-width: 1000px) {
      .ah { padding: 20px 32px; gap: 12px; }
      .ms-brand-name { font-size: 20px; }
      .ms-tab { padding: 0 12px; }
      .ms-new-wide { display: none; }
      .ms-round { display: inline-flex; }
      .ah-actions .ah-theme { width: 42px; padding: 0; justify-content: center; }
      .ah-actions .ah-theme span { display: none; }
    }

    /* Phone (390): avatar + tab title; tabs move to the bottom bar. */
    @media (max-width: 760px) {
      .ah { grid-template-columns: 1fr auto; padding: 14px 16px 10px; }
      .ms-center { display: none; }
      .ah-brand.is-app .ah-name { display: none; }
      .ms-avatar--36 { width: 32px; height: 32px; }
      .ms-phone-title { display: inline; font-size: 18px; font-weight: 700; letter-spacing: -0.02em; }
      .ms-round, .ah-actions .ah-theme { width: 40px; height: 40px; }
      .ms-bottom {
        display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px;
        position: fixed; left: 0; right: 0; bottom: 0; z-index: 20;
        padding: 8px 12px calc(8px + env(safe-area-inset-bottom));
        background: var(--bg); box-shadow: 0 -1px 0 var(--surface2);
      }
      .ms-bottom a {
        display: flex; align-items: center; justify-content: center; height: 44px; border-radius: 999px;
        font-size: 15px; font-weight: 700; color: var(--muted); text-decoration: none;
      }
      .ms-bottom a.is-active { background: var(--surface); color: var(--text); }
    }
  `],
  template: `
    @if (mode() !== 'none') {
      <header class="ah">
        <a class="ah-brand" [class.is-app]="mode() === 'app'" [routerLink]="mode() === 'app' ? '/today' : '/'" aria-label="Maya Social home">
          <img class="ms-avatar ms-avatar--36" src="assets/maya-avatar.png" alt="" />
          <span class="ah-name ms-brand-name">Maya <small>Social</small></span>
          @if (mode() === 'app') { <span class="ms-phone-title">{{ pageTitle() }}</span> }
        </a>

        <div class="ms-center">
          @if (mode() === 'app') {
            <nav class="ms-tabs" aria-label="Maya Social">
              @for (tab of tabs; track tab.route) {
                <a class="ms-tab" [routerLink]="tab.route" routerLinkActive="is-active" ariaCurrentWhenActive="page">{{ tab.label }}</a>
              }
            </nav>
          } @else if (mode() === 'welcome' && email()) {
            <span class="ms-signed-in">Signed in as {{ email() }}</span>
          }
        </div>

        <div class="ah-actions">
          @if (mode() === 'doorway') {
            @if (!signedIn()) {
              <button type="button" class="ms-btn ms-btn--ghost ah-pill--wide" (click)="signIn()">Sign in</button>
            }
          } @else if (mode() === 'app') {
            @if (onNewPost()) {
              <a class="ms-btn" routerLink="/today">Cancel</a>
            } @else {
              <button type="button" class="ms-btn ms-btn--primary ms-new ms-new-wide" [disabled]="!canPost()" (click)="newPost()"><ms-icon name="plus" [stroke]="2.75" />New post</button>
              <button type="button" class="ms-round" [disabled]="!canPost()" (click)="newPost()" aria-label="New post"><ms-icon name="plus" [size]="18" [stroke]="2.75" /></button>
            }
          }
          <button type="button" class="ms-btn ah-pill ah-theme" (click)="flipTheme()" [attr.aria-label]="theme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'">
            <ms-icon [name]="theme() === 'dark' ? 'sun' : 'moon'" [stroke]="2.75" /><span>{{ theme() === 'dark' ? 'Light' : 'Dark' }}</span>
          </button>
          <app-platform-menu [isAdmin]="isAdmin()" [isLoggedIn]="signedIn()" [userName]="userName()" [userEmail]="email()" (signOut)="signOut()" />
        </div>
      </header>

      @if (mode() === 'app') {
        <nav class="ms-bottom" aria-label="Maya Social">
          @for (tab of tabs; track tab.route) {
            <a [routerLink]="tab.route" routerLinkActive="is-active" ariaCurrentWhenActive="page">{{ tab.label }}</a>
          }
        </nav>
      }
    }
  `,
} )
export class HeaderComponent {
  private readonly router = inject( Router );
  private readonly route = inject( ActivatedRoute );
  private readonly auth = inject( SocialAuthService );
  private readonly state = inject( MayaSocialState );

  readonly tabs = TABS;
  readonly pricingUrl = MAYA_PRICING_URL;
  readonly theme = signal<ThemeMode>( currentTheme() );

  private readonly routeData = toSignal(
    this.router.events.pipe(
      filter( ( event ) => event instanceof NavigationEnd ),
      map( () => {
        let child = this.route.firstChild;
        while ( child?.firstChild ) child = child.firstChild;
        return { data: child?.snapshot.data ?? {}, url: this.router.url };
      } ),
    ),
    { initialValue: { data: {} as Record<string, unknown>, url: '' } },
  );

  /** Setup screens inside app routes (building a strategy) borrow the setup header. */
  readonly mode = computed<HeaderMode>( () => this.state.headerOverride() || ( this.routeData().data['header'] as HeaderMode ) || 'none' );
  readonly pageTitle = computed( () => ( this.routeData().data['pageTitle'] as string ) || '' );
  readonly onNewPost = computed( () => this.routeData().url.startsWith( '/new' ) );
  readonly signedIn = this.state.signedIn;
  readonly email = this.state.email;
  /** 2a: New post needs an approved strategy and a connected channel. */
  readonly canPost = computed( () => !!this.state.strategy() && !this.state.publishingPaused() );
  readonly userName = signal( '' );
  readonly isAdmin = signal( false );

  constructor () {
    this.auth.getUser().subscribe( ( user ) => {
      this.userName.set( user?.displayName || '' );
      this.isAdmin.set( user?.uid === environment.taliferroTenantId );
      this.state.signedIn.set( !!user );
      this.state.email.set( user?.email || '' );
    } );
  }

  signIn (): void {
    this.auth.signIn( '/' );
  }

  newPost (): void {
    void this.router.navigate( ['/new'] );
  }

  flipTheme (): void {
    this.theme.set( toggleTheme() );
  }

  async signOut (): Promise<void> {
    await this.auth.signOut();
    this.state.reset();
    void this.router.navigate( ['/'] );
  }
}

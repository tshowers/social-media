import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

import { NotificationService } from '../../services/notification.service';
import { AutoApproveHours, MayaSocialApi, Product, apiError } from '../api';
import { IconComponent } from '../icon.component';
import { MayaSocialState } from '../state';

const TONES = ['Plain', 'Confident', 'Playful'];
const CHANNEL_ORDER = ['linkedin', 'threads', 'facebook', 'instagram', 'google_business_profile'];

/**
 * Profile (design 1j): the owner's Taliferro profile, edited in place. Saving
 * makes Maya re-check the strategy; any change waits for approval (rule 8).
 * Also here: the auto-approve hours (1p "You can change this later in
 * Profile") and connecting channels, which the design left out but posts
 * can't go out without.
 */
@Component( {
  selector: 'ms-profile',
  standalone: true,
  imports: [FormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .grid { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 48px; align-items: start; }
    .form { display: flex; flex-direction: column; gap: 28px; }
    .intro { display: flex; flex-direction: column; gap: 8px; }
    .intro p { font-size: 16px; color: var(--muted); }
    .field { display: flex; flex-direction: column; }
    .product { display: grid; grid-template-columns: 170px minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 8px 8px 8px 20px; border-radius: 999px; background: var(--surface); }
    .product + .product { margin-top: 8px; }
    .product strong { font-size: 16px; }
    .product span { font-size: 14px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .product-edit { display: grid; grid-template-columns: 1fr 1.6fr auto auto; gap: 8px; }
    .product-edit + .product, .product + .product-edit, .product-edit + .product-edit { margin-top: 8px; }
    .add { align-self: flex-start; margin-top: 10px; }
    .two { display: grid; grid-template-columns: 1fr 1fr; gap: 20px 20px; }
    .tones { display: flex; flex-wrap: wrap; gap: 8px; }
    .tones .ms-btn[aria-pressed="true"] { background: var(--blue); color: #fff; }
    .side { position: sticky; top: 24px; display: flex; flex-direction: column; gap: 14px; }
    .side .ms-card { display: flex; flex-direction: column; gap: 10px; }
    .side h2 { display: flex; align-items: center; gap: 10px; font-size: 15px; font-weight: 700; }
    .side p { font-size: 14px; line-height: 1.55; color: var(--muted); }
    hr { width: 100%; margin: 12px 0 0; border: 0; border-top: 1px solid var(--surface2); }
    section h2 { margin-bottom: 6px; font-size: 22px; font-weight: 700; letter-spacing: -0.02em; }
    section > p { margin-bottom: 14px; font-size: 15px; color: var(--muted); }
    .channel { display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: center; min-height: 58px; padding: 8px 8px 8px 20px; border-radius: 999px; background: var(--surface); }
    .channel + .channel { margin-top: 8px; }
    .channel strong { font-size: 16px; }
    .channel small { margin-left: 8px; font-size: 13px; color: var(--muted); }
    .connected { display: inline-flex; align-items: center; gap: 6px; padding: 0 14px; font-size: 14px; font-weight: 700; color: var(--t-green-fg); }
    @media (max-width: 900px) {
      .grid { grid-template-columns: minmax(0, 1fr); }
      .side { position: static; }
    }
    @media (max-width: 760px) {
      .two { grid-template-columns: 1fr; }
      .product { grid-template-columns: 1fr auto; border-radius: 22px; }
      .product span { grid-column: 1; grid-row: 2; white-space: normal; }
      .product .ms-btn { grid-row: 1 / span 2; grid-column: 2; }
      .product-edit { grid-template-columns: 1fr; }
      .channel { border-radius: 22px; }
    }
  `],
  template: `
    <main class="ms-page">
      <div class="grid">
        <div class="form">
          <div class="intro">
            <h1 class="ms-h1">Profile</h1>
            <p>This is your Taliferro profile. Changes here update it everywhere.</p>
          </div>

          <div class="field">
            <label class="ms-field-label" for="p-name">Company name <small>Required</small></label>
            <input id="p-name" class="ms-input" [ngModel]="companyName()" (ngModelChange)="companyName.set($event); dirty.set(true)" name="companyName" autocomplete="organization" />
          </div>

          <div class="field">
            <label class="ms-field-label" for="p-goal">Company goal <small>Required</small></label>
            <textarea id="p-goal" class="ms-input" rows="2" [ngModel]="companyGoal()" (ngModelChange)="companyGoal.set($event); dirty.set(true)" name="companyGoal" placeholder="e.g. Book 20 discovery calls a month"></textarea>
          </div>

          <div class="field">
            <span class="ms-field-label">Products and services <small>At least one</small></span>
            @for (product of products(); track $index; let i = $index) {
              @if (editingProduct() === i) {
                <div class="product-edit">
                  <input class="ms-input" [ngModel]="product.name" (ngModelChange)="setProduct(i, 'name', $event)" [name]="'pn' + i" placeholder="Name" aria-label="Product name" />
                  <input class="ms-input" [ngModel]="product.description" (ngModelChange)="setProduct(i, 'description', $event)" [name]="'pd' + i" placeholder="One line on what it does" aria-label="What it does" />
                  <button type="button" class="ms-btn ms-btn--44" (click)="editingProduct.set(null)">Done</button>
                  <button type="button" class="ms-btn ms-btn--44 ms-btn--ghost" (click)="removeProduct(i)" aria-label="Remove product"><ms-icon name="x" /></button>
                </div>
              } @else {
                <div class="product">
                  <strong>{{ product.name }}</strong>
                  <span>{{ product.description }}</span>
                  <button type="button" class="ms-btn ms-btn--bg ms-btn--36" (click)="editingProduct.set(i)" [attr.aria-label]="'Edit ' + product.name">Edit</button>
                </div>
              }
            }
            <button type="button" class="ms-btn ms-btn--outline add" (click)="addProduct()">+ Add product or service</button>
          </div>

          <div class="two">
            <div class="field">
              <label class="ms-field-label" for="p-audience">Audience</label>
              <input id="p-audience" class="ms-input" [ngModel]="audience()" (ngModelChange)="audience.set($event); dirty.set(true)" name="audience" />
            </div>
            <div class="field">
              <label class="ms-field-label" for="p-location">Location</label>
              <input id="p-location" class="ms-input" [ngModel]="location()" (ngModelChange)="location.set($event); dirty.set(true)" name="location" autocomplete="address-level2" />
            </div>
            <div class="field">
              <label class="ms-field-label" for="p-website">Website</label>
              <input id="p-website" class="ms-input" [ngModel]="website()" (ngModelChange)="website.set($event); dirty.set(true)" name="website" autocomplete="url" inputmode="url" />
            </div>
            <div class="field">
              <span class="ms-field-label" id="tone-label">Tone</span>
              <div class="tones" role="group" aria-labelledby="tone-label">
                @for (tone of toneOptions; track tone) {
                  <button type="button" class="ms-btn ms-btn--44" [attr.aria-pressed]="tones().includes(tone)" (click)="toggleTone(tone)">{{ tone }}</button>
                }
              </div>
            </div>
          </div>

          <hr />

          <section id="channels" aria-labelledby="channels-title">
            <h2 id="channels-title">Channels</h2>
            <p>Maya posts only to channels you connect.</p>
            @for (channel of channels(); track channel.key) {
              <div class="channel">
                <span><strong>{{ channel.name }}</strong>@if (channel.inStrategy) { <small>In your strategy</small> }</span>
                @if (channel.connected) {
                  <span class="connected"><ms-icon name="check" [size]="14" [stroke]="3" />Connected</span>
                } @else {
                  <button type="button" class="ms-btn ms-btn--bg" [disabled]="connecting() === channel.key" (click)="connect(channel.key)">
                    @if (connecting() === channel.key) { <span class="ms-spinner" aria-hidden="true"></span> } Connect
                  </button>
                }
              </div>
            }
          </section>

          <section aria-labelledby="approve-title">
            <h2 id="approve-title">Auto-approve</h2>
            <p>Posts approve themselves this long after Maya drafts them, unless you hold them.</p>
            <div class="ms-seg ms-seg--blue" role="radiogroup" aria-labelledby="approve-title" style="background: var(--surface)">
              @for (option of hourOptions; track option) {
                <button type="button" role="radio" [attr.aria-checked]="hours() === option" [class.is-on]="hours() === option" (click)="setHours(option)">{{ option }} hours</button>
              }
            </div>
          </section>
        </div>

        <aside class="side">
          <div class="ms-card">
            <h2><img class="ms-avatar" src="assets/maya-avatar.png" alt="" />When you save</h2>
            <p>I’ll check whether the strategy still fits. If it doesn’t, I’ll suggest changes on Strategy. Nothing changes until you approve.</p>
          </div>
          <button type="button" class="ms-btn ms-btn--primary ms-btn--52 ms-btn--block" [disabled]="!valid() || saving()" (click)="save()">
            @if (saving()) { <span class="ms-spinner" aria-hidden="true"></span> Saving… } @else { Save profile }
          </button>
          @if (!valid()) { <p class="ms-muted" style="font-size: 14px">Company name, goal and at least one product are required.</p> }
        </aside>
      </div>
    </main>
  `,
} )
export class ProfileComponent implements OnInit {
  private readonly api = inject( MayaSocialApi );
  private readonly state = inject( MayaSocialState );
  private readonly route = inject( ActivatedRoute );
  private readonly notifications = inject( NotificationService );

  readonly toneOptions = TONES;
  readonly hourOptions: AutoApproveHours[] = [2, 4, 6];

  private readonly profile = this.state.overview()?.profile;
  readonly companyName = signal( this.profile?.companyName ?? '' );
  readonly companyGoal = signal( this.profile?.companyGoal ?? '' );
  readonly products = signal<Product[]>( ( this.profile?.products ?? [] ).map( ( product ) => ( { ...product } ) ) );
  readonly audience = signal( this.profile?.audience ?? '' );
  readonly location = signal( this.profile?.location ?? '' );
  readonly website = signal( this.profile?.website ?? '' );
  readonly tones = signal<string[]>( this.profile?.tones ?? [] );
  readonly editingProduct = signal<number | null>( null );
  readonly dirty = signal( false );
  readonly saving = signal( false );
  readonly connecting = signal<string | null>( null );
  readonly hours = computed( () => this.state.overview()?.autoApproveHours ?? 6 );

  readonly valid = computed( () => !!this.companyName().trim() && !!this.companyGoal().trim() && this.products().some( ( product ) => product.name.trim() ) );

  readonly channels = computed( () => {
    const overview = this.state.overview();
    const names = overview?.channels ?? {};
    const inStrategy = new Set( ( overview?.strategy?.channels ?? [] ).map( ( channel ) => channel.key ) );
    return CHANNEL_ORDER.filter( ( key ) => names[key] ).map( ( key ) => ( {
      key,
      name: names[key],
      inStrategy: inStrategy.has( key ),
      connected: ( overview?.connectedChannels ?? [] ).includes( key ),
    } ) );
  } );

  ngOnInit (): void {
    // Back from a provider's sign-in (the social accounts flow).
    const params = this.route.snapshot.queryParamMap;
    const status = params.get( 'authStatus' );
    const provider = params.get( 'authProvider' ) || '';
    if ( status === 'success' ) {
      void this.state.refresh();
      this.notifications.show( 'Connected', `${ this.state.channelNames()[provider] || 'Your account' } is connected.`, 'success' );
    } else if ( status === 'error' ) {
      this.notifications.show( 'Couldn’t connect', 'The connection didn’t finish. Try again.', 'error' );
    }
  }

  setProduct ( index: number, field: 'name' | 'description', value: string ): void {
    this.products.update( ( list ) => list.map( ( product, i ) => ( i === index ? { ...product, [field]: value } : product ) ) );
    this.dirty.set( true );
  }

  addProduct (): void {
    this.products.update( ( list ) => [...list, { name: '', description: '' }] );
    this.editingProduct.set( this.products().length - 1 );
  }

  removeProduct ( index: number ): void {
    this.products.update( ( list ) => list.filter( ( _, i ) => i !== index ) );
    this.editingProduct.set( null );
    this.dirty.set( true );
  }

  toggleTone ( tone: string ): void {
    this.tones.update( ( list ) => ( list.includes( tone ) ? list.filter( ( item ) => item !== tone ) : [...list, tone] ) );
    this.dirty.set( true );
  }

  save (): void {
    this.saving.set( true );
    this.editingProduct.set( null );
    this.api.saveProfile( {
      companyName: this.companyName().trim(),
      companyGoal: this.companyGoal().trim(),
      products: this.products().filter( ( product ) => product.name.trim() ),
      audience: this.audience().trim(),
      location: this.location().trim(),
      website: this.website().trim(),
      tones: this.tones(),
    } ).subscribe( {
      next: ( overview ) => {
        this.state.set( { ...overview, entitled: true } );
        this.saving.set( false );
        this.dirty.set( false );
        this.notifications.show(
          'Profile saved',
          overview.pendingStrategy && overview.strategy ? 'Maya suggested strategy changes. Review them on Strategy.' : 'Your strategy still fits.',
          'success',
        );
      },
      error: ( error ) => {
        this.saving.set( false );
        this.notifications.show( 'Couldn’t save', apiError( error ).message || 'Try again.', 'error' );
      },
    } );
  }

  setHours ( hours: AutoApproveHours ): void {
    if ( hours === this.hours() ) return;
    this.api.setAutoApproveHours( hours ).subscribe( {
      next: ( overview ) => this.state.set( { ...overview, entitled: true } ),
      error: ( error ) => this.notifications.show( 'Couldn’t change it', apiError( error ).message || 'Try again.', 'error' ),
    } );
  }

  connect ( channel: string ): void {
    this.connecting.set( channel );
    this.api.connectChannel( channel, `${ window.location.origin }/profile` ).subscribe( {
      next: ( url ) => {
        if ( url ) window.location.href = url;
        else {
          this.connecting.set( null );
          this.notifications.show( 'Couldn’t connect', 'That channel isn’t available right now.', 'error' );
        }
      },
      error: ( error ) => {
        this.connecting.set( null );
        this.notifications.show( 'Couldn’t connect', apiError( error ).message || 'Try again.', 'error' );
      },
    } );
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { NotificationService } from '../../services/notification.service';
import { AutoApproveHours, MayaSocialApi, Product } from '../api';
import { IconComponent } from '../icon.component';
import { MayaSocialState } from '../state';

const TONES = ['Plain', 'Confident', 'Playful'];

/**
 * Profile (design 1j): the owner's Taliferro profile, edited in place. Saving
 * makes Maya re-check the strategy; any change waits for approval (rule 8).
 * Below it, Social settings (gaps 2m): auto-approve hours and notes, which
 * belong to Maya Social only. Channels are on Strategy (2b).
 */
@Component( {
  selector: 'ms-profile',
  standalone: true,
  imports: [FormsModule, RouterLink, IconComponent],
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
    .settings { display: flex; flex-direction: column; gap: 16px; margin-top: 16px; }
    .settings > h2 { font-size: 28px; font-weight: 700; letter-spacing: -0.02em; }
    .settings-lead { font-size: 15px; color: var(--muted); }
    .block { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; padding: 22px 24px; }
    .block h3 { font-size: 16px; font-weight: 700; }
    .hint { font-size: 14px; color: var(--muted); }
    .toggle-row { display: grid; grid-template-columns: 18px 1fr auto; gap: 12px; align-items: center; width: 100%; cursor: pointer; }
    .toggle-row strong { display: block; font-size: 15px; }
    .toggle-row small { font-size: 13px; color: var(--muted); }
    .switch { appearance: none; position: relative; width: 52px; height: 30px; min-height: 0; margin: 0; padding: 0; border: 0; border-radius: 999px; background: var(--surface2); cursor: pointer; transition: background .15s; }
    .switch::after { content: ""; position: absolute; top: 3px; left: 3px; width: 24px; height: 24px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.25); transition: transform .15s; }
    .switch:checked { background: var(--blue); }
    .switch:checked::after { transform: translateX(22px); }
    .switch:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }
    .channels-link { display: inline-flex; align-items: center; gap: 4px; }
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

          <section class="settings" aria-labelledby="settings-title">
            <h2 id="settings-title">Social settings</h2>
            <p class="settings-lead">Only used in Maya Social. Not part of your Taliferro profile, and saving these doesn’t re-check the strategy.</p>

            <div class="ms-card block">
              <h3 id="approve-title">Auto-approve after</h3>
              <div class="ms-seg ms-seg--blue" role="radiogroup" aria-labelledby="approve-title">
                @for (option of hourOptions; track option) {
                  <button type="button" role="radio" [attr.aria-checked]="hours() === option" [class.is-on]="hours() === option" (click)="hours.set(option)">{{ option }} hours</button>
                }
              </div>
              <p class="hint">Drafts approve themselves {{ hours() }} hours after I write them. Posts already waiting keep their current time.</p>
            </div>

            <div class="ms-card block">
              <h3>Notes from Maya</h3>
              <label class="toggle-row">
                <ms-icon name="bell" [size]="18" />
                <span><strong>Push to the Maya app</strong><small>Approve or hold right from the notification</small></span>
                <input type="checkbox" role="switch" class="switch" [checked]="notifyPush()" (change)="notifyPush.set($any($event.target).checked)" />
              </label>
              <label class="toggle-row">
                <ms-icon name="mail" [size]="18" />
                <span><strong>Email to {{ email() }}</strong><small>Same note, with Approve and Hold buttons</small></span>
                <input type="checkbox" role="switch" class="switch" [checked]="notifyEmail()" (change)="notifyEmail.set($any($event.target).checked)" />
              </label>
              <p class="hint">I send one note per review batch, at 9:00 AM, plus one if a post fails or a pinned post is about to expire.</p>
            </div>

            <a class="ms-link channels-link" routerLink="/strategy" fragment="channels-title">Channels are on Strategy <ms-icon name="chevron-right" [size]="14" /></a>
          </section>
        </div>

        <aside class="side">
          <div class="ms-card">
            <h2><img class="ms-avatar" src="assets/maya-avatar.png" alt="" />When you save</h2>
            <p>Profile changes: I re-check the strategy. Social settings apply right away.</p>
          </div>
          <button type="button" class="ms-btn ms-btn--primary ms-btn--52 ms-btn--block" [disabled]="!valid() || saving()" (click)="save()">
            @if (saving()) { <span class="ms-spinner" aria-hidden="true"></span> Saving… } @else { Save }
          </button>
          @if (!valid()) { <p class="ms-muted" style="font-size: 14px">Company name, goal and at least one product are required.</p> }
        </aside>
      </div>
    </main>
  `,
} )
export class ProfileComponent {
  private readonly api = inject( MayaSocialApi );
  private readonly state = inject( MayaSocialState );
  private readonly router = inject( Router );
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
  readonly hours = signal<AutoApproveHours>( this.state.overview()?.autoApproveHours ?? 6 );
  readonly notifyPush = signal( this.state.overview()?.notifyPush ?? true );
  readonly notifyEmail = signal( this.state.overview()?.notifyEmail ?? true );
  readonly email = computed( () => this.state.overview()?.profile.email || this.state.email() );

  readonly valid = computed( () => !!this.companyName().trim() && !!this.companyGoal().trim() && this.products().some( ( product ) => product.name.trim() ) );

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
    const overview = this.state.overview();
    const settingsChanged = this.hours() !== overview?.autoApproveHours || this.notifyPush() !== overview?.notifyPush || this.notifyEmail() !== overview?.notifyEmail;
    const settings$: Observable<unknown> = settingsChanged
      ? this.api.updateSettings( { autoApproveHours: this.hours(), notifyPush: this.notifyPush(), notifyEmail: this.notifyEmail() } )
      : of( null );
    // Settings first (no re-check), then the profile if it changed (re-checks the strategy).
    settings$.pipe(
      switchMap( () => ( this.dirty() ? this.api.saveProfile( this.profilePayload() ) : this.api.overview() ) ),
    ).subscribe( {
      next: ( next ) => {
        const profileSaved = this.dirty();
        this.state.set( { ...next, entitled: true } );
        this.saving.set( false );
        this.dirty.set( false );
        if ( profileSaved && next.pendingStrategy && next.strategy ) {
          void this.router.navigate( ['/strategy'] );
        } else {
          this.notifications.show( 'Saved', profileSaved ? 'The strategy still fits.' : 'Your Social settings apply right away.', 'success' );
        }
      },
      error: () => {
        this.saving.set( false );
        this.notifications.show( 'That didn’t save', 'Try again.', 'error' );
      },
    } );
  }

  private profilePayload () {
    return {
      companyName: this.companyName().trim(),
      companyGoal: this.companyGoal().trim(),
      products: this.products().filter( ( product ) => product.name.trim() ),
      audience: this.audience().trim(),
      location: this.location().trim(),
      website: this.website().trim(),
      tones: this.tones(),
    };
  }
}

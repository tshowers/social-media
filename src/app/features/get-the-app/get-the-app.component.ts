import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Observable } from 'rxjs';
import {
  GET_THE_APP_PRODUCTS,
  GET_THE_APP_STEPS,
  GetTheAppProduct,
  GetTheAppProductKey,
  appStoreUrl,
  getTheAppFaqs,
  isLiveOnAppStore,
} from '@taliferro/ui/platform/get-the-app.model';
import { WriteAccessService, WriteAccessState } from '../../services/write-access.service';

/**
 * /pricing - "Browse free, create with the app." Same page on every TODD
 * web app; all wording, prices and App Store ids come from
 * @taliferro/ui/platform/get-the-app.model.ts. The App Store button shows
 * "Coming soon" until Apple's lookup finds the app live, then links to it -
 * no code change on launch day.
 */
@Component( {
  selector: 'app-get-the-app',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './get-the-app.component.html',
  styleUrl: './get-the-app.component.css',
} )
export class GetTheAppComponent implements OnInit {
  /** Set by the route's `data.product`, or directly. */
  @Input() productKey: GetTheAppProductKey = 'social';

  private readonly route = inject( ActivatedRoute );
  private readonly title = inject( Title );
  private readonly writeAccess = inject( WriteAccessService );

  product!: GetTheAppProduct;
  readonly steps = GET_THE_APP_STEPS;
  faqs = getTheAppFaqs( GET_THE_APP_PRODUCTS.social );
  state$!: Observable<WriteAccessState>;
  isLive = false;
  appStoreLink = '';

  async ngOnInit (): Promise<void> {
    const key = ( this.route.snapshot.data['product'] as GetTheAppProductKey | undefined ) || this.productKey;
    this.product = GET_THE_APP_PRODUCTS[key];
    this.faqs = getTheAppFaqs( this.product );
    this.state$ = this.writeAccess.state( key );
    this.title.setTitle( `Pricing — ${this.product.shortName} | Taliferro Tech` );
    this.isLive = await isLiveOnAppStore( this.product );
    this.appStoreLink = this.isLive ? appStoreUrl( this.product ) : '';
  }
}

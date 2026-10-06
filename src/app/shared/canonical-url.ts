import { DOCUMENT } from '@angular/common';
import { EnvironmentProviders, inject, provideEnvironmentInitializer } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

/**
 * Keeps <link rel="canonical"> pointing at the page being shown.
 *
 * index.html ships the site's home URL as the canonical, so without this
 * every page tells Google it's a duplicate of the home page ("Alternate page
 * with proper canonical tag" in Search Console). The site's origin is read
 * from that index.html tag, so this behaves the same in the browser and
 * when pages are prerendered. Query strings and fragments are dropped, so
 * ?ref= and other tracking parameters never become separate pages.
 */
export function provideCanonicalUrl (): EnvironmentProviders {
  return provideEnvironmentInitializer( () => {
    const document = inject( DOCUMENT );
    const router = inject( Router );

    const link = document.querySelector<HTMLLinkElement>( 'link[rel="canonical"]' );
    const href = link?.getAttribute( 'href' ) || '';
    let origin = '';
    try {
      origin = new URL( href ).origin;
    } catch {
      return;
    }

    router.events
      .pipe( filter( ( event ): event is NavigationEnd => event instanceof NavigationEnd ) )
      .subscribe( ( event ) => {
        const path = event.urlAfterRedirects.split( /[?#]/ )[0] || '/';
        link!.setAttribute( 'href', `${ origin }${ path }` );
      } );
  } );
}

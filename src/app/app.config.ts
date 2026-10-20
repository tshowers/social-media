import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';

import { routes } from './app.routes';
import { environment } from '../environments/environment';
import { provideCanonicalUrl } from './shared/canonical-url';
import { devProviders } from './maya-social/dev-mock';

initializeApp( environment.firebaseConfig );

/**
 * Cypress-only bootstrap gate for the Firebase Local Emulator Suite (same
 * as SayIt's). cypress/support/commands.ts's visitWithFirebaseEmulators
 * sets __useFirebaseEmulators in localStorage before any app code runs, so
 * this points Auth and Firestore at localhost before the guards ask who is
 * signed in. Gated on window.Cypress, which Cypress injects into every page
 * it drives and which is never present in a normal browser, so production
 * and regular dev use take the immediately-resolved branch untouched.
 */
export const appReady: Promise<void> = ( async () => {
  if ( typeof window === 'undefined' || !( window as any ).Cypress || window.localStorage.getItem( '__useFirebaseEmulators' ) !== 'true' ) {
    return;
  }

  connectAuthEmulator( getAuth(), 'http://127.0.0.1:9499', { disableWarnings: true } );
  const { connectFirestoreEmulator, getFirestore } = await import( 'firebase/firestore' );
  connectFirestoreEmulator( getFirestore(), '127.0.0.1', 8480 );
} )();

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter( routes, withComponentInputBinding(), withInMemoryScrolling( { anchorScrolling: 'enabled', scrollPositionRestoration: 'enabled' } ) ),
    provideCanonicalUrl(),
    ...devProviders(),
  ]
};

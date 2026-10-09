import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { initializeApp } from 'firebase/app';

import { routes } from './app.routes';
import { environment } from '../environments/environment';
import { provideCanonicalUrl } from './shared/canonical-url';
import { devProviders } from './maya-social/dev-mock';

initializeApp( environment.firebaseConfig );

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter( routes, withComponentInputBinding(), withInMemoryScrolling( { anchorScrolling: 'enabled', scrollPositionRestoration: 'enabled' } ) ),
    provideCanonicalUrl(),
    ...devProviders(),
  ]
};

/** Production: no mock, just the real HTTP stack (see dev-mock.ts). */
import { EnvironmentProviders, Provider } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { idTokenInterceptor } from '../core/interceptors/id-token.interceptor';

export function devProviders (): ( Provider | EnvironmentProviders )[] {
  return [provideHttpClient( withInterceptors( [idTokenInterceptor] ) )];
}

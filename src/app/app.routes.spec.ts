import { routes } from './app.routes';

describe( 'app routes', () => {
  it( 'guards the signed-in pages', () => {
    for ( const path of [ 'command', 'calendar', 'accounts', 'strategy', 'queue' ] ) {
      const route = routes.find( ( r ) => r.path === path );
      expect( route ).withContext( path ).toBeDefined();
      expect( route?.canActivate?.length ).withContext( path ).toBeGreaterThan( 0 );
    }
  } );

  it( 'ends with a wildcard Not Found route', () => {
    expect( routes[ routes.length - 1 ].path ).toBe( '**' );
  } );
} );

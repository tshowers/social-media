/**
 * visitWithFirebaseEmulators writes __useFirebaseEmulators to localStorage
 * before the app boots. app.config.ts only reads it when window.Cypress is
 * present (see appReady there) - this has no effect outside a
 * Cypress-driven browser, never in production, never in normal dev use.
 */
declare global {
  namespace Cypress {
    interface Chainable {
      visitWithFirebaseEmulators ( path: string, options?: Partial<Cypress.VisitOptions> ): Chainable<AUTWindow>;
    }
  }
}

Cypress.Commands.add( 'visitWithFirebaseEmulators', ( path: string, options?: Partial<Cypress.VisitOptions> ) => {
  return cy.visit( path, {
    ...options,
    onBeforeLoad: ( win ) => {
      win.localStorage.setItem( '__useFirebaseEmulators', 'true' );
      if ( options?.onBeforeLoad ) {
        options.onBeforeLoad( win );
      }
    },
  } );
} );

export { };

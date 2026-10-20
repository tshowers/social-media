// You can add custom commands or global hooks here
import './commands';

// Prevent AUT-level uncaught exceptions (e.g. Firebase init, zone.js async errors)
// from failing tests.
Cypress.on( 'uncaught:exception', () => false );

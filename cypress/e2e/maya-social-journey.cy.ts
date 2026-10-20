/**
 * One new Maya Social subscriber's whole visit, sign in to sign out: locked
 * out while signed out, in through TODD's (stubbed) hosted login and
 * /auth/callback, the first-run screen, the missing profile fields, Maya
 * building the strategy, connecting all five channels, approving the
 * strategy, approving the day's posts, seeing one go out on every channel,
 * then signing out and finding the app locked again.
 *
 * Sign-in is real against the Firebase Auth emulator, and every API call
 * carries that session's ID token. The Maya Social backend is the stateful
 * fake in cypress/support/maya-social-api.ts; the publish step is its
 * stand-in for the 15-minute job.
 */
import { emulatorCustomToken } from '../support/emulator-token';
import { CHANNELS, FakeMayaSocial, PROVIDER_LOGIN, TODAY, TODAY_POST, TOMORROW_POST } from '../support/maya-social-api';

/** The uid inside an emulator ID token ("Bearer <jwt>"). */
function tokenUid ( authorization: string ): string {
  const payload = authorization.replace( /^Bearer /, '' ).split( '.' )[1] || '';
  return JSON.parse( atob( payload.replace( /-/g, '+' ).replace( /_/g, '/' ) ) ).user_id;
}

/** Channel key -> the provider name the connect route takes. */
const PROVIDERS: Record<string, string> = {
  linkedin: 'linkedin', threads: 'threads', facebook: 'facebook', instagram: 'instagram', google_business_profile: 'google',
};

const channelRow = ( name: string ) => cy.contains( 'ms-strategy-channels .row strong', new RegExp( `^${ name }$` ) ).parents( '.row' );

describe( 'Maya Social journey - sign in to sign out', () => {
  it( 'signs in, sets up, connects every channel, approves posts, sees one go out everywhere and signs out', () => {
    const uid = `cy-social-${ Date.now() }`;
    const api = new FakeMayaSocial();
    api.install();
    cy.intercept( 'GET', 'https://todd.taliferro.tech/login*', { statusCode: 200, body: '<html><body>TODD login</body></html>' } ).as( 'toddLogin' );
    cy.intercept( 'GET', `${ PROVIDER_LOGIN }/**`, { statusCode: 200, body: '<html><body>Provider sign-in</body></html>' } ).as( 'providerLogin' );

    cy.log( 'Signed out: the app sends you to the doorway' );
    cy.visitWithFirebaseEmulators( '/today' );
    cy.location( 'pathname', { timeout: 40000 } ).should( 'eq', '/' );
    cy.contains( 'h1', 'Maya runs your social media.' );
    cy.then( () => expect( api.calls, 'no Maya Social calls while signed out' ).to.be.empty );

    cy.log( 'Sign in: header -> TODD hosted login -> /auth/callback' );
    cy.contains( 'header button', 'Sign in' ).click();
    cy.wait( '@toddLogin' ).then( ( { request } ) => {
      const url = new URL( request.url );
      expect( url.searchParams.get( 'client' ) ).to.equal( 'social-web-local' );
      const state = url.searchParams.get( 'state' ) || '';
      expect( state ).to.have.length.greaterThan( 10 );
      cy.visitWithFirebaseEmulators( `/auth/callback?token=${ emulatorCustomToken( uid ) }&state=${ state }` );
    } );

    cy.log( 'First visit with a subscription: the welcome screen' );
    cy.location( 'pathname', { timeout: 40000 } ).should( 'eq', '/welcome' );
    cy.contains( 'h1', 'Before I take over your calendar' );
    cy.then( () => expect( tokenUid( api.last( 'GET', '/overview' ).authorization ), 'overview carries the signed-in user’s ID token' ).to.equal( uid ) );

    cy.contains( '[role="radio"]', '4 hours' ).click().should( 'have.attr', 'aria-checked', 'true' );
    cy.contains( 'button', 'Set up Maya Social' ).click();
    cy.location( 'pathname' ).should( 'eq', '/strategy' );
    cy.then( () => expect( api.last( 'POST', '/onboard' ).body ).to.deep.equal( { autoApproveHours: 4 } ) );

    cy.log( 'Profile: fill in what Maya still needs, then she builds the strategy' );
    cy.contains( 'h2', 'I can’t build a strategy yet.' );
    cy.get( '#company-name' ).should( 'have.value', 'Hopper Signs' );
    cy.get( '#company-goal' ).type( 'Bring 30 new walk-in customers a month' );
    cy.get( 'input[aria-label="Product 1 name"]' ).type( 'Storefront signs' );
    cy.get( 'input[aria-label="Product 1 description"]' ).type( 'Hand-lettered and lit signs for small shops' );
    cy.contains( 'button', 'Save and generate strategy' ).should( 'not.be.disabled' ).click();
    cy.contains( 'h1', 'Building your strategy…' );
    cy.contains( 'h2', 'Here’s my first strategy for you.', { timeout: 15000 } );
    cy.contains( 'h1', 'Bring 30 new walk-in customers a month' );
    cy.then( () => {
      expect( api.last( 'PATCH', '/profile' ).body['profile'] ).to.deep.include( {
        companyName: 'Hopper Signs',
        companyGoal: 'Bring 30 new walk-in customers a month',
        products: [{ name: 'Storefront signs', description: 'Hand-lettered and lit signs for small shops' }],
      } );
    } );

    cy.log( 'Connect every channel in the strategy' );
    Object.entries( CHANNELS ).forEach( ( [key, name] ) => {
      channelRow( name ).should( 'contain.text', 'Not connected' ).contains( 'button', 'Connect' ).click();
      cy.wait( '@providerLogin' ).then( ( { request } ) => {
        expect( request.url ).to.include( `/${ PROVIDERS[key] }/authorize` );
        const start = api.last( 'POST', `/outreach/social-auth/${ PROVIDERS[key] }/start` );
        expect( start.body['frontendReturnUrl'] ).to.equal( `${ Cypress.config( 'baseUrl' ) }/strategy` );
        expect( start.headers['x-user-id'] ).to.equal( uid );
        expect( tokenUid( start.authorization ) ).to.equal( uid );
        if ( key === 'google_business_profile' ) expect( start.body['destination'] ).to.equal( 'google_business_profile' );
        // The owner signs in at the provider; its callback lands on the backend, then sends them home.
        api.completeConnect( key );
        cy.visitWithFirebaseEmulators( '/strategy' );
      } );
      channelRow( name ).should( 'contain.text', 'Connected' ).and( 'contain.text', `Hopper Signs on ${ name }` );
    } );

    cy.log( 'Approve the strategy: Maya plans the calendar' );
    cy.contains( 'button', 'Approve and plan my calendar' ).click();
    cy.location( 'pathname' ).should( 'eq', '/today' );
    cy.get( 'ms-no-channels' ).should( 'not.exist' );
    cy.contains( 'h1', '2 posts need you today.' );

    cy.log( 'Approve both posts waiting for review' );
    [TODAY_POST, TOMORROW_POST].forEach( ( title ) => {
      cy.contains( 'article.card', title ).contains( 'button', 'Approve now' ).click();
      cy.contains( '.approved', title ).should( 'contain.text', 'Approved.' );
    } );
    cy.contains( 'h1', 'You’re clear for today.' );
    cy.then( () => {
      const approved = api.posts.filter( ( item ) => item['status'] === 'approved' );
      expect( approved.map( ( item ) => item['id'] ) ).to.have.members( ['p-today', 'p-tomorrow'] );
      approved.forEach( ( item ) => expect( item['approvedBy'] ).to.equal( 'owner' ) );
    } );

    cy.log( 'Today’s slot arrives: it goes out on all five channels' );
    cy.then( () => api.runPublishJob( `${ TODAY }T23:59:00-05:00` ) );
    cy.visitWithFirebaseEmulators( '/calendar' );
    cy.contains( '.day h3', TODAY_POST, { timeout: 15000 } ).click();
    cy.get( 'aside.drawer' ).within( () => {
      cy.get( '.top .ms-status' ).should( 'have.text', 'Posted' );
      cy.get( '.rows .row' ).should( 'have.length', 5 );
      Object.entries( CHANNELS ).forEach( ( [key, name] ) => {
        cy.contains( '.rows .row', name ).within( () => {
          cy.get( 'ms-icon' ).should( 'exist' );
          cy.contains( 'a', 'View' ).should( 'have.attr', 'href', `https://${ key }.example/hopper-signs/p-today` );
        } );
      } );
      cy.get( '.rows .row.is-failed' ).should( 'not.exist' );
      cy.get( 'button[aria-label="Close"]' ).click();
    } );
    cy.contains( '.day h3', TOMORROW_POST ).click();
    cy.get( 'aside.drawer' ).within( () => {
      cy.get( '.top .ms-status' ).should( 'have.text', 'Approved' );
      cy.contains( 'button', 'Undo approval' );
      cy.get( 'button[aria-label="Close"]' ).click();
    } );

    cy.log( 'Sign out' );
    cy.get( 'button.platform-menu-trigger' ).click();
    cy.contains( '.um-panel button', 'Sign out' ).click();
    cy.location( 'pathname' ).should( 'eq', '/' );
    cy.contains( 'header button', 'Sign in' ).should( 'be.visible' );
    cy.contains( 'button', 'I have Maya Social. Sign in' );

    cy.log( 'Signed out stays signed out, even after a fresh load' );
    let callsAtSignOut = 0;
    cy.then( () => { callsAtSignOut = api.calls.length; } );
    cy.visitWithFirebaseEmulators( '/calendar' );
    cy.location( 'pathname', { timeout: 40000 } ).should( 'eq', '/' );
    cy.contains( 'header button', 'Sign in' ).should( 'be.visible' );
    cy.visitWithFirebaseEmulators( '/strategy' );
    cy.location( 'pathname', { timeout: 40000 } ).should( 'eq', '/' );
    cy.then( () => {
      expect( api.calls.length, 'no Maya Social calls after signing out' ).to.equal( callsAtSignOut );
      expect( api.unhandled, 'calls the fake doesn’t handle' ).to.be.empty;
    } );
  } );
} );

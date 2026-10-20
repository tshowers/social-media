/**
 * Fails fast when the e2e dev-server port is already taken.
 *
 * start-server-and-test only waits for *something* to answer on the URL, so
 * if another app (TODD Docs, an old `ng serve`) already holds the port,
 * `ng serve` dies and Cypress quietly runs every Maya Social spec against the
 * wrong app. Checking first turns that into one clear error.
 *
 *   node scripts/e2e-port-check.js 4800
 */
const net = require( 'net' );

const port = Number( process.argv[2] );
const hosts = ['127.0.0.1', '::1'];

function inUse ( host ) {
  return new Promise( ( resolve ) => {
    const socket = net.connect( { host, port } );
    socket.setTimeout( 1000 );
    socket.once( 'connect', () => { socket.destroy(); resolve( true ); } );
    socket.once( 'timeout', () => { socket.destroy(); resolve( false ); } );
    socket.once( 'error', () => resolve( false ) );
  } );
}

Promise.all( hosts.map( inUse ) ).then( ( results ) => {
  if ( results.some( Boolean ) ) {
    console.error( `\nPort ${port} is already in use, so the Maya Social e2e run would test whatever is serving it.` );
    console.error( `Stop that server (lsof -nP -iTCP:${port} -sTCP:LISTEN shows it) and run again.\n` );
    process.exit( 1 );
  }
} );

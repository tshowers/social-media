/**
 * A custom token the Firebase Auth emulator accepts (it does not check
 * signatures), standing in for the one TODD's hosted login hands back to
 * /auth/callback.
 */
export function emulatorCustomToken ( uid: string ): string {
  const encode = ( value: object ) => btoa( JSON.stringify( value ) ).replace( /=+$/, '' ).replace( /\+/g, '-' ).replace( /\//g, '_' );
  const now = Math.floor( Date.now() / 1000 );
  return `${encode( { alg: 'none', typ: 'JWT' } )}.${encode( {
    iss: 'firebase-auth-emulator@example.com',
    sub: 'firebase-auth-emulator@example.com',
    aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
    iat: now,
    exp: now + 3600,
    uid,
  } )}.`;
}

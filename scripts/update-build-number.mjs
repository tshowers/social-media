import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const buildInfoPath = resolve( 'src/app/build-info.ts' );
const currentSource = existsSync( buildInfoPath ) ? readFileSync( buildInfoPath, 'utf8' ) : '';
const currentNumber = Number( currentSource.match( /BUILD_NUMBER\s*=\s*['"](\d+)['"]/ )?.[1] || 0 );
const nextNumber = String( currentNumber + 1 );

writeFileSync( buildInfoPath, `export const BUILD_NUMBER = '${ nextNumber }';\n` );
console.log( `Build number: ${ nextNumber }` );

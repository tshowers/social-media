import { Pillar, Post, PostStatus, Strategy } from './api';

/** Dates are local calendar days, "YYYY-MM-DD", in the owner's time zone. */

export function addDays ( dateKey: string, days: number ): string {
  const [y, m, d] = dateKey.split( '-' ).map( Number );
  return new Date( Date.UTC( y, m - 1, d + days ) ).toISOString().slice( 0, 10 );
}

export function daysBetween ( from: string, to: string ): number {
  const utc = ( key: string ) => {
    const [y, m, d] = key.split( '-' ).map( Number );
    return Date.UTC( y, m - 1, d );
  };
  return Math.round( ( utc( to ) - utc( from ) ) / 86400000 );
}

/** Formats a calendar day without shifting it through a time zone. */
function dayFormat ( dateKey: string, options: Intl.DateTimeFormatOptions ): string {
  const [y, m, d] = dateKey.split( '-' ).map( Number );
  return new Intl.DateTimeFormat( 'en-US', { ...options, timeZone: 'UTC' } ).format( new Date( Date.UTC( y, m - 1, d ) ) );
}

/** "Thu" */
export const weekdayShort = ( dateKey: string ) => dayFormat( dateKey, { weekday: 'short' } );
/** "Thursday" */
export const weekdayLong = ( dateKey: string ) => dayFormat( dateKey, { weekday: 'long' } );
/** 8 */
export const dayOfMonth = ( dateKey: string ) => Number( dateKey.slice( 8, 10 ) );
/** "Oct 8" */
export const monthDay = ( dateKey: string ) => dayFormat( dateKey, { month: 'short', day: 'numeric' } );
/** "Thu, Oct 8" */
export const shortDate = ( dateKey: string ) => dayFormat( dateKey, { weekday: 'short', month: 'short', day: 'numeric' } );
/** "THURSDAY, OCTOBER 8" (styled uppercase by CSS) */
export const longDate = ( dateKey: string ) => dayFormat( dateKey, { weekday: 'long', month: 'long', day: 'numeric' } );
/** "October 2026" */
export const monthYear = ( dateKey: string ) => dayFormat( dateKey, { month: 'long', year: 'numeric' } );

/** "4:00 PM" for an instant, in the owner's zone. */
export function clock ( iso: string | undefined, timeZone: string ): string {
  if ( !iso ) return '';
  return new Intl.DateTimeFormat( 'en-US', { hour: 'numeric', minute: '2-digit', timeZone } ).format( new Date( iso ) );
}

/** "4:00 PM" for a post's HH:MM. */
export function wallClock ( time: string ): string {
  const [h, m] = ( time || '09:00' ).split( ':' ).map( Number );
  const hour = h % 12 || 12;
  return `${ hour }:${ String( m || 0 ).padStart( 2, '0' ) } ${ h < 12 ? 'AM' : 'PM' }`;
}

/** "Today at 4:00 PM" / "Tomorrow at 9:00 AM" / "Fri, Oct 9 at 9:00 AM" */
export function slotLabel ( post: Pick<Post, 'slotDate' | 'time'>, today: string ): string {
  const day = post.slotDate === today ? 'Today' : shortDate( post.slotDate );
  return `${ day } at ${ wallClock( post.time ) }`;
}

/** The day of an instant in the owner's zone. */
export function localDateKey ( iso: string, timeZone: string ): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat( 'en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' } )
      .formatToParts( new Date( iso ) ).map( ( part ) => [part.type, part.value] ),
  );
  return `${ parts['year'] }-${ parts['month'] }-${ parts['day'] }`;
}

/** "Fri" for the day before or after, else "Friday" within a week, else "Fri, Oct 9", for an instant. */
export function relativeDayAt ( iso: string, timeZone: string, today: string ): string {
  const key = localDateKey( iso, timeZone );
  const diff = daysBetween( today, key );
  const day = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : diff > 1 && diff < 7 ? weekdayLong( key ) : shortDate( key );
  return `${ day } at ${ clock( iso, timeZone ) }`;
}

export const STATUS_LABELS: Record<PostStatus, string> = {
  planned: 'Planned',
  drafted: 'Drafted',
  needs_review: 'Needs review',
  approved: 'Approved',
  on_hold: 'On hold',
  posted: 'Posted',
  expired: 'Expired',
  dropped: 'Dropped',
  paused: 'Paused',
};

export function pillarOf ( strategy: Strategy | null | undefined, key: string ): Pillar {
  return strategy?.pillars.find( ( pillar ) => pillar.key === key )
    || { key, name: key, share: 0, description: '', maxOneIn: 0, tint: 'blue' };
}

/** "LinkedIn, Threads" / "All 5 channels" */
export function channelList ( keys: string[], names: Record<string, string>, total: number ): string {
  if ( total > 2 && keys.length === total ) return `All ${ total } channels`;
  return keys.map( ( key ) => names[key] || key ).join( ', ' );
}

/** "1 post" / "2 posts" */
export function plural ( count: number, one: string, many = `${ one }s` ): string {
  return `${ count } ${ count === 1 ? one : many }`;
}

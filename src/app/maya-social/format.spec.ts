import { addDays, channelList, daysBetween, plural, slotLabel, wallClock } from './format';

describe( 'Maya Social format', () => {
  it( 'adds days across months and years', () => {
    expect( addDays( '2026-10-31', 1 ) ).toBe( '2026-11-01' );
    expect( addDays( '2026-12-31', 1 ) ).toBe( '2027-01-01' );
    expect( daysBetween( '2026-10-08', '2026-10-14' ) ).toBe( 6 );
  } );

  it( 'labels a slot the way the design does (1a)', () => {
    expect( slotLabel( { slotDate: '2026-10-08', time: '16:00' }, '2026-10-08' ) ).toBe( 'Today at 4:00 PM' );
    expect( slotLabel( { slotDate: '2026-10-09', time: '09:00' }, '2026-10-08' ) ).toBe( 'Fri, Oct 9 at 9:00 AM' );
    expect( wallClock( '12:00' ) ).toBe( '12:00 PM' );
    expect( wallClock( '00:30' ) ).toBe( '12:30 AM' );
  } );

  it( 'names channels, and says "All 5 channels" when every one is on', () => {
    const names = { linkedin: 'LinkedIn', threads: 'Threads' };
    expect( channelList( ['linkedin', 'threads'], names, 5 ) ).toBe( 'LinkedIn, Threads' );
    expect( channelList( ['a', 'b', 'c', 'd', 'e'], {}, 5 ) ).toBe( 'All 5 channels' );
  } );

  it( 'pluralizes', () => {
    expect( plural( 1, 'post' ) ).toBe( '1 post' );
    expect( plural( 18, 'unpinned post' ) ).toBe( '18 unpinned posts' );
  } );
} );

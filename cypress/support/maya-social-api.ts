/**
 * A stateful stand-in for the TODD backend's Maya Social API
 * (todd-backend/functions/mayaSocial/routes.js) and the channel-connect
 * start route, wired in with cy.intercept. It keeps one tenant's overview
 * and posts across page loads, so a whole visit - first run, profile,
 * strategy, channels, approvals, publishing - plays out against it. The
 * backend's own rules are covered by its jest suite (mayaSocial.*.test.js);
 * this only answers the way those routes answer.
 *
 * Every call is recorded (with its Authorization header) so the spec can
 * check what the app sent. A call this fake doesn't know gets a 501 and is
 * listed in `unhandled`, so the spec fails instead of quietly passing.
 */

export const TODAY = '2026-10-08';
const OFFSET = '-05:00'; // America/Chicago in October
const API = 'https://api.taliferro.tech/api';

/** Where the fake channel sign-in pages live (stubbed by the spec). */
export const PROVIDER_LOGIN = 'https://provider-login.test';

export const CHANNELS: Record<string, string> = {
  linkedin: 'LinkedIn',
  threads: 'Threads',
  facebook: 'Facebook',
  instagram: 'Instagram',
  google_business_profile: 'Google Business',
};
const CHANNEL_KEYS = Object.keys( CHANNELS );

export const TODAY_POST = 'Three signs your storefront sign is costing you walk-ins';
export const TOMORROW_POST = 'How Alder Dental doubled walk-ins with one new sign';

type Json = Record<string, any>;

export interface RecordedCall {
  method: string;
  path: string;
  body: Json;
  authorization: string;
  headers: Json;
}

const iso = ( date: string, time: string ) => new Date( `${ date }T${ time }:00${ OFFSET }` ).toISOString();
export const addDays = ( date: string, days: number ) => {
  const [y, m, d] = date.split( '-' ).map( Number );
  return new Date( Date.UTC( y, m - 1, d + days ) ).toISOString().slice( 0, 10 );
};

function strategy ( goal: string, autoApproveHours: number ): Json {
  return {
    goal,
    pillars: [
      { key: 'proof', name: 'Proof', share: 35, description: 'Customer results with real numbers.', maxOneIn: 0, tint: 'green' },
      { key: 'howto', name: 'How-to', share: 30, description: 'Practical tips for shop owners.', maxOneIn: 0, tint: 'blue' },
      { key: 'product', name: 'Product', share: 20, description: 'What the shop makes.', maxOneIn: 4, tint: 'violet' },
      { key: 'behind', name: 'Behind the scenes', share: 15, description: 'The studio and how the work gets done.', maxOneIn: 0, tint: 'yellow' },
    ],
    channels: [
      { key: 'linkedin', name: 'LinkedIn', role: 'Main channel. Buyers are here.', perWeek: 5 },
      { key: 'threads', name: 'Threads', role: 'Short versions of how-to posts.', perWeek: 4 },
      { key: 'facebook', name: 'Facebook', role: 'Proof and product, for local owners.', perWeek: 3 },
      { key: 'instagram', name: 'Instagram', role: 'Finished work, with photos.', perWeek: 2 },
      { key: 'google_business_profile', name: 'Google Business', role: 'Updates for local search.', perWeek: 1 },
    ],
    autoApproveHours,
    builtAt: iso( TODAY, '08:00' ),
  };
}

function post ( id: string, slotDate: string, pillar: string, title: string, status: string, time: string, channels: string[], extra: Json = {} ): Json {
  return {
    id, pillar, title, body: '', imageBrief: '', channels, slotDate, originalSlotDate: slotDate, time, slotAt: iso( slotDate, time ),
    pinned: false, status, source: 'maya', movedBackDays: 0, ...extra,
  };
}

export class FakeMayaSocial {
  readonly calls: RecordedCall[] = [];
  readonly unhandled: string[] = [];
  /** Other TODD backend calls (account summary and the like), answered with an empty success. */
  readonly otherBackendCalls: string[] = [];
  posts: Json[] = [];

  private state: Json = {
    entitled: true,
    onboardedAt: null,
    autoApproveHours: 6,
    notifyPush: true,
    notifyEmail: true,
    timeZone: 'America/Chicago',
    profile: {
      email: '', firstName: 'Grace', lastName: 'Hopper', companyName: 'Hopper Signs', companyGoal: '', companyDescription: '',
      timezone: 'America/Chicago', products: [], audience: '', location: 'Tacoma, WA', website: '', tones: [],
    },
    strategy: null,
    pendingStrategy: null,
    plannedThrough: null,
    nextPlanDate: null,
    connected: [] as string[],
  };

  /** GET /overview, with the fields the backend derives. */
  overview (): Json {
    const { connected, ...rest } = this.state;
    const profile = rest['profile'];
    const missing = [
      !profile.companyName && 'companyName',
      !profile.companyGoal && 'companyGoal',
      !profile.products.length && 'products',
    ].filter( Boolean );
    const strategyChannels: string[] = ( rest['strategy']?.channels ?? [] ).map( ( channel: Json ) => channel['key'] );
    return {
      ...rest,
      today: TODAY,
      missing,
      pendingChange: null,
      connectedChannels: [...connected],
      channelStatus: CHANNEL_KEYS.map( ( key ) => ( {
        key, name: CHANNELS[key], signedOutAt: null,
        status: connected.includes( key ) ? 'connected' : 'not_connected',
        account: connected.includes( key ) ? `Hopper Signs on ${ CHANNELS[key] }` : '',
      } ) ),
      // 2c: with a strategy but none of its channels connected, nothing publishes.
      publishingPaused: !!rest['strategy'] && !strategyChannels.some( ( key ) => connected.includes( key ) ),
      channels: CHANNELS,
    };
  }

  /** The most recent call to `method path`. */
  last ( method: string, path: string ): RecordedCall {
    const call = [...this.calls].reverse().find( ( item ) => item.method === method && item.path === path );
    if ( !call ) throw new Error( `No ${ method } ${ path } call was made` );
    return call;
  }

  /** What the provider's OAuth callback does on the backend once the owner signs in. */
  completeConnect ( channel: string ): void {
    if ( !this.state['connected'].includes( channel ) ) this.state['connected'].push( channel );
  }

  /**
   * The 15-minute job (scheduledMayaSocial.js) reaching `at`: every approved
   * post whose slot has arrived goes out to each of its channels that is
   * connected, and records a result per channel (gaps 2n).
   */
  runPublishJob ( at: string ): void {
    const now = new Date( at ).getTime();
    this.posts = this.posts.map( ( item ) => {
      if ( item['status'] !== 'approved' || new Date( item['slotAt'] ).getTime() > now ) return item;
      const channelResults = item['channels'].map( ( channel: string ) => ( this.state['connected'].includes( channel )
        ? { channel, status: 'posted', url: `https://${ channel }.example/hopper-signs/${ item['id'] }`, postedAt: item['slotAt'] }
        : { channel, status: 'failed', reason: 'account_disconnected', error: `${ CHANNELS[channel] } isn’t connected.` } ) );
      return { ...item, status: 'posted', channelResults };
    } );
  }

  /** Registers the intercepts. Call once at the start of a test. */
  install (): void {
    // Anything else on the TODD backend: answer, never reach production.
    cy.intercept( { url: `${ API }/**` }, ( req ) => {
      this.otherBackendCalls.push( `${ req.method } ${ req.url }` );
      req.reply( { statusCode: 200, body: { success: true } } );
    } );

    cy.intercept( { url: `${ API }/maya-social/**` }, ( req ) => {
      const url = new URL( req.url );
      const path = url.pathname.replace( /^\/api\/maya-social/, '' );
      const body = ( req.body && typeof req.body === 'object' ? req.body : {} ) as Json;
      this.calls.push( { method: req.method, path, body, authorization: String( req.headers['authorization'] || '' ), headers: req.headers } );
      const { status, data, delay } = this.route( req.method, path, body, url.searchParams );
      req.reply( { statusCode: status, body: status < 400 ? { success: true, data } : { success: false, ...( data as Json ) }, delay } );
    } );

    // ChannelConnect -> MayaSocialApi.connectChannel: the existing Social accounts flow.
    cy.intercept( 'POST', `${ API }/outreach/social-auth/*/start`, ( req ) => {
      const provider = new URL( req.url ).pathname.split( '/' ).slice( -2 )[0];
      const body = req.body as Json;
      this.calls.push( { method: 'POST', path: `/outreach/social-auth/${ provider }/start`, body, authorization: String( req.headers['authorization'] || '' ), headers: req.headers } );
      req.reply( { statusCode: 200, body: { success: true, data: { authorizationUrl: `${ PROVIDER_LOGIN }/${ provider }/authorize?state=fake` } } } );
    } );
  }

  private route ( method: string, path: string, body: Json, params: URLSearchParams ): { status: number; data: unknown; delay?: number } {
    const ok = ( data: unknown, delay = 100 ) => ( { status: 200, data, delay } );

    if ( method === 'GET' && path === '/overview' ) return ok( this.overview() );

    if ( method === 'POST' && path === '/onboard' ) {
      this.state['onboardedAt'] = new Date().toISOString();
      this.state['autoApproveHours'] = body['autoApproveHours'];
      return ok( this.overview() );
    }

    if ( method === 'PATCH' && path === '/profile' ) {
      this.state['profile'] = { ...this.state['profile'], ...body['profile'] };
      return ok( this.overview() );
    }

    if ( method === 'POST' && path === '/strategy/generate' ) {
      const missing = this.overview()['missing'];
      if ( missing.length ) return { status: 422, data: { error: 'profile_incomplete', missing } };
      this.state['pendingStrategy'] = { ...strategy( this.state['profile'].companyGoal, this.state['autoApproveHours'] ), reason: 'requested' };
      // Long enough to see 2e ("Building your strategy…").
      return ok( this.state['pendingStrategy'], 1200 );
    }

    if ( method === 'POST' && path === '/strategy/approve' ) {
      const { reason, ...approved } = this.state['pendingStrategy'];
      this.state['strategy'] = { ...approved, approvedAt: new Date().toISOString() };
      this.state['pendingStrategy'] = null;
      this.plan();
      return ok( this.overview(), 400 );
    }

    if ( method === 'GET' && path === '/posts' ) {
      const from = params.get( 'from' ) || TODAY;
      const to = params.get( 'to' ) || TODAY;
      return ok( this.posts.filter( ( item ) => item['slotDate'] >= from && item['slotDate'] <= to ) );
    }

    const verb = path.match( /^\/posts\/([^/]+)\/(approve|undo-approve)$/ );
    if ( method === 'POST' && verb ) {
      const current = this.posts.find( ( item ) => item['id'] === decodeURIComponent( verb[1] ) );
      if ( !current ) return { status: 404, data: { error: 'not_found' } };
      const next: Json = verb[2] === 'approve'
        ? { ...current, status: 'approved', approvedBy: 'owner', approvedAt: new Date().toISOString() }
        : { ...current, status: 'needs_review', approvedBy: undefined, approvedAt: undefined };
      this.posts = this.posts.map( ( item ) => ( item['id'] === next['id'] ? next : item ) );
      return ok( next );
    }

    this.unhandled.push( `${ method } /maya-social${ path }` );
    return { status: 501, data: { error: 'not_in_fake', message: `The Cypress fake doesn't handle ${ method } ${ path }` } };
  }

  /** Approving the first strategy plans three weeks and drafts the first posts. */
  private plan (): void {
    const hoursBefore = ( date: string, time: string, hours: number ) => new Date( new Date( iso( date, time ) ).getTime() - hours * 3600_000 ).toISOString();
    const hours = this.state['autoApproveHours'];
    const pillars = ['howto', 'behind', 'product', 'proof'];
    this.posts = [
      post( 'p-today', TODAY, 'howto', TODAY_POST, 'needs_review', '16:00', [...CHANNEL_KEYS], {
        body: 'Faded letters, a light that’s out, a phone number nobody calls anymore. Here’s a two-minute check you can do from the sidewalk.',
        autoApproveAt: hoursBefore( TODAY, '16:00', 1 ), reviewOpensAt: hoursBefore( TODAY, '16:00', hours + 1 ),
      } ),
      post( 'p-tomorrow', addDays( TODAY, 1 ), 'proof', TOMORROW_POST, 'needs_review', '09:00', ['linkedin', 'facebook'], {
        body: 'Alder Dental swapped a vinyl banner for a lit, hand-lettered sign. Walk-ins went from 6 to 13 a week.',
        autoApproveAt: iso( TODAY, '18:00' ), reviewOpensAt: iso( TODAY, '12:00' ),
      } ),
      ...Array.from( { length: 19 }, ( _, i ) => post( `p-${ i + 2 }`, addDays( TODAY, i + 2 ), pillars[i % 4], `Planned post ${ i + 2 }`, 'planned', '12:00', ['linkedin', 'threads'] ) ),
    ];
    this.state['plannedThrough'] = addDays( TODAY, 20 );
    this.state['nextPlanDate'] = addDays( TODAY, 17 );
  }
}

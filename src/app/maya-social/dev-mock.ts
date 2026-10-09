/**
 * DEVELOPMENT ONLY - replaced by dev-mock.prod.ts in production builds
 * (angular.json fileReplacements). Open the app with ?mock=<scenario> on
 * localhost to run every screen against an in-memory API seeded with the
 * design's sample week (Thu, Oct 8, 2026):
 *
 *   ?mock=ready       strategy in place, two posts to review (1a, 1d-1f),
 *                     plus a failed channel, an expired pin, a post held twice
 *   ?mock=nochannels  strategy in place, nothing connected (gaps 2c)
 *   ?mock=change      a strategy change waiting after a profile save (gaps 2g)
 *   ?mock=first       Maya, first visit (1p)
 *   ?mock=new         set up, profile complete, no strategy (1h)
 *   ?mock=incomplete  set up, profile missing goal + products (1i)
 *   ?mock=nomaya      signed in without Maya (1o, Get Maya only)
 *   ?mock=out         signed out (1o)
 *   ?mock=off         back to the real API
 */
import { HttpEvent, HttpInterceptorFn, HttpRequest, HttpResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { EnvironmentProviders, Provider } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';

import { idTokenInterceptor } from '../core/interceptors/id-token.interceptor';
import { SocialAuthService } from '../services/social-auth.service';
import type { ChannelState, Overview, Post, PostCheck, Strategy, StrategyChange } from './api';

const KEY = 'maya-social-mock';
const TODAY = '2026-10-08';
const OFFSET = '-05:00'; // America/Chicago in October

function scenario (): string {
  if ( typeof window === 'undefined' || !/^(localhost|127\.0\.0\.1)$/.test( location.hostname ) ) return '';
  try {
    const param = new URLSearchParams( location.search ).get( 'mock' );
    if ( param === 'off' ) sessionStorage.removeItem( KEY );
    else if ( param ) sessionStorage.setItem( KEY, param );
    return sessionStorage.getItem( KEY ) || '';
  } catch {
    return '';
  }
}

const iso = ( date: string, time: string ) => new Date( `${ date }T${ time }:00${ OFFSET }` ).toISOString();
const add = ( date: string, days: number ) => {
  const [y, m, d] = date.split( '-' ).map( Number );
  return new Date( Date.UTC( y, m - 1, d + days ) ).toISOString().slice( 0, 10 );
};

const STRATEGY: Strategy = {
  goal: 'Book 20 discovery calls a month.',
  pillars: [
    { key: 'proof', name: 'Proof', share: 35, description: 'Customer results with real numbers.', maxOneIn: 0, tint: 'green' },
    { key: 'howto', name: 'How-to', share: 30, description: 'Practical tips on finding and qualifying leads.', maxOneIn: 0, tint: 'blue' },
    { key: 'product', name: 'Product', share: 20, description: 'Lead Vault, Find and TODD.', maxOneIn: 4, tint: 'violet' },
    { key: 'behind', name: 'Behind the scenes', share: 15, description: 'The team and how the work gets done.', maxOneIn: 0, tint: 'yellow' },
  ],
  channels: [
    { key: 'linkedin', name: 'LinkedIn', role: 'Main channel. Buyers are here.', perWeek: 5 },
    { key: 'threads', name: 'Threads', role: 'Short versions of how-to posts.', perWeek: 4 },
    { key: 'facebook', name: 'Facebook', role: 'Proof and product, for local owners.', perWeek: 3 },
    { key: 'instagram', name: 'Instagram', role: 'Behind the scenes, with photos.', perWeek: 2 },
    { key: 'google_business_profile', name: 'Google Business', role: 'Product updates for local search.', perWeek: 1 },
  ],
  autoApproveHours: 6,
  builtAt: '2026-10-01T15:00:00.000Z',
  approvedAt: '2026-10-01T15:10:00.000Z',
};

/** Striped placeholder like the design's ("not a pattern to ship"). */
const PLACEHOLDER = ( tint: string ) => 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><defs><pattern id="p" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="40" height="40" fill="#e4e7ed"/><rect width="20" height="40" fill="${ tint }"/></pattern></defs><rect width="400" height="400" fill="url(#p)"/></svg>` );

const CHANNELS = { linkedin: 'LinkedIn', threads: 'Threads', facebook: 'Facebook', instagram: 'Instagram', google_business_profile: 'Google Business' };

const TITLES: [string, string, string][] = [
  ['2026-10-01', 'howto', 'Stop buying lead lists'], ['2026-10-02', 'product', 'Our October roadmap'], ['2026-10-03', 'behind', 'How Maya plans a week'],
  ['2026-10-04', 'proof', 'Customer story: Alder Dental'], ['2026-10-05', 'howto', 'Three LinkedIn habits that work'], ['2026-10-06', 'product', 'Lead Vault now covers Texas'],
  ['2026-10-07', 'behind', 'Office hours recap'], ['2026-10-15', 'howto', 'Five questions to qualify a lead in one call'], ['2026-10-16', 'behind', 'Meet the team behind Lead Vault data'],
  ['2026-10-17', 'product', 'Lead Vault Match: let the AI pick your best leads'], ['2026-10-18', 'howto', 'Why your follow-up email gets ignored'], ['2026-10-19', 'proof', 'Three contracts from one saved search'],
  ['2026-10-20', 'howto', 'Certifications buyers filter by'], ['2026-10-21', 'product', 'TODD: your to-do list, sorted by revenue'], ['2026-10-22', 'behind', 'A day in Maya’s queue'],
  ['2026-10-23', 'howto', 'NAICS codes, explained in two minutes'], ['2026-10-24', 'proof', 'Q3 pipeline from Lead Vault users'], ['2026-10-25', 'howto', 'How to write a post in 10 minutes'],
  ['2026-10-26', 'product', 'New in Find: save and share searches'], ['2026-10-27', 'behind', 'Why we build small'], ['2026-10-28', 'howto', 'One post, three channels'],
];

function post ( id: string, slotDate: string, pillar: string, title: string, status: Post['status'], time: string, channels: string[], extra: Partial<Post> = {} ): Post {
  return {
    id, pillar, title, body: '', imageBrief: '', channels, slotDate, originalSlotDate: slotDate, time, slotAt: iso( slotDate, time ),
    pinned: false, status, source: 'maya', movedBackDays: 0, ...extra,
  };
}

function seedPosts (): Post[] {
  const posts = TITLES.map( ( [date, pillar, title], i ) =>
    post( `m${ i }`, date, pillar, title, date < TODAY ? 'posted' : 'planned', ['09:00', '12:00', '16:00'][i % 3], ['linkedin', 'threads'] ) );
  posts.push(
    post( 'thu', '2026-10-08', 'howto', '3 signs your lead list is stale', 'needs_review', '16:00', ['linkedin', 'threads'], {
      body: 'Bounce rates over 8%. Contacts who changed jobs a year ago. Companies that closed. If two of these sound familiar, your list is costing you calls. Here’s how to check yours in 15 minutes.',
      autoApproveAt: iso( '2026-10-08', '15:00' ),
      image: { source: 'maya', status: 'ready', brief: 'a lead list on a laptop, three rows flagged in pink', url: PLACEHOLDER( '#e3ecff' ) },
    } ),
    post( 'fri', '2026-10-09', 'proof', 'How Ridgeline HVAC booked 11 calls in a month', 'needs_review', '09:00', ['linkedin', 'facebook'], {
      body: 'Ridgeline HVAC is a 6-person shop in Austin. In September they used Lead Vault to find 40 property managers within 25 miles and booked 11 calls. Here’s the search they ran.',
      autoApproveAt: iso( '2026-10-08', '14:00' ), rewriteCount: 1, holdCount: 1,
      image: { source: 'user', status: 'ready', brief: 'the Ridgeline team beside a service van', fileName: 'ridgeline-van.jpg', width: 2400, height: 1600, url: PLACEHOLDER( '#fff4c2' ) },
    } ),
    post( 'sat', '2026-10-10', 'behind', 'Friday build review: what we shipped this week', 'on_hold', '12:00', ['instagram', 'threads'], { body: 'Three fixes and one new filter in Find. Here’s the short version, with the screenshots.', holdCount: 2, rewriteCount: 1,
      image: { source: 'maya', status: 'failed', brief: 'the team at a whiteboard', reason: 'generation_failed' } } ),
    post( 'sun', '2026-10-11', 'howto', 'What buyers search for before they call you', 'drafted', '09:00', ['linkedin', 'threads'], { body: 'Before a buyer calls, they search.', reviewOpensAt: iso( '2026-10-10', '18:00' ) } ),
    post( 'mon', '2026-10-12', 'product', 'Find: search 40,000 companies by capability', 'planned', '12:00', ['linkedin', 'facebook', 'google_business_profile'] ),
    post( 'tue', '2026-10-13', 'product', 'Webinar today at 1 PM: fill your pipeline in 30 days', 'planned', '08:00', Object.keys( CHANNELS ), { pinned: true } ),
    post( 'wed', '2026-10-14', 'proof', 'Before and after: a cleaned-up lead list', 'planned', '16:00', ['linkedin', 'facebook'] ),
  );
  // Exceptions (gaps 2n, 2o): yesterday's post failed on Facebook; a pinned post expired.
  const yesterday = posts.find( ( item ) => item.slotDate === '2026-10-07' )!;
  Object.assign( yesterday, {
    title: 'How Ridgeline HVAC booked 11 calls in a month', pillar: 'proof', time: '09:00', slotAt: iso( '2026-10-07', '09:00' ),
    channels: ['linkedin', 'threads', 'facebook'],
    body: 'Ridgeline HVAC is a 6-person shop in Austin. In September they used Lead Vault to find 40 property managers.',
    channelResults: [
      { channel: 'linkedin', status: 'posted', url: 'https://www.linkedin.com/feed/', postedAt: iso( '2026-10-07', '09:00' ) },
      { channel: 'threads', status: 'posted', url: 'https://www.threads.net/', postedAt: iso( '2026-10-07', '09:00' ) },
      { channel: 'facebook', status: 'failed', reason: 'account_reauth_required', error: 'Facebook signed us out.', retries: 3 },
    ],
  } );
  // Gaps 2h: the owner's approved post that stopped fitting after a strategy change.
  posts.push( post( 'u1', '2026-10-22', 'product', 'TODD now syncs with Lead Vault', 'approved', '09:00', ['linkedin', 'facebook'], {
    source: 'user', approvedAt: '2026-10-06T15:00:00.000Z',
    body: 'Your TODD list now pulls in new Lead Vault leads automatically, sorted by how much they could be worth.',
    offStrategy: true, offStrategyNote: 'TODD isn’t in your profile anymore.',
    offStrategyEdit: { title: 'Lead Vault Match ranks your new leads', body: 'Lead Vault Match now ranks your new leads by fit, so the best ones are at the top of your list each morning.', pillar: 'product' },
  } ) );
  const expired = posts.find( ( item ) => item.slotDate === '2026-10-06' )!;
  Object.assign( expired, { status: 'expired', pinned: true, time: '08:00', slotAt: iso( '2026-10-06', '08:00' ), title: 'Webinar replay: fill your pipeline in 30 days' } );
  return posts.sort( ( a, b ) => a.slotDate.localeCompare( b.slotDate ) );
}

/** Design 2g's example: a product swapped. */
const SAMPLE_CHANGE: StrategyChange = {
  at: '2026-10-09T15:00:00.000Z',
  headline: 'You swapped a product. Here’s how I’d adjust the strategy.',
  profileChanges: [
    { kind: 'added', field: 'product', name: 'Lead Vault Match', detail: 'AI picks your best-fit leads' },
    { kind: 'removed', field: 'product', name: 'TODD', detail: 'A to-do list sorted by revenue impact' },
  ],
  pillars: [
    { key: 'product', name: 'Product', tint: 'violet', from: 20, to: 25 },
    { key: 'proof', name: 'Proof', tint: 'green', from: 35, to: 30 },
  ],
  channels: [{ key: 'google_business_profile', name: 'Google Business', from: 1, to: 2 }],
  affectedPosts: [
    { id: 'm12', slotDate: '2026-10-19', title: 'TODD: your to-do list, sorted by revenue', pillar: 'product', source: 'maya', status: 'planned', action: 'replace', newTitle: 'Lead Vault Match: let the AI pick your best fit', note: '' },
    { id: 'm16', slotDate: '2026-10-21', title: 'Q3 pipeline from Lead Vault users', pillar: 'proof', source: 'maya', status: 'planned', action: 'replace', newTitle: 'How Match found Alder Dental 9 new leads', note: '' },
    { id: 'm15', slotDate: '2026-10-24', title: 'A day in Maya’s queue', pillar: 'behind', source: 'maya', status: 'planned', action: 'rewrite', newTitle: '', note: 'Rewritten to drop the TODD mention' },
    { id: 'u1', slotDate: '2026-10-22', title: 'TODD now syncs with Lead Vault', pillar: 'product', source: 'user', status: 'approved', action: 'off_strategy', newTitle: '', note: 'TODD isn’t in your profile anymore.' },
  ],
};

function channelStatus ( name: string ): ChannelState[] {
  const none = name === 'nochannels';
  const row = ( key: keyof typeof CHANNELS, status: ChannelState['status'], account = '', signedOutAt: string | null = null ): ChannelState =>
    ( { key, name: CHANNELS[key], status: none ? 'not_connected' : status, account: none ? '' : account, signedOutAt } );
  return [
    row( 'linkedin', 'connected', 'Taliferro Tech page' ),
    row( 'threads', 'connected', '@taliferrotech' ),
    row( 'facebook', 'needs_reconnect', 'Taliferro Tech page', '2026-10-07T14:00:00.000Z' ),
    row( 'instagram', 'not_connected' ),
    row( 'google_business_profile', 'connected', 'Taliferro Tech, Austin' ),
  ];
}

function seedOverview ( name: string ): Overview {
  const complete = name !== 'incomplete';
  return {
    entitled: name !== 'nomaya',
    onboardedAt: name === 'first' ? null : '2026-10-01T15:00:00.000Z',
    autoApproveHours: 6,
    notifyPush: true,
    notifyEmail: true,
    timeZone: 'America/Chicago',
    today: TODAY,
    profile: {
      email: 'dana@taliferro.tech', firstName: 'Dana', lastName: '', companyName: 'Taliferro Tech',
      companyGoal: complete ? 'Book 20 discovery calls a month with small and mid-size businesses that need better lead lists.' : '',
      companyDescription: '', timezone: 'America/Chicago',
      products: complete ? [
        { id: 'p1', name: 'Lead Vault', description: 'Search and unlock company leads by capability and location' },
        { id: 'p2', name: 'Find', description: 'Company search across 40,000 businesses' },
        { id: 'p3', name: 'TODD', description: 'A to-do list sorted by revenue impact' },
      ] : [],
      audience: 'Owners of 5–50 person B2B firms', location: 'Austin, TX', website: 'taliferro.com', tones: ['Plain', 'Confident'],
    },
    missing: complete ? [] : ['companyGoal', 'products'],
    strategy: ['ready', 'nochannels', 'change'].includes( name ) ? STRATEGY : null,
    pendingStrategy: null,
    pendingChange: null,
    plannedThrough: ['ready', 'nochannels', 'change'].includes( name ) ? '2026-10-28' : null,
    nextPlanDate: ['ready', 'nochannels', 'change'].includes( name ) ? '2026-10-25' : null,
    connectedChannels: name === 'nochannels' ? [] : ['linkedin', 'threads', 'google_business_profile'],
    channelStatus: channelStatus( name ),
    publishingPaused: name === 'nochannels',
    channels: CHANNELS,
  };
}

class MockServer {
  overview: Overview;
  posts: Post[];

  constructor ( name: string ) {
    this.overview = seedOverview( name );
    this.posts = ['ready', 'nochannels', 'change'].includes( name ) ? seedPosts() : [];
    if ( name === 'change' ) {
      this.overview = { ...this.overview, pendingStrategy: { ...STRATEGY, reason: 'profile_changed', builtAt: SAMPLE_CHANGE.at }, pendingChange: SAMPLE_CHANGE };
    }
  }

  handle ( req: HttpRequest<unknown> ): Observable<HttpEvent<unknown>> | null {
    if ( req.url.endsWith( '/public/maya-social/act' ) ) {
      const token = String( ( req.body as { token?: string } )?.token || '' );
      const [action] = token.split( ':' );
      const result = action === 'approve' ? { result: 'approved', title: '3 signs your lead list is stale', slotLabel: 'Today at 4:00 PM', undo: 'undo:thu' }
        : action === 'hold' ? { result: 'held', title: '3 signs your lead list is stale', slotLabel: 'Today at 4:00 PM', rewriteBy: '11:00 AM', undo: 'undo:thu' }
        : action === 'undo' ? { result: 'undone', title: '3 signs your lead list is stale', slotLabel: 'Today at 4:00 PM' }
        : { result: action || 'invalid' };
      return of( new HttpResponse( { status: 200, body: { success: true, data: result } } ) ).pipe( delay( 300 ) );
    }
    const path = req.url.replace( /^.*\/maya-social/, '' );
    if ( path === req.url ) return null;
    const body = ( req.body || {} ) as Record<string, any>;
    const ok = ( data: unknown, ms = 250 ) => of( new HttpResponse( { status: 200, body: { success: true, data } } ) ).pipe( delay( ms ) );
    const fail = ( status: number, error: Record<string, unknown> ) => throwError( () => ( { status, error: { success: false, ...error } } ) );
    const find = ( id: string ) => this.posts.find( ( item ) => item.id === id )!;
    const save = ( next: Post ) => {
      this.posts = this.posts.map( ( item ) => ( item.id === next.id ? next : item ) );
      return next;
    };

    if ( path === '/overview' ) return ok( this.overview );
    if ( path === '/onboard' ) {
      this.overview = { ...this.overview, onboardedAt: new Date().toISOString(), autoApproveHours: body['autoApproveHours'] };
      return ok( this.overview );
    }
    if ( path === '/settings' ) return ok( this.overview = { ...this.overview, ...body } );
    if ( path === '/profile' ) {
      const profile = { ...this.overview.profile, ...body['profile'] };
      const missing = [!profile.companyName && 'companyName', !profile.companyGoal && 'companyGoal', !profile.products?.length && 'products'].filter( Boolean ) as Overview['missing'];
      const changed = !!this.overview.strategy;
      this.overview = {
        ...this.overview, profile, missing,
        pendingStrategy: changed ? { ...STRATEGY, pillars: STRATEGY.pillars.map( ( pillar ) => ( pillar.key === 'product' ? { ...pillar, share: 25 } : pillar.key === 'proof' ? { ...pillar, share: 30 } : pillar ) ), reason: 'profile_changed', builtAt: new Date().toISOString() } : null,
        pendingChange: changed ? SAMPLE_CHANGE : null,
      };
      return ok( this.overview, 600 );
    }
    if ( path === '/strategy/generate' ) {
      if ( this.overview.missing.length ) return fail( 422, { error: 'profile_incomplete', missing: this.overview.missing } );
      this.overview = { ...this.overview, pendingStrategy: { ...STRATEGY, builtAt: new Date().toISOString(), reason: 'requested' } };
      return ok( this.overview.pendingStrategy, 2500 );
    }
    if ( path === '/strategy/approve' ) {
      const { reason, ...strategy } = this.overview.pendingStrategy!;
      this.overview = { ...this.overview, strategy: { ...strategy, approvedAt: '2026-10-01T15:10:00.000Z' }, pendingStrategy: null, plannedThrough: '2026-10-28', nextPlanDate: '2026-10-25' };
      if ( !this.posts.length ) this.posts = seedPosts();
      return ok( this.overview, 1500 );
    }
    if ( path === '/strategy/pending' ) return ok( this.overview = { ...this.overview, pendingStrategy: null, pendingChange: null } );

    if ( path.startsWith( '/posts' ) && req.method === 'GET' ) {
      const from = req.params.get( 'from' ) || TODAY;
      const to = req.params.get( 'to' ) || TODAY;
      return ok( this.posts.filter( ( item ) => item.slotDate >= from && item.slotDate <= to ) );
    }
    if ( path === '/posts/check' || ( path === '/posts' && req.method === 'POST' ) ) {
      const text = String( body['body'] || '' );
      const blocked = /%|off\b|happy/i.test( text );
      const check: PostCheck = blocked ? {
        aligned: false, pillar: 'product',
        reasons: ['It’s a greeting, so it doesn’t fit any of your four pillars.', 'It offers 30% off. That discount isn’t in your profile.'],
        version: { title: 'Fall is when budgets reset', body: 'Fall is when budgets reset. If you’re planning Q1 outreach now, Lead Vault can build your list by capability and location in an afternoon. Here’s how teams are using it this month.' },
        slot: null, moved: [], placementError: null,
      } : {
        aligned: true, pillar: 'product', reasons: [], version: null,
        slot: body['pinned'] ? { slotDate: body['slotDate'], time: body['time'] } : { slotDate: '2026-10-12', time: '09:00' },
        moved: body['pinned'] ? [] : [{ id: 'mon', from: '2026-10-12', to: '2026-10-14', title: 'Find: search 40,000 companies by capability' }, { id: 'wed', from: '2026-10-14', to: '2026-10-15', title: 'Before and after: a cleaned-up lead list' }],
        placementError: null,
      };
      if ( path === '/posts/check' ) return ok( check, 900 );
      if ( !check.aligned ) return fail( 422, { error: 'not_aligned', check } );
      const created = post( `u${ Date.now() }`, check.slot!.slotDate, 'product', text.split( /[.!?]/ )[0].slice( 0, 70 ), 'approved', check.slot!.time, body['channels'], { body: text, source: 'user', pinned: !!body['pinned'] } );
      this.posts.push( created );
      return ok( { post: created, moved: check.moved } );
    }
    const offVerb = path.match( /^\/posts\/([^/]+)\/off-strategy\/(use-edit|keep)$/ );
    if ( offVerb ) {
      const current = find( offVerb[1] );
      if ( offVerb[2] === 'keep' ) return ok( save( { ...current, offStrategyKept: true } ) );
      const edit = current.offStrategyEdit!;
      return ok( save( { ...current, title: edit.title, body: edit.body, offStrategy: false, offStrategyEdit: null } ) );
    }
    const imageVerb = path.match( /^\/posts\/([^/]+)\/image\/(upload|maya|remake|brief|cancel)$/ );
    if ( imageVerb ) {
      const [, id, verb] = imageVerb;
      const current = find( id );
      const brief = body['brief'] ?? current.image?.brief ?? '';
      const image = verb === 'upload' ? { source: 'user' as const, status: 'ready' as const, brief, url: body['dataUrl'], fileName: body['fileName'], width: 2400, height: 1600 }
        : verb === 'cancel' ? { source: 'none' as const, status: 'failed' as const, brief, reason: 'cancelled' }
        : { source: 'maya' as const, status: 'ready' as const, brief, url: PLACEHOLDER( '#efe5ff' ) };
      return ok( save( { ...current, image } ), verb === 'upload' || verb === 'cancel' ? 400 : 2000 );
    }
    const channelVerb = path.match( /^\/posts\/([^/]+)\/channels\/([^/]+)\/(retry|skip)$/ );
    if ( channelVerb ) {
      const [, id, channel, verb] = channelVerb;
      const current = find( id );
      const channelResults = ( current.channelResults ?? [] ).map( ( row ) => ( row.channel === channel ? { channel, status: verb === 'retry' ? 'retrying' as const : 'skipped' as const } : row ) );
      return ok( save( { ...current, channelResults } ), 600 );
    }
    const channelOff = path.match( /^\/channels\/([^/]+)$/ );
    if ( channelOff && req.method === 'DELETE' ) {
      const key = channelOff[1];
      this.overview = {
        ...this.overview,
        connectedChannels: this.overview.connectedChannels.filter( ( item ) => item !== key ),
        channelStatus: this.overview.channelStatus.map( ( row ) => ( row.key === key ? { ...row, status: 'not_connected', account: '' } : row ) ),
      };
      return ok( this.overview );
    }
    const action = path.match( /^\/posts\/([^/]+)(?:\/([a-z-]+))?$/ );
    if ( action ) {
      const [, id, verb] = action;
      const current = find( id );
      if ( verb === 'approve' ) return ok( save( { ...current, status: 'approved', approvedBy: 'owner' } ) );
      if ( verb === 'title' ) return ok( save( { ...current, title: body['title'] } ) );
      if ( verb === 'drop' ) {
        save( { ...current, status: 'dropped' } );
        return ok( { moved: [] } );
      }
      if ( verb === 'unpin' ) return ok( { post: save( { ...current, pinned: false } ), moved: [] } );
      if ( verb === 'undo-approve' ) return ok( save( { ...current, status: 'needs_review' } ) );
      if ( verb === 'hold' ) {
        if ( current.holdCount ) return ok( save( { ...current, status: 'on_hold', holdCount: ( current.holdCount || 0 ) + 1 } ), 400 );
        return ok( save( { ...current, status: 'needs_review', holdCount: 1, rewriteCount: 1, title: `${ current.title } (rewrite)`, autoApproveAt: iso( current.slotDate, '08:00' ) } ), 2000 );
      }
      if ( !verb && req.method === 'PUT' ) {
        if ( /%/.test( body['body'] ) ) return fail( 422, { error: 'not_aligned', check: { aligned: false, pillar: current.pillar, reasons: ['That discount isn’t in your profile.'], version: { title: current.title, body: current.body }, slot: null, moved: [], placementError: null } } );
        return ok( save( { ...current, title: body['title'], body: body['body'], status: 'approved' } ), 900 );
      }
    }
    return null;
  }
}

function fakeAuth ( signedIn: boolean ): Partial<SocialAuthService> {
  const user = signedIn ? { uid: 'demo', email: 'dana@taliferro.tech', displayName: 'Dana' } : null;
  return {
    getUser: () => of( user as any ),
    isLoggedIn: () => of( signedIn ),
    getCurrentUserSync: () => user as any,
    getCurrentUserIdSync: () => user?.uid || '',
    getTenantIdSync: () => user?.uid || '',
    getTenantId: () => of( user?.uid || '' ),
    getUserId: () => of( user?.uid || '' ),
    signIn: () => { location.search = '?mock=ready'; },
    signOut: async () => { location.search = '?mock=out'; },
  };
}

/** Providers for app.config: the mock when ?mock is on, else the real HTTP stack. */
export function devProviders (): ( Provider | EnvironmentProviders )[] {
  const name = scenario();
  if ( !name ) return [provideHttpClient( withInterceptors( [idTokenInterceptor] ) )];
  const server = new MockServer( name );
  const mock: HttpInterceptorFn = ( req, next ) => server.handle( req ) ?? next( req );
  console.info( `[Maya Social] mock API: ${ name }` );
  return [
    provideHttpClient( withInterceptors( [mock] ) ),
    { provide: SocialAuthService, useValue: fakeAuth( name !== 'out' ) },
  ];
}

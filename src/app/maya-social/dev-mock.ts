/**
 * DEVELOPMENT ONLY - replaced by dev-mock.prod.ts in production builds
 * (angular.json fileReplacements). Open the app with ?mock=<scenario> on
 * localhost to run every screen against an in-memory API seeded with the
 * design's sample week (Thu, Oct 8, 2026):
 *
 *   ?mock=ready       strategy in place, two posts to review (1a, 1d-1f)
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
import type { Overview, Post, PostCheck, Strategy } from './api';

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
    } ),
    post( 'fri', '2026-10-09', 'proof', 'How Ridgeline HVAC booked 11 calls in a month', 'needs_review', '09:00', ['linkedin', 'facebook'], {
      body: 'Ridgeline HVAC is a 6-person shop in Austin. In September they used Lead Vault to find 40 property managers within 25 miles and booked 11 calls. Here’s the search they ran.',
      autoApproveAt: iso( '2026-10-08', '14:00' ), rewriteCount: 1, holdCount: 1,
    } ),
    post( 'sat', '2026-10-10', 'behind', 'Friday build review: what we shipped this week', 'drafted', '16:00', ['instagram', 'threads'], { body: 'Every Friday we show what shipped.', reviewOpensAt: iso( '2026-10-10', '09:00' ) } ),
    post( 'sun', '2026-10-11', 'howto', 'What buyers search for before they call you', 'drafted', '09:00', ['linkedin', 'threads'], { body: 'Before a buyer calls, they search.', reviewOpensAt: iso( '2026-10-10', '18:00' ) } ),
    post( 'mon', '2026-10-12', 'product', 'Find: search 40,000 companies by capability', 'planned', '12:00', ['linkedin', 'facebook', 'google_business_profile'] ),
    post( 'tue', '2026-10-13', 'product', 'Webinar today at 1 PM: fill your pipeline in 30 days', 'planned', '08:00', Object.keys( CHANNELS ), { pinned: true } ),
    post( 'wed', '2026-10-14', 'proof', 'Before and after: a cleaned-up lead list', 'planned', '16:00', ['linkedin', 'facebook'] ),
  );
  return posts.sort( ( a, b ) => a.slotDate.localeCompare( b.slotDate ) );
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
    strategy: name === 'ready' ? STRATEGY : null,
    pendingStrategy: null,
    plannedThrough: name === 'ready' ? '2026-10-28' : null,
    nextPlanDate: name === 'ready' ? '2026-10-25' : null,
    connectedChannels: ['linkedin', 'threads', 'facebook', 'instagram'],
    channels: CHANNELS,
  };
}

class MockServer {
  overview: Overview;
  posts: Post[];

  constructor ( name: string ) {
    this.overview = seedOverview( name );
    this.posts = name === 'ready' ? seedPosts() : [];
  }

  handle ( req: HttpRequest<unknown> ): Observable<HttpEvent<unknown>> | null {
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
      this.overview = { ...this.overview, profile, missing, pendingStrategy: this.overview.strategy ? { ...STRATEGY, reason: 'profile_changed', builtAt: new Date().toISOString() } : null };
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
    if ( path === '/strategy/pending' ) return ok( this.overview = { ...this.overview, pendingStrategy: null } );

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
    const action = path.match( /^\/posts\/([^/]+)(?:\/([a-z-]+))?$/ );
    if ( action ) {
      const [, id, verb] = action;
      const current = find( id );
      if ( verb === 'approve' ) return ok( save( { ...current, status: 'approved', approvedBy: 'owner' } ) );
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

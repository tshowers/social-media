import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../environments/environment';
import { SocialAuthService } from '../services/social-auth.service';

/** The backend's Maya Social API (todd-backend/functions/mayaSocial/routes.js). */

export type AutoApproveHours = 2 | 4 | 6;
export type PostStatus = 'planned' | 'drafted' | 'needs_review' | 'approved' | 'on_hold' | 'posted' | 'expired' | 'dropped' | 'paused';
export type Tint = 'green' | 'blue' | 'violet' | 'yellow';
export type RequiredField = 'companyName' | 'companyGoal' | 'products';

export interface Product { id?: string; name: string; description: string; priceLabel?: string; }

export interface Profile {
  email: string;
  firstName: string;
  lastName: string;
  companyName: string;
  companyGoal: string;
  companyDescription: string;
  timezone: string;
  products: Product[];
  audience: string;
  location: string;
  website: string;
  tones: string[];
}

export interface Pillar { key: string; name: string; share: number; description: string; maxOneIn: number; tint: Tint; }
export interface Channel { key: string; name: string; role: string; perWeek: number; }

export interface Strategy {
  goal: string;
  pillars: Pillar[];
  channels: Channel[];
  autoApproveHours: AutoApproveHours;
  builtAt: string;
  approvedAt?: string;
  reason?: 'requested' | 'profile_changed';
}

export interface Overview {
  entitled: boolean;
  onboardedAt?: string | null;
  autoApproveHours: AutoApproveHours;
  notifyPush: boolean;
  notifyEmail: boolean;
  timeZone: string;
  today: string;
  profile: Profile;
  missing: RequiredField[];
  strategy: Strategy | null;
  pendingStrategy: Strategy | null;
  /** What a proposed change does (gaps 2g); null for a plain regenerate. */
  pendingChange: StrategyChange | null;
  plannedThrough: string | null;
  nextPlanDate: string | null;
  connectedChannels: string[];
  /** Every channel and where it stands (gaps 2b). */
  channelStatus: ChannelState[];
  /** No strategy channel connected: publishing and auto-approve pause (2c). */
  publishingPaused: boolean;
  channels: Record<string, string>;
}

/** Social settings (gaps 2m): Maya Social only, not the Taliferro profile. */
export interface SocialSettings { autoApproveHours?: AutoApproveHours; notifyPush?: boolean; notifyEmail?: boolean; }

export interface ChannelState { key: string; name: string; status: 'connected' | 'needs_reconnect' | 'not_connected'; account: string; signedOutAt: string | null; }

export interface StrategyChange {
  at: string;
  headline: string;
  profileChanges: { kind: 'added' | 'removed' | 'changed'; field: string; name: string; detail: string }[];
  pillars: { key: string; name: string; tint?: Tint; from: number; to: number }[];
  channels: { key: string; name: string; from: number; to: number }[];
  affectedPosts: { id: string; slotDate: string; title: string; pillar: string; source: string; status: PostStatus; action: 'replace' | 'rewrite' | 'off_strategy'; newTitle: string; note: string }[];
}

/** A post's image (gaps 2l). */
export interface PostImage { source: 'maya' | 'user' | 'none'; status: 'pending' | 'making' | 'ready' | 'failed'; url?: string; brief: string; fileName?: string; width?: number; height?: number; reason?: string; }

/** One channel of a post that went out (gaps 2n). */
export interface ChannelResult { channel: string; status: 'queued' | 'retrying' | 'posted' | 'failed' | 'skipped'; url?: string; postedAt?: string | null; reason?: string; error?: string; retries?: number; }

export interface Post {
  id: string;
  pillar: string;
  title: string;
  body: string;
  imageBrief: string;
  channels: string[];
  slotDate: string;
  originalSlotDate: string;
  time: string;
  slotAt: string;
  pinned: boolean;
  status: PostStatus;
  source: 'maya' | 'user';
  autoApproveAt?: string;
  reviewOpensAt?: string;
  approvedBy?: 'owner' | 'auto';
  holdCount?: number;
  rewriteCount?: number;
  channelResults?: ChannelResult[];
  image?: PostImage;
  mayaImage?: PostImage;
  /** Gaps 2h: no longer fits after an approved strategy change. */
  offStrategy?: boolean;
  offStrategyKept?: boolean;
  offStrategyNote?: string;
  offStrategyEdit?: { title: string; body: string; pillar?: string } | null;
  approvedAt?: string;
  movedBackDays: number;
}

/** A one-tap link's outcome (gaps 2t). */
export interface OneTapResult {
  result: 'approved' | 'held' | 'undone' | 'already_out' | 'used' | 'expired' | 'invalid' | 'error';
  title?: string;
  slotLabel?: string;
  rewriteBy?: string | null;
  undo?: string | null;
}

export interface Move { id: string; from: string; to: string; title?: string; }

export interface PostCheck {
  aligned: boolean;
  pillar: string;
  reasons: string[];
  version: { title: string; body: string } | null;
  slot: { slotDate: string; time: string } | null;
  moved: Move[];
  placementError: string | null;
}

export interface NewPost { title?: string; body: string; channels: string[]; pinned: boolean; slotDate?: string; time?: string; }

interface Envelope<T> { success: boolean; data: T; }

/** An API error body: `error` is the code, plus whatever the code carries. */
export interface ApiError { error?: string; message?: string; missing?: RequiredField[]; check?: PostCheck; }

export function apiError ( response: unknown ): ApiError {
  const body = ( response as { error?: ApiError } )?.error;
  return body && typeof body === 'object' ? body : { message: 'Something went wrong. Try again.' };
}

@Injectable( { providedIn: 'root' } )
export class MayaSocialApi {
  private readonly http = inject( HttpClient );
  private readonly auth = inject( SocialAuthService );
  private readonly base = `${ environment.backendURL }/maya-social`;

  private unwrap<T> ( request: Observable<Envelope<T>> ): Observable<T> {
    return request.pipe( map( ( response ) => response.data ) );
  }

  overview (): Observable<Overview> { return this.unwrap( this.http.get<Envelope<Overview>>( `${ this.base }/overview` ) ); }
  onboard ( autoApproveHours: AutoApproveHours ): Observable<Overview> { return this.unwrap( this.http.post<Envelope<Overview>>( `${ this.base }/onboard`, { autoApproveHours } ) ); }
  updateSettings ( settings: SocialSettings ): Observable<Overview> { return this.unwrap( this.http.put<Envelope<Overview>>( `${ this.base }/settings`, settings ) ); }
  saveProfile ( profile: Partial<Profile> ): Observable<Overview> { return this.unwrap( this.http.patch<Envelope<Overview>>( `${ this.base }/profile`, { profile } ) ); }

  generateStrategy (): Observable<Strategy> { return this.unwrap( this.http.post<Envelope<Strategy>>( `${ this.base }/strategy/generate`, {} ) ); }
  approveStrategy (): Observable<Overview> { return this.unwrap( this.http.post<Envelope<Overview>>( `${ this.base }/strategy/approve`, {} ) ); }
  discardPendingStrategy (): Observable<Overview> { return this.unwrap( this.http.delete<Envelope<Overview>>( `${ this.base }/strategy/pending` ) ); }

  posts ( from: string, to: string ): Observable<Post[]> { return this.unwrap( this.http.get<Envelope<Post[]>>( `${ this.base }/posts`, { params: { from, to } } ) ); }
  check ( post: NewPost ): Observable<PostCheck> { return this.unwrap( this.http.post<Envelope<PostCheck>>( `${ this.base }/posts/check`, post ) ); }
  create ( post: NewPost ): Observable<{ post: Post; moved: Move[] }> { return this.unwrap( this.http.post<Envelope<{ post: Post; moved: Move[] }>>( `${ this.base }/posts`, post ) ); }
  edit ( id: string, edit: { title: string; body: string } ): Observable<Post> { return this.unwrap( this.http.put<Envelope<Post>>( `${ this.base }/posts/${ encodeURIComponent( id ) }`, edit ) ); }
  approve ( id: string ): Observable<Post> { return this.unwrap( this.http.post<Envelope<Post>>( `${ this.base }/posts/${ encodeURIComponent( id ) }/approve`, {} ) ); }
  undoApprove ( id: string ): Observable<Post> { return this.unwrap( this.http.post<Envelope<Post>>( `${ this.base }/posts/${ encodeURIComponent( id ) }/undo-approve`, {} ) ); }
  editTitle ( id: string, title: string ): Observable<Post> { return this.unwrap( this.http.put<Envelope<Post>>( `${ this.base }/posts/${ encodeURIComponent( id ) }/title`, { title } ) ); }
  drop ( id: string ): Observable<{ moved: Move[] }> { return this.unwrap( this.http.post<Envelope<{ moved: Move[] }>>( `${ this.base }/posts/${ encodeURIComponent( id ) }/drop`, {} ) ); }
  unpin ( id: string ): Observable<{ post: Post; moved: Move[] }> { return this.unwrap( this.http.post<Envelope<{ post: Post; moved: Move[] }>>( `${ this.base }/posts/${ encodeURIComponent( id ) }/unpin`, {} ) ); }
  channelAction ( id: string, channel: string, action: 'retry' | 'skip' ): Observable<Post> { return this.unwrap( this.http.post<Envelope<Post>>( `${ this.base }/posts/${ encodeURIComponent( id ) }/channels/${ encodeURIComponent( channel ) }/${ action }`, {} ) ); }
  disconnect ( channel: string ): Observable<Overview> { return this.unwrap( this.http.delete<Envelope<Overview>>( `${ this.base }/channels/${ encodeURIComponent( channel ) }` ) ); }
  imageAction ( id: string, action: 'upload' | 'maya' | 'remake' | 'brief' | 'cancel', body: { dataUrl?: string; fileName?: string; brief?: string } = {} ): Observable<Post> {
    return this.unwrap( this.http.post<Envelope<Post>>( `${ this.base }/posts/${ encodeURIComponent( id ) }/image/${ action }`, body ) );
  }
  offStrategy ( id: string, action: 'use-edit' | 'keep' ): Observable<Post> { return this.unwrap( this.http.post<Envelope<Post>>( `${ this.base }/posts/${ encodeURIComponent( id ) }/off-strategy/${ action }`, {} ) ); }
  /** Public: the signed link is the permission. */
  oneTap ( token: string ): Observable<OneTapResult> { return this.unwrap( this.http.post<Envelope<OneTapResult>>( `${ environment.backendURL }/public/maya-social/act`, { token } ) ); }
  hold ( id: string ): Observable<Post> { return this.unwrap( this.http.post<Envelope<Post>>( `${ this.base }/posts/${ encodeURIComponent( id ) }/hold`, {} ) ); }

  /** Starts a channel's OAuth (the existing Social accounts flow); resolves to the provider's sign-in URL. */
  connectChannel ( channel: string, returnUrl: string ): Observable<string> {
    const provider = channel === 'google_business_profile' ? 'google' : channel;
    const payload = channel === 'google_business_profile'
      ? { frontendReturnUrl: returnUrl, destination: channel, destinationType: channel, youtubeEnabled: false }
      : { frontendReturnUrl: returnUrl };
    // This older route reads who's calling from headers (checked against the token).
    const user = this.auth.getCurrentUserSync();
    const headers = new HttpHeaders( {
      'x-tenant-id': this.auth.getTenantIdSync() || user?.uid || '',
      'x-user-id': user?.uid || '',
      'x-user-email': user?.email || '',
    } );
    return this.http
      .post<{ data?: { authorizationUrl?: string } }>( `${ environment.backendURL }/outreach/social-auth/${ encodeURIComponent( provider ) }/start`, payload, { headers } )
      .pipe( map( ( response ) => response?.data?.authorizationUrl || '' ) );
  }
}

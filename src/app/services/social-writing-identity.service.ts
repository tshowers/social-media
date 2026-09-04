import { Injectable, inject } from '@angular/core';
import { Observable, from, map, switchMap, tap } from 'rxjs';

import { SocialAuthService } from './social-auth.service';
import { SocialDataService } from './social-data.service';
import { ToddWritingIdentity, ToddWritingIdentityReview, ToddWritingIdentityState } from '../models/todd-writing-identity.model';

/**
 * Minimal slice of TODD's Contact model this service actually reads/writes -
 * decoupled from any broader Contact type since nothing else in Social
 * needs one (SocialPost etc. never reference a contact). Field names match
 * frontend/src/app/shared/data/interfaces/contact.model.ts exactly, so the
 * inference logic below (copied from ToddWritingIdentityService) doesn't
 * need to change.
 */
export interface WritingIdentityContact {
  id?: string;
  tenantId?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  profession?: string;
  jobDescriptionForTODD?: string;
  status?: string;
  toddWritingIdentity?: ToddWritingIdentity | null;
  company?: {
    name?: string;
    description?: string;
    valueProp?: string;
    goal?: string;
    capabilities?: string[];
    keyFeatures?: string[];
  };
}

type ToddIdentityValidationResult = {
  personLabel: string;
  professionLabel: string;
  companyName: string;
  whatTheyDo: string;
  howTheyMakeMoney: string;
  foundFields: string[];
  missingFields: string[];
  evaluatedPaths: string[];
  inferredFrom: string[];
  profileCompleteEnough: boolean;
  skipWarning: boolean;
};

/**
 * Trimmed port of TODD's ToddWritingIdentityService
 * (frontend/src/app/services/todd-writing-identity.service.ts) - the
 * inference algorithm (buildIdentity/reviewDraft/validateProfileCompleteness
 * and every private helper below) is pure logic with no backend calls, so
 * it's copied verbatim. The only thing rebuilt is *where the contact comes
 * from*: the original reads it through UserService.getLoggedInContactInfo(),
 * a big shared service this app doesn't have. That method's own multi-tenant
 * path (getTenantLoggedInContactInfo) resolves to exactly
 * `findTenantContactById(tenantId, user.uid)` - i.e. the signed-in user's
 * own contact record, stored at `tenants/{tenantId}/contacts/{uid}` - which
 * is exactly what SocialDataService.getContact already does, so that's used
 * here directly instead.
 */
@Injectable( { providedIn: 'root' } )
export class SocialWritingIdentityService {
  private readonly authService = inject( SocialAuthService );
  private readonly dataService = inject( SocialDataService );

  loadIdentityState (): Observable<ToddWritingIdentityState> {
    return this.loadOwnContact().pipe(
      map( contact => this.buildIdentityState( contact ) ),
      tap( state => this.persistIdentityIfNeeded( state.identity ) ),
    );
  }

  private loadOwnContact (): Observable<WritingIdentityContact | null> {
    return this.authService.getUserId().pipe(
      switchMap( uid => {
        if ( !uid ) return from( Promise.resolve( null ) );
        return from(
          this.authService.getTenantId().toPromise().then( tenantId =>
            tenantId ? this.dataService.getContact( tenantId, uid ) : null
          )
        );
      } ),
    );
  }

  buildIdentityState ( contact: WritingIdentityContact | null ): ToddWritingIdentityState {
    const identity = this.resolveIdentity( contact );
    return {
      identity,
      reviewDraft: ( draft: string ) => this.reviewDraft( draft, identity )
    };
  }

  private resolveIdentity ( contact: WritingIdentityContact | null ): ToddWritingIdentity {
    const persisted = this.normalizeStoredIdentity( contact?.toddWritingIdentity || null );
    if ( persisted && persisted.profileCompleteEnough && !String( persisted.warningMessage || '' ).trim() ) {
      return persisted;
    }
    return this.buildIdentity( contact );
  }

  buildIdentity ( contact: WritingIdentityContact | null ): ToddWritingIdentity {
    const source = contact || {} as WritingIdentityContact;
    const validation = this.validateProfileCompleteness( source );
    const whoTheyAre = this.firstNonEmpty(
      validation.personLabel,
      validation.professionLabel,
      source.jobDescriptionForTODD,
      source.status
    );
    const whatTheyDo = validation.whatTheyDo;
    const howTheyMakeMoney = validation.howTheyMakeMoney;
    const primaryContentLane = this.inferPrimaryLane( source );
    const secondaryThemes = this.inferSecondaryThemes( source );
    const likelyAudience = this.inferAudience( source, primaryContentLane );
    const voiceProfile = this.inferVoiceProfile( source, primaryContentLane );
    const shouldSkipWarning =
      validation.skipWarning || validation.profileCompleteEnough;
    const warningDetails = shouldSkipWarning
      ? []
      : this.buildWarningDetails( validation );
    const confidence = validation.profileCompleteEnough
      ? ( validation.inferredFrom.length >= 6 ? 'high' : 'medium' )
      : ( validation.inferredFrom.length >= 4 ? 'medium' : 'low' );

    return {
      identitySummary: this.buildIdentitySummary( source, {
        whoTheyAre,
        whatTheyDo,
        howTheyMakeMoney,
        likelyAudience,
        primaryContentLane
      } ),
      whoTheyAre: whoTheyAre || 'Business owner or operator',
      whatTheyDo: whatTheyDo || 'Delivers work tied to the current company profile.',
      howTheyMakeMoney: howTheyMakeMoney || 'Revenue model needs clarification from the user profile.',
      likelyAudience,
      primaryContentLane,
      secondaryThemes,
      voiceProfile,
      confidence,
      warningMessage: shouldSkipWarning
        ? ''
        : this.buildWarningMessage( warningDetails ),
      warningDetails,
      validationDebug: {
        foundFields: validation.foundFields,
        missingFields: validation.missingFields,
        evaluatedPaths: validation.evaluatedPaths
      },
      inferredFrom: validation.inferredFrom,
      profileCompleteEnough: validation.profileCompleteEnough,
      lastDerivedAt: new Date().toISOString()
    };
  }

  reviewDraft ( draft: string, identity: ToddWritingIdentity ): ToddWritingIdentityReview {
    const normalized = String( draft || '' ).trim().toLowerCase();
    const warnings: string[] = [];
    const laneTerms = [
      identity.primaryContentLane,
      ...identity.secondaryThemes,
      identity.whatTheyDo,
      identity.howTheyMakeMoney
    ]
      .join( ' ' )
      .toLowerCase()
      .split( /[^a-z0-9]+/ )
      .filter( term => term.length >= 4 );
    const laneMatchCount = Array.from( new Set( laneTerms ) )
      .slice( 0, 12 )
      .filter( term => normalized.includes( term ) )
      .length;
    const matchesLane = laneMatchCount >= 1 || /client|customer|buyer|team|operator|system|workflow|campaign|service|offer/.test( normalized );
    if ( !matchesLane ) {
      warnings.push( 'Draft may be drifting away from the user’s primary lane.' );
    }

    const shortSentences = normalized.split( /[.!?]\s+/ ).filter( Boolean ).length <= 5;
    const voiceGuidance = identity.voiceProfile.guidance.join( ' ' ).toLowerCase();
    const soundsDirect = shortSentences || /i\b|we\b|most people|one thing|here'?s/.test( normalized );
    const matchesVoice = soundsDirect || /direct|clear|practical|observational/.test( voiceGuidance );
    if ( !matchesVoice ) {
      warnings.push( 'Draft tone may not match the current voice profile.' );
    }

    const score = Math.max( 0, Math.min( 100, 40 + ( matchesLane ? 35 : 0 ) + ( matchesVoice ? 25 : 0 ) - ( warnings.length * 10 ) ) );
    return {
      matchesLane,
      matchesVoice,
      score,
      warnings,
      summary: warnings.length
        ? warnings.join( ' ' )
        : `Draft aligns with the ${identity.primaryContentLane.toLowerCase()} lane and ${identity.voiceProfile.style.toLowerCase()} voice profile.`
    };
  }

  private persistIdentityIfNeeded ( identity: ToddWritingIdentity ): void {
    this.loadOwnContact().subscribe( contact => {
      if ( !contact?.id || !contact?.tenantId ) return;
      const existing = contact.toddWritingIdentity;
      const nextSerialized = JSON.stringify( identity );
      const existingSerialized = JSON.stringify( existing || null );
      if ( nextSerialized === existingSerialized ) return;

      this.dataService.updateContact( contact.tenantId, contact.id, { toddWritingIdentity: identity } ).catch( () => void 0 );
    } );
  }

  private normalizeStoredIdentity ( value: ToddWritingIdentity | null ): ToddWritingIdentity | null {
    if ( !value ) return null;
    return {
      identitySummary: String( value.identitySummary || '' ).trim(),
      whoTheyAre: String( value.whoTheyAre || '' ).trim(),
      whatTheyDo: String( value.whatTheyDo || '' ).trim(),
      howTheyMakeMoney: String( value.howTheyMakeMoney || '' ).trim(),
      likelyAudience: String( value.likelyAudience || '' ).trim(),
      primaryContentLane: String( value.primaryContentLane || '' ).trim(),
      secondaryThemes: Array.isArray( value.secondaryThemes ) ? value.secondaryThemes.map( item => String( item || '' ).trim() ).filter( Boolean ) : [],
      voiceProfile: {
        style: String( value.voiceProfile?.style || '' ).trim(),
        tone: String( value.voiceProfile?.tone || '' ).trim(),
        guidance: Array.isArray( value.voiceProfile?.guidance ) ? value.voiceProfile.guidance.map( item => String( item || '' ).trim() ).filter( Boolean ) : []
      },
      confidence: value.confidence === 'high' || value.confidence === 'medium' || value.confidence === 'low' ? value.confidence : 'low',
      warningMessage: String( value.warningMessage || '' ).trim(),
      warningDetails: Array.isArray( value.warningDetails ) ? value.warningDetails.map( item => String( item || '' ).trim() ).filter( Boolean ) : [],
      validationDebug: {
        foundFields: Array.isArray( value.validationDebug?.foundFields ) ? value.validationDebug!.foundFields.map( item => String( item || '' ).trim() ).filter( Boolean ) : [],
        missingFields: Array.isArray( value.validationDebug?.missingFields ) ? value.validationDebug!.missingFields.map( item => String( item || '' ).trim() ).filter( Boolean ) : [],
        evaluatedPaths: Array.isArray( value.validationDebug?.evaluatedPaths ) ? value.validationDebug!.evaluatedPaths.map( item => String( item || '' ).trim() ).filter( Boolean ) : []
      },
      inferredFrom: Array.isArray( value.inferredFrom ) ? value.inferredFrom.map( item => String( item || '' ).trim() ).filter( Boolean ) : [],
      profileCompleteEnough: value.profileCompleteEnough === true,
      lastDerivedAt: String( value.lastDerivedAt || '' ).trim()
    };
  }

  private buildIdentitySummary (
    contact: WritingIdentityContact,
    details: {
      whoTheyAre: string;
      whatTheyDo: string;
      howTheyMakeMoney: string;
      likelyAudience: string;
      primaryContentLane: string;
    }
  ): string {
    const companyName = String( contact?.company?.name || '' ).trim();
    const prefix = companyName
      ? `${details.whoTheyAre} at ${companyName}`
      : details.whoTheyAre;
    return `${prefix}. They make money by ${details.howTheyMakeMoney.charAt( 0 ).toLowerCase() + details.howTheyMakeMoney.slice( 1 )} and should mainly publish in the ${details.primaryContentLane.toLowerCase()} lane for ${details.likelyAudience.toLowerCase()}.`;
  }

  private buildWarningDetails ( validation: ToddIdentityValidationResult ): string[] {
    return validation.missingFields.map( field => {
      if ( field === 'name' ) {
        return 'who you are is unclear because your name and company identity are both missing';
      }
      if ( field === 'profession' ) {
        return 'profession is unclear because `profession`, `title`, and `jobDescriptionForTODD` did not provide a usable role';
      }
      if ( field === 'company.name' ) {
        return 'company name is missing';
      }
      if ( field === 'offer.clarity' ) {
        return 'how you make money is unclear because `company.valueProp`, `company.description`, `company.keyFeatures`, and `jobDescriptionForTODD` do not explain the offer clearly enough';
      }
      if ( field === 'whatTheyDo' ) {
        return 'what you do is unclear because `jobDescriptionForTODD`, `company.description`, `company.valueProp`, and `company.keyFeatures` are empty';
      }
      if ( field === 'profile.depth' ) {
        return 'TODD only found a small amount of profile data to infer your lane and voice';
      }
      return field;
    } );
  }

  private buildWarningMessage ( warningDetails: string[] ): string {
    if ( !warningDetails.length ) {
      return 'TODD needs a stronger profile before it can confidently match your lane and voice.';
    }

    return `TODD is still missing enough detail to confidently match your lane and voice: ${warningDetails.join( '; ' )}.`;
  }

  private inferPrimaryLane ( contact: WritingIdentityContact ): string {
    const rawProfile = [
      contact?.displayName,
      this.fullName( contact ),
      contact?.profession,
      contact?.jobDescriptionForTODD,
      contact?.company?.description,
      contact?.company?.valueProp,
      ...( Array.isArray( contact?.company?.capabilities ) ? contact?.company?.capabilities : [] ),
      ...( Array.isArray( contact?.company?.keyFeatures ) ? contact?.company?.keyFeatures : [] )
    ].filter( Boolean ).join( ' ' ).toLowerCase();

    if ( /integration|api|automation|developer|software|engineering|technical|cloud|system|workflow/.test( rawProfile ) ) {
      return 'Operational insight';
    }
    if ( /marketing|content|branding|copy|creative|social|campaign/.test( rawProfile ) ) {
      return 'Market visibility';
    }
    if ( /consult|advisor|strategy|fractional|coach/.test( rawProfile ) ) {
      return 'Advisory perspective';
    }
    if ( /sales|pipeline|lead|client|revenue/.test( rawProfile ) ) {
      return 'Commercial execution';
    }
    return 'Founder perspective';
  }

  private inferSecondaryThemes ( contact: WritingIdentityContact ): string[] {
    const items = [
      contact?.company?.goal,
      contact?.company?.valueProp,
      contact?.company?.description,
      contact?.jobDescriptionForTODD,
      ...( Array.isArray( contact?.company?.capabilities ) ? contact?.company?.capabilities : [] ),
      ...( Array.isArray( contact?.company?.keyFeatures ) ? contact?.company?.keyFeatures : [] )
    ]
      .map( value => String( value || '' ).trim() )
      .filter( Boolean );

    return Array.from( new Set( items ) ).slice( 0, 5 );
  }

  private inferAudience ( contact: WritingIdentityContact, primaryLane: string ): string {
    const companyGoal = String( contact?.company?.goal || '' ).trim();
    if ( companyGoal ) return companyGoal;
    if ( primaryLane === 'Operational insight' ) return 'operators, technical buyers, and teams with process pain';
    if ( primaryLane === 'Market visibility' ) return 'buyers who need clearer positioning and stronger demand capture';
    if ( primaryLane === 'Advisory perspective' ) return 'decision makers who need faster clarity';
    if ( primaryLane === 'Commercial execution' ) return 'buyers and partners who care about growth and revenue motion';
    return 'people most likely to buy the current offer';
  }

  private inferVoiceProfile ( contact: WritingIdentityContact, primaryLane: string ) {
    const raw = [
      contact?.profession,
      contact?.jobDescriptionForTODD,
      contact?.company?.description,
      contact?.company?.valueProp
    ].filter( Boolean ).join( ' ' ).toLowerCase();

    if ( primaryLane === 'Operational insight' ) {
      return {
        style: 'Direct practical operator',
        tone: 'Clear, credible, and grounded',
        guidance: ['Lead with what is breaking or slowing work down.', 'Use plain language and specific observations.', 'Avoid hype and generic inspiration.']
      };
    }
    if ( primaryLane === 'Market visibility' ) {
      return {
        style: 'Sharp market storyteller',
        tone: 'Observational, energetic, and useful',
        guidance: ['Lead with a real pattern you see in the market.', 'Keep the writing crisp and audience-aware.', 'Avoid sounding like an ad.']
      };
    }
    if ( primaryLane === 'Advisory perspective' || /consult|coach|advisor/.test( raw ) ) {
      return {
        style: 'Trusted advisor',
        tone: 'Calm, decisive, and clarifying',
        guidance: ['Frame the issue clearly.', 'Teach without lecturing.', 'Use conviction without sounding inflated.']
      };
    }
    return {
      style: 'Founder-operator',
      tone: 'Real, concise, and credible',
      guidance: ['Write like someone doing the work.', 'Prefer real observations over slogans.', 'Stay concrete and easy to follow.']
    };
  }

  private fullName ( contact: WritingIdentityContact | null ): string {
    const firstName = String( contact?.firstName || '' ).trim();
    const lastName = String( contact?.lastName || '' ).trim();
    return `${firstName} ${lastName}`.trim();
  }

  private joinList ( value: unknown ): string {
    return Array.isArray( value ) ? value.map( item => String( item || '' ).trim() ).filter( Boolean ).join( ', ' ) : '';
  }

  private firstNonEmpty ( ...values: Array<string | undefined | null> ): string {
    return values.map( value => String( value || '' ).trim() ).find( Boolean ) || '';
  }

  private collectInferredFields ( contact: WritingIdentityContact ): string[] {
    return [
      contact?.displayName ? 'displayName' : '',
      this.fullName( contact ) ? 'firstName/lastName' : '',
      contact?.profession ? 'profession' : '',
      this.resolveProfessionLabel( contact ) ? 'profession/title/jobDescriptionForTODD' : '',
      contact?.jobDescriptionForTODD ? 'jobDescriptionForTODD' : '',
      contact?.company?.name ? 'company.name' : '',
      contact?.company?.description ? 'company.description' : '',
      contact?.company?.goal ? 'company.goal' : '',
      contact?.company?.valueProp ? 'company.valueProp' : '',
      Array.isArray( contact?.company?.capabilities ) && contact.company?.capabilities?.length ? 'company.capabilities' : '',
      Array.isArray( contact?.company?.keyFeatures ) && contact.company?.keyFeatures?.length ? 'company.keyFeatures' : ''
    ].filter( Boolean );
  }

  private validateProfileCompleteness ( contact: WritingIdentityContact | null ): ToddIdentityValidationResult {
    const source = contact || {} as WritingIdentityContact;
    const company = ( source.company || {} ) as any;
    const fullName = this.fullName( source );
    const companyName = this.firstNonEmpty( company.name, ( source as any ).companyName );
    const professionLabel = this.resolveProfessionLabel( source );
    const personLabel = this.firstNonEmpty(
      source.displayName,
      fullName,
      professionLabel,
      companyName
    );
    const whatTheyDo = this.firstNonEmpty(
      source.jobDescriptionForTODD,
      String( company.description || '' ),
      String( company.valueProp || '' ),
      this.joinList( company.keyFeatures )
    );
    const howTheyMakeMoney = this.firstNonEmpty(
      String( company.valueProp || '' ),
      String( company.description || '' ),
      this.joinList( company.keyFeatures ),
      source.jobDescriptionForTODD
    );
    const foundFields = [
      source.displayName ? 'displayName' : '',
      fullName ? 'firstName/lastName' : '',
      professionLabel ? 'profession' : '',
      companyName ? 'company.name' : '',
      source.jobDescriptionForTODD ? 'jobDescriptionForTODD' : '',
      String( company.description || '' ).trim() ? 'company.description' : '',
      String( company.valueProp || '' ).trim() ? 'company.valueProp' : '',
      Array.isArray( company.keyFeatures ) && company.keyFeatures.length ? 'company.keyFeatures' : '',
      source.toddWritingIdentity?.profileCompleteEnough === true ? 'toddWritingIdentity.profileCompleteEnough' : ''
    ].filter( Boolean );
    const missingFields = [
      personLabel ? '' : 'name',
      professionLabel ? '' : 'profession',
      companyName ? '' : 'company.name',
      whatTheyDo ? '' : 'whatTheyDo',
      howTheyMakeMoney ? '' : 'offer.clarity'
    ].filter( Boolean );
    const persistedComplete = source.toddWritingIdentity?.profileCompleteEnough === true;
    const criticalIdentityPresent = !!personLabel && !!companyName;
    const profileCompleteEnough = !!personLabel && !!whatTheyDo && !!howTheyMakeMoney;
    const inferredFrom = this.collectInferredFields( source );
    if ( inferredFrom.length < 4 && !profileCompleteEnough && !persistedComplete ) {
      missingFields.push( 'profile.depth' );
    }
    const skipWarning = persistedComplete && criticalIdentityPresent;

    return {
      personLabel,
      professionLabel,
      companyName,
      whatTheyDo,
      howTheyMakeMoney,
      foundFields: Array.from( new Set( foundFields ) ),
      missingFields: Array.from( new Set( missingFields ) ),
      evaluatedPaths: [
        'displayName',
        'firstName',
        'lastName',
        'profession',
        'title',
        'jobDescriptionForTODD',
        'company.name',
        'companyName',
        'company.description',
        'company.valueProp',
        'company.keyFeatures',
        'toddWritingIdentity.profileCompleteEnough'
      ],
      inferredFrom,
      profileCompleteEnough: profileCompleteEnough || skipWarning,
      skipWarning
    };
  }

  private resolveProfessionLabel ( contact: WritingIdentityContact | null ): string {
    const source = contact || {} as WritingIdentityContact;
    return this.firstNonEmpty(
      source.profession,
      ( source as any ).title,
      this.inferProfessionFromJobDescription( source.jobDescriptionForTODD )
    );
  }

  private inferProfessionFromJobDescription ( value: string | null | undefined ): string {
    const normalized = String( value || '' ).trim();
    if ( !normalized ) return '';
    return normalized.split( /[.!?\n]/ )[0].trim();
  }
}

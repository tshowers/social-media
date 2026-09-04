export type ToddWritingVoiceProfile = {
  style: string;
  tone: string;
  guidance: string[];
};

export type ToddWritingIdentityValidationDebug = {
  foundFields: string[];
  missingFields: string[];
  evaluatedPaths: string[];
};

export type ToddWritingIdentity = {
  identitySummary: string;
  whoTheyAre: string;
  whatTheyDo: string;
  howTheyMakeMoney: string;
  likelyAudience: string;
  primaryContentLane: string;
  secondaryThemes: string[];
  voiceProfile: ToddWritingVoiceProfile;
  confidence: 'low' | 'medium' | 'high';
  warningMessage?: string;
  warningDetails?: string[];
  validationDebug?: ToddWritingIdentityValidationDebug;
  inferredFrom: string[];
  profileCompleteEnough: boolean;
  lastDerivedAt?: string;
};

export type ToddWritingIdentityReview = {
  matchesLane: boolean;
  matchesVoice: boolean;
  score: number;
  warnings: string[];
  summary: string;
};

export type ToddWritingIdentityState = {
  identity: ToddWritingIdentity;
  reviewDraft: ( draft: string ) => ToddWritingIdentityReview;
};

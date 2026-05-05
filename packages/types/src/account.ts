// Mirrors future protobuf message AccountService; hand-written for now.

import type { AccountId, Iso8601 } from './common';

export interface Profile {
  readonly accountId: AccountId;
  readonly handle: string;
  readonly displayName: string;
  readonly bio: string;
  readonly avatarUrl: string;
  readonly bannerUrl: string;
  readonly joinedAt: Iso8601;
  readonly title: string;
  /** Cosmetic-only badges from completed campaigns / live events. */
  readonly badges: readonly string[];
  readonly publicVirtueTitle: string;
}

export interface Preferences {
  readonly accountId: AccountId;
  readonly locale: string;
  readonly timezone: string;
  readonly emailOptIn: boolean;
  readonly telemetryConsent: boolean;
  readonly marketingConsent: boolean;
  readonly pushNotifications: boolean;
  readonly preferredShard: string;
  readonly hidesAdultContent: boolean;
}

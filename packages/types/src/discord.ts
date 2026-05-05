// Mirrors future protobuf message DiscordRichPresence; hand-written for now.
//
// Reference: Doc #37 §Discord-interop. Only the Rich Presence object shape is
// stubbed — no SDK wiring yet.

import type { Iso8601 } from './common';

export interface RichPresence {
  readonly applicationId: string;
  readonly state: string;
  readonly details: string;
  readonly startTimestamp?: Iso8601;
  readonly endTimestamp?: Iso8601;
  readonly largeImageKey: string;
  readonly largeImageText: string;
  readonly smallImageKey?: string;
  readonly smallImageText?: string;
  readonly partySize?: { readonly current: number; readonly max: number };
  readonly partyId?: string;
  readonly joinSecret?: string;
  readonly spectateSecret?: string;
  readonly buttons?: readonly { readonly label: string; readonly url: string }[];
}

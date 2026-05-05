// Catch-all handlers for endpoints that don't fit a single domain prefix.
import { domainHandlers } from './_lib';

export const miscHandlers = [
  ...domainHandlers('/v1/levelup'),
  ...domainHandlers('/v1/loading-screens'),
  ...domainHandlers('/v1/discord'),
  ...domainHandlers('/v1/gm'),
  ...domainHandlers('/v1/telemetry'),
];

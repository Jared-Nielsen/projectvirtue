import { domainHandlers } from './_lib';

export const economyHandlers = [
  ...domainHandlers('/v1/economy'),
  ...domainHandlers('/v1/crafting'),
];

import { domainHandlers } from './_lib';

export const inventoryHandlers = [
  ...domainHandlers('/v1/inventory'),
  ...domainHandlers('/v1/items'),
];

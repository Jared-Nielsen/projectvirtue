import { domainHandlers } from './_lib';

export const questHandlers = [...domainHandlers('/v1/quests'), ...domainHandlers('/v1/journal')];

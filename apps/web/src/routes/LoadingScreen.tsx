// `/loading/:variant` — thin route wrapper. The actual variant selection,
// manifest fetch, and quote rotation live in `../loading/LoadingScreenRotator`
// so the same logic is reachable from places other than the bare route
// (e.g. an in-game scene transition).

import { useParams } from '@solidjs/router';
import type { JSX } from 'solid-js';
import { LoadingScreenRotator } from '../loading/LoadingScreenRotator';

export function LoadingScreen(): JSX.Element {
  const params = useParams<{ variant?: string }>();
  return <LoadingScreenRotator variant={params.variant} />;
}

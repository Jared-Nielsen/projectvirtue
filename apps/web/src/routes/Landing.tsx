// `/` — LandingShell. Decides between login and home based on the mock auth
// signal. Real implementation will respect `?next=` redirect query strings.

import { Navigate } from '@solidjs/router';
import type { JSX } from 'solid-js';
import { isAuthenticated } from '../state/auth';

export function Landing(): JSX.Element {
  return <Navigate href={isAuthenticated() ? '/home' : '/login'} />;
}

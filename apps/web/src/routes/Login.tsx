// `/login` — Login screen placeholder. The real screen comes in Phase 5; for
// now a single button flips the mock auth signal so the protected routes
// become reachable.

import { Button, Card, Stack, toast } from '@br/ui';
import { useNavigate } from '@solidjs/router';
import type { JSX } from 'solid-js';
import { signIn } from '../state/auth';

export function Login(): JSX.Element {
  const navigate = useNavigate();

  function handleMockSignIn(): void {
    signIn();
    toast.show('Mock session established.', { title: 'Welcome, Avatar' });
    navigate('/home', { replace: true });
  }

  return (
    <Card>
      <Stack gap="4">
        <h1 style={{ margin: 0 }}>Sign In</h1>
        <p style={{ margin: 0, opacity: 0.85 }}>
          The realm awaits. Mock authentication only — no credentials required.
        </p>
        <Button onClick={handleMockSignIn} variant="primary">
          Sign in (mock)
        </Button>
      </Stack>
    </Card>
  );
}

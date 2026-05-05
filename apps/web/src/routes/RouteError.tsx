// Lore-flavored error boundary used as the per-route fallback. Phase 7 wires a
// real Sentry-compatible reporter in here.

import { Button, Card, Stack } from '@br/ui';
import { useNavigate } from '@solidjs/router';
import type { JSX } from 'solid-js';

export interface RouteErrorProps {
  error: unknown;
  reset?: () => void;
}

export function RouteError(props: RouteErrorProps): JSX.Element {
  const navigate = useNavigate();
  const message = props.error instanceof Error ? props.error.message : String(props.error);

  function handleReturn(): void {
    if (props.reset) props.reset();
    navigate('/home');
  }

  return (
    <Card>
      <Stack gap="3">
        <h1 style={{ margin: 0 }}>The fates have intervened…</h1>
        <p style={{ margin: 0, opacity: 0.85 }}>
          A misstep upon the path. The Avatar may yet recover.
        </p>
        <pre
          style={{
            margin: 0,
            padding: 'var(--br-space-3, 0.75rem)',
            'background-color': 'rgba(0,0,0,0.4)',
            'border-radius': 'var(--br-radius-md, 6px)',
            'font-size': '0.8rem',
            'white-space': 'pre-wrap',
          }}
        >
          {message}
        </pre>
        <div>
          <Button variant="primary" onClick={handleReturn}>
            Return to safety
          </Button>
        </div>
      </Stack>
    </Card>
  );
}

// `/home` — main menu placeholder (1-HomeScreen.png). Phase 5 fills in the
// six menu actions (Continue / New / Join Shard / Host Campaign / Options /
// Quit). For now we render the choices as plain links.

import { Button, Card, Cluster, Stack } from '@br/ui';
import { useNavigate } from '@solidjs/router';
import type { JSX } from 'solid-js';
import { mockClient } from '../state/mockClient';
import { Placeholder } from './_Placeholder';

export function Home(): JSX.Element {
  const navigate = useNavigate();
  return (
    <Stack gap="4">
      <Placeholder
        title="Home"
        description="Main menu. Pick a path, Avatar."
        endpoint="GET /v1/account/profile"
        load={() => mockClient.get('/v1/account/profile')}
      />
      <Card>
        <Cluster gap="3">
          <Button variant="primary" onClick={() => navigate('/character')}>
            Continue
          </Button>
          <Button variant="secondary" onClick={() => navigate('/character/create')}>
            New character
          </Button>
          <Button variant="secondary" onClick={() => navigate('/play')}>
            Enter world
          </Button>
          <Button variant="ghost" onClick={() => navigate('/play/options')}>
            Options
          </Button>
        </Cluster>
      </Card>
    </Stack>
  );
}

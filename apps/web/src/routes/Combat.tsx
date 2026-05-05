// `/play/combat` — boss-encounter HUD (Phase 5 Batch B, 2-6-DragonCombat.png).
//
// Pulls the dragon-encounter mock state and renders the boss HUD on top
// of a black backdrop (the canvas runtime is intentionally NOT remounted
// here — `/play/combat` is a focused encounter UI without world
// exploration). When the canvas grows a "boss arena" mode the backdrop
// will be replaced by a re-mounted GameCanvas configured with that arena.

import type { CombatState } from '@br/types';
import { Loading } from '@br/ui';
import { type JSX, Suspense, createResource } from 'solid-js';
import { BossHud } from '../play/BossHud';
import shared from '../play/hud-shared.module.css';
import { mockClient } from '../state/mockClient';
import styles from './Combat.module.css';

export function Combat(): JSX.Element {
  const [state] = createResource<CombatState>(() =>
    mockClient.get<CombatState>('/v1/combat/dragon-encounter'),
  );

  return (
    <div class={shared.canvasShell}>
      <div class={styles.backdrop} aria-hidden="true" />
      <Suspense fallback={<Loading label="Summoning the wyrm…" />}>
        {state.loading ? null : state() ? <BossHud state={state() as CombatState} /> : null}
      </Suspense>
    </div>
  );
}

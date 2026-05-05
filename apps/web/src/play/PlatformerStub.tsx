// Exploratory 3D platformer stub — concept-art reference 2-99-PlatformerCombatIn3D.png.
//
// Flagged [design-in-flight]: the screen is a placeholder so the design
// team can iterate on what 3D platformer combat means inside Avermere
// without holding back the rest of the HUD. Gated behind the
// `?platformer=1` query string so it's strictly opt-in during dev.

import { Card } from '@br/ui';
import type { JSX } from 'solid-js';
import styles from './PlatformerStub.module.css';
import shared from './hud-shared.module.css';

export function PlatformerStub(): JSX.Element {
  return (
    <div class={`${shared.anchor} ${styles.anchor}`}>
      <Card class={styles.stub}>
        <h3>Platformer Combat — design in flight</h3>
        <p>
          A future game-mode for action-arena boss fights. Concept art lives at
          <code> _conceptart/Interfaces/2-99-PlatformerCombatIn3D.png</code>. The HUD shape, hit
          stop semantics, and camera rules are all open questions; the rest of the play layer is
          deliberately decoupled from this prototype.
        </p>
        <p class={styles.tag} aria-label="Status">
          [design-in-flight]
        </p>
      </Card>
    </div>
  );
}

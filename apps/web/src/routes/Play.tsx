// `/play` — main game world (Phase 5 Batch B).
//
// Composes the PixiJS GameCanvas (Phase 6) with a HUD overlay layer:
//   • Default: 2-1-ScreenConcept reference layout via <CombatHud/>.
//   • ?mode=court    → throne-room HUD (2-4-HoldingCourt.png).
//   • ?mode=city     → port-city HUD with floating NPC labels (2-5).
//   • ?mode=combat   → combat HUD over forest tiles (2-2-CombatForest.png).
//   • ?mode=magic    → combat HUD with the spell ring already open (2-3).
//   • ?platformer=1  → exploratory 3D platformer stub (2-99).
//
// Canvas → HUD events:
//   • `br:trigger:transition` opens the moon-portal travel modal (2-7).
//   • `br:trigger:dialog` is consumed by the existing dialog route (Batch A).
//   • `br:trigger:loot` is consumed by the existing loot route (Batch A).
//
// HUD → Canvas: deferred to Wave 4. TODO comments mark the dispatch sites.

import { useSearchParams } from '@solidjs/router';
import type { JSX } from 'solid-js';
import { Show, createSignal, onCleanup, onMount } from 'solid-js';
import { GameCanvas } from '../canvas/GameCanvas';
import { CityHud } from '../play/CityHud';
import { CombatHud } from '../play/CombatHud';
import { CourtHud } from '../play/CourtHud';
import { PlatformerStub } from '../play/PlatformerStub';
import { PortalModal } from '../play/PortalModal';
import shared from '../play/hud-shared.module.css';

interface TransitionDetail {
  readonly regionId?: string;
  readonly tile?: { readonly x: number; readonly y: number };
}

export function Play(): JSX.Element {
  const [search] = useSearchParams<{ mode?: string; platformer?: string }>();

  // Single EventTarget shared with the canvas for triggers.
  const canvasEvents = new EventTarget();

  const [portalOpen, setPortalOpen] = createSignal(false);
  const [originRegion, setOriginRegion] = createSignal<string | null>(null);

  function onTransition(ev: Event): void {
    const ce = ev as CustomEvent<TransitionDetail>;
    setOriginRegion(ce.detail?.regionId ?? null);
    setPortalOpen(true);
  }

  onMount(() => {
    canvasEvents.addEventListener('br:trigger:transition', onTransition);
  });
  onCleanup(() => {
    canvasEvents.removeEventListener('br:trigger:transition', onTransition);
  });

  const mode = (): string => search.mode ?? 'default';
  const platformer = (): boolean => search.platformer === '1';

  const regionLabel = (): string => {
    switch (mode()) {
      case 'combat':
        return 'Silverwood Forest';
      case 'magic':
        return 'Old Keep Dungeon';
      case 'city':
        return 'Greenvale';
      case 'court':
        return 'Ardania Castle';
      default:
        return "Serpent's Coast";
    }
  };

  return (
    <div class={shared.canvasShell}>
      <div class={shared.canvasMount}>
        <GameCanvas events={canvasEvents} />
      </div>

      <Show when={mode() === 'court'}>
        <CourtHud regionId="region_britain" />
      </Show>

      <Show when={mode() === 'city'}>
        <CityHud regionId="region_britain" regionLabel={regionLabel()} />
      </Show>

      <Show
        when={
          mode() === 'default' || mode() === 'combat' || mode() === 'magic' || mode() === 'forest'
        }
      >
        <CombatHud regionLabel={regionLabel()} />
      </Show>

      <Show when={platformer()}>
        <PlatformerStub />
      </Show>

      <PortalModal
        open={portalOpen()}
        originRegionId={originRegion()}
        onClose={() => setPortalOpen(false)}
        onTravel={(_r) => {
          // TODO(player-intent): emit a region transition request to the
          // canvas EventTarget once the canvas accepts inbound commands.
          setPortalOpen(false);
        }}
      />
    </div>
  );
}

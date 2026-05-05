// Radial spell-selection menu — concept-art reference 2-3-CombatMagic.png.
//
// Triggered by a hotkey ('Q' default). Renders a circle of spell tiles
// around the screen centre, each with a glyph + name. The wheel index can
// be cycled with ArrowLeft / ArrowRight; Enter casts the focused spell;
// Escape closes the ring.
//
// `slotPosition` is a pure helper exported for unit tests so the ring math
// stays correctness-checked when the design tweaks the radius.

import type { Spell } from '@br/types';
import { ManaBar } from '@br/ui';
import { type JSX, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import { For, Show } from 'solid-js';
import styles from './SpellRing.module.css';
import shared from './hud-shared.module.css';

export interface SpellRingProps {
  readonly spells: readonly Spell[];
  readonly mana: { readonly current: number; readonly max: number };
  readonly hotkey?: string;
  readonly onCast?: (spell: Spell) => void;
}

/** Pure: place the i-th of `count` slots evenly around a circle. */
export function slotPosition(
  i: number,
  count: number,
  radius: number,
): { readonly x: number; readonly y: number } {
  if (count <= 0) return { x: 0, y: 0 };
  // Start at the top (-90°) and proceed clockwise.
  const angle = -Math.PI / 2 + (i / count) * Math.PI * 2;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

/** Pure: clamp a step delta around a ring of length `n`. */
export function cycleIndex(current: number, delta: number, n: number): number {
  if (n <= 0) return 0;
  return (((current + delta) % n) + n) % n;
}

export function SpellRing(props: SpellRingProps): JSX.Element {
  const [open, setOpen] = createSignal(false);
  const [focusIdx, setFocusIdx] = createSignal(0);
  const memorized = createMemo(() => props.spells.filter((s) => s.memorized));
  const radius = 130;
  const trigger = (): string => props.hotkey ?? 'q';

  function close(): void {
    setOpen(false);
    setFocusIdx(0);
  }

  function cast(s: Spell): void {
    if (s.manaCost > props.mana.current) return;
    // TODO(player-intent): forward to the canvas EventTarget so the world
    // can play a cast animation and apply the effect.
    props.onCast?.(s);
    close();
  }

  function onKey(ev: KeyboardEvent): void {
    if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
    const t = ev.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
      return;
    }
    if (ev.key.toLowerCase() === trigger().toLowerCase()) {
      ev.preventDefault();
      setOpen((v) => !v);
      return;
    }
    if (!open()) return;
    if (ev.key === 'Escape') {
      ev.preventDefault();
      close();
      return;
    }
    const list = memorized();
    if (list.length === 0) return;
    if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') {
      ev.preventDefault();
      setFocusIdx((i) => cycleIndex(i, 1, list.length));
      return;
    }
    if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') {
      ev.preventDefault();
      setFocusIdx((i) => cycleIndex(i, -1, list.length));
      return;
    }
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      const s = list[focusIdx()];
      if (s) cast(s);
    }
  }

  onMount(() => {
    window.addEventListener('keydown', onKey);
  });
  onCleanup(() => {
    window.removeEventListener('keydown', onKey);
  });

  return (
    <Show when={open()}>
      <dialog class={styles.scrim} aria-modal="true" aria-label="Spell selection" open>
        <div class={styles.ringRoot}>
          <div class={`${shared.panel} ${styles.center}`}>
            <p class={styles.centerLabel}>SPELLS</p>
            <ManaBar value={props.mana.current} max={props.mana.max} label="Mana" />
            <p class={styles.hint}>Arrow keys to cycle · Enter to cast · Esc to close</p>
          </div>
          <For each={memorized()}>
            {(spell, i) => {
              const pos = slotPosition(i(), memorized().length, radius);
              const affordable = spell.manaCost <= props.mana.current;
              return (
                <button
                  type="button"
                  class={`${styles.slot} ${focusIdx() === i() ? styles.focused : ''} ${
                    affordable ? '' : styles.disabled
                  }`}
                  style={{
                    transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`,
                  }}
                  onClick={() => cast(spell)}
                  aria-label={`${spell.name.en} (${spell.manaCost} mana)`}
                  disabled={!affordable}
                >
                  <span class={styles.glyph} aria-hidden="true">
                    ☉
                  </span>
                  <span class={styles.name}>{spell.name.en}</span>
                  <span class={styles.cost}>{spell.manaCost}</span>
                </button>
              );
            }}
          </For>
        </div>
      </dialog>
    </Show>
  );
}

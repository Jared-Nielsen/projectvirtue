// Pure helpers for the Dialog screen. The branching engine here is the
// "tree-shaped" projection (DialogNode list) from `@br/types`/dialog.ts —
// the keyword-map projection is reserved for the eventual canonical engine.

import type { DialogNode, NpcDialog, Virtue } from '@br/types';

export interface AvatarVirtueProfile {
  readonly virtueScores: Readonly<Record<Virtue, number>>;
}

/** Find the node a NpcDialog should open with. */
export function rootNode(dlg: NpcDialog | undefined): DialogNode | undefined {
  if (!dlg?.nodes || dlg.nodes.length === 0) return undefined;
  const entry = dlg.entryNodeId;
  if (entry) {
    const found = dlg.nodes.find((n) => n.id === entry);
    if (found) return found;
  }
  return dlg.nodes[0];
}

/** Traverse to the next node by id, falling back to undefined. */
export function nextNode(
  dlg: NpcDialog | undefined,
  nextId: string | undefined,
): DialogNode | undefined {
  if (!dlg?.nodes || !nextId) return undefined;
  return dlg.nodes.find((n) => n.id === nextId);
}

/** Whether a given choice is gated by a virtue threshold the avatar lacks. */
export function isChoiceLocked(
  choice: DialogNode['choices'][number],
  avatar: AvatarVirtueProfile | undefined,
): boolean {
  if (!choice.virtueRequired) return false;
  const score = avatar?.virtueScores[choice.virtueRequired.virtue] ?? 0;
  return score < choice.virtueRequired.minScore;
}

/**
 * Render a one-line lock label for a virtue-gated choice — used in the
 * trailing "lock" pill on the choice button.
 */
export function lockLabel(choice: DialogNode['choices'][number]): string | null {
  if (!choice.virtueRequired) return null;
  const v = choice.virtueRequired.virtue;
  return `${v} ≥ ${choice.virtueRequired.minScore}`;
}

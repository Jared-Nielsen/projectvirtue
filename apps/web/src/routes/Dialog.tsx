// `/play/dialog/:npcId` — branching dialog modal (9-1-DialogModals.png).
//
// Concept-art interpretation: NPC bust + name + reputation track on the
// left rail; numbered response chips on the right. We use the
// `NpcDialog.nodes[]` projection so a chip click navigates to the next
// node id locally (mock — no server round trip). Virtue-gated choices
// render a lock badge instead of being hidden, matching the art's
// "(Honor required)" affordance.

import type { Character, DialogNode, NpcDialog } from '@br/types';
import { Card, IconButton, Stack, WindowFrame } from '@br/ui';
import { useNavigate, useParams } from '@solidjs/router';
import { For, type JSX, Show, Suspense, createMemo, createResource, createSignal } from 'solid-js';
import { mockClient } from '../state/mockClient';
import styles from './Dialog.module.css';
import { isChoiceLocked, lockLabel, nextNode, rootNode } from './dialog.helpers';

interface CharactersPayload {
  readonly characters: readonly Character[];
}

export function Dialog(): JSX.Element {
  const params = useParams<{ npcId: string }>();
  const navigate = useNavigate();

  const [dialog] = createResource<NpcDialog>(() =>
    mockClient.get<NpcDialog>(`/v1/dialog/${params.npcId}`),
  );
  // Pull active character to drive virtue-gated choice locks.
  const [chars] = createResource<CharactersPayload>(() =>
    mockClient.get<CharactersPayload>('/v1/characters').catch(() => ({ characters: [] })),
  );

  const avatar = createMemo<Character | undefined>(() => chars()?.characters[0]);

  const [nodeId, setNodeId] = createSignal<string | null>(null);

  const currentNode = createMemo<DialogNode | undefined>(() => {
    const dlg = dialog();
    if (!dlg) return undefined;
    const id = nodeId();
    if (id) return nextNode(dlg, id) ?? rootNode(dlg);
    return rootNode(dlg);
  });

  const ended = createMemo(() => {
    const c = currentNode();
    if (!c) return false;
    return c.choices.length === 0;
  });

  function pick(choice: DialogNode['choices'][number]): void {
    if (choice.endsConversation) {
      navigate('/play');
      return;
    }
    if (choice.nextNodeId) setNodeId(choice.nextNodeId);
  }

  return (
    <Suspense fallback={<p>Listening for the keeper of secrets…</p>}>
      <WindowFrame title="Dialog" onClose={() => navigate('/play')}>
        <Card>
          <div class={styles.shell}>
            <div>
              <div
                class={styles.bust}
                role="img"
                aria-label={`${dialog()?.npcName ?? 'Speaker'} portrait`}
              >
                <span class={styles.bustGlyph} aria-hidden="true">
                  {(dialog()?.npcName?.[0] ?? '?').toUpperCase()}
                </span>
                <span class={styles.bustName}>{dialog()?.npcName ?? 'Unknown'}</span>
              </div>
              <Show when={avatar()}>
                {(c) => (
                  <div class={styles.bustMeta}>
                    <span class={styles.bustLabel}>Reputation</span>
                    <div class={styles.repBar} aria-hidden="true">
                      <div class={styles.repFill} style={{ width: `${reputationPercent(c())}%` }} />
                    </div>
                    <span style={{ 'font-size': '0.75rem', opacity: 0.75 }}>
                      {reputationLabel(c())}
                    </span>
                  </div>
                )}
              </Show>
              <div style={{ 'margin-top': 'var(--br-space-3, 0.75rem)' }}>
                <IconButton
                  icon="x"
                  label="End conversation"
                  variant="ghost"
                  onClick={() => navigate('/play')}
                />
              </div>
            </div>

            <div class={styles.body}>
              <Stack gap="1">
                <h2 class={styles.npcName}>{dialog()?.npcName ?? 'Unknown'}</h2>
                <p class={styles.npcKeeper}>{keeperOf(params.npcId)}</p>
              </Stack>
              <p class={styles.npcText}>"{currentNode()?.text.en ?? '…'}"</p>

              <Show when={!ended()}>
                <ul class={styles.choiceList} aria-label="Responses">
                  <For each={currentNode()?.choices ?? []}>
                    {(c, i) => {
                      const locked = createMemo(() => {
                        const a = avatar();
                        return isChoiceLocked(c, a ? { virtueScores: a.virtueScores } : undefined);
                      });
                      const label = lockLabel(c);
                      return (
                        <li>
                          <button
                            type="button"
                            class={styles.choice}
                            onClick={() => pick(c)}
                            disabled={locked()}
                            aria-disabled={locked() ? 'true' : 'false'}
                          >
                            <span class={styles.choiceNum} aria-hidden="true">
                              {i() + 1}.
                            </span>
                            <span>{c.label.en}</span>
                            <Show when={label}>
                              <span class={styles.choiceLock}>({label})</span>
                            </Show>
                          </button>
                        </li>
                      );
                    }}
                  </For>
                </ul>
              </Show>

              <Show when={ended()}>
                <p class={styles.endNote}>The conversation has ended.</p>
              </Show>
            </div>
          </div>
        </Card>
      </WindowFrame>
    </Suspense>
  );
}

function reputationPercent(c: Character): number {
  // A composite of all eight virtue scores, normalized into a 0..100 bar.
  const scores = Object.values(c.virtueScores);
  if (scores.length === 0) return 0;
  const sum = scores.reduce((a, b) => a + b, 0);
  return Math.max(0, Math.min(100, Math.round(sum / scores.length)));
}

function reputationLabel(c: Character): string {
  const pct = reputationPercent(c);
  if (pct >= 80) return 'Honored';
  if (pct >= 60) return 'Respected';
  if (pct >= 40) return 'Recognized';
  if (pct >= 20) return 'Distrusted';
  return 'Reviled';
}

function keeperOf(npcId: string): string {
  // Convenience subtitle. Real NPC manifest will carry a localized title.
  if (npcId.includes('lord-british')) return 'Sovereign of Britain';
  if (npcId.includes('iolo')) return 'Bard of Britain';
  if (npcId.includes('dupre') || npcId === 'branch') return 'Knight of Trinsic';
  return 'Keeper of Secrets';
}

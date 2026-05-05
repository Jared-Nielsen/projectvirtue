import type { DialogNode, NpcDialog, Virtue } from '@br/types';
import { describe, expect, it } from 'vitest';
import { isChoiceLocked, lockLabel, nextNode, rootNode } from '../dialog.helpers';

const drinkChoice: DialogNode['choices'][number] = {
  id: 'ch_drink',
  label: { key: 'k.drink', en: 'Buy me a drink.' },
  nextNodeId: 'node_drink' as DialogNode['id'],
};

const oathChoice: DialogNode['choices'][number] = {
  id: 'ch_oath',
  label: { key: 'k.oath', en: 'Swear an oath.' },
  virtueRequired: { virtue: 'honor', minScore: 60 },
  nextNodeId: 'node_oath' as DialogNode['id'],
};

const baseDlg: Omit<NpcDialog, 'entryNodeId' | 'nodes'> = {
  npcId: 'npc_bron' as NpcDialog['npcId'],
  npcName: 'Bron',
  portrait: '/assets/portraits/bron.webp',
  tree: {
    id: 'tree_bron' as NpcDialog['tree']['id'],
    npcId: 'npc_bron' as NpcDialog['tree']['npcId'],
    opening: ['greet'],
    keywords: { greet: 'resp_bron_greet' },
    responses: {
      resp_bron_greet: {
        id: 'resp_bron_greet',
        text: { key: 'g', en: 'Well met.' },
        unlocks: [],
        locks: [],
        sideEffects: [],
      },
    },
    defaultResponseId: 'resp_bron_greet',
  },
};

const sampleDlg: NpcDialog = {
  ...baseDlg,
  entryNodeId: 'node_root' as NpcDialog['entryNodeId'] & string,
  nodes: [
    {
      id: 'node_root' as DialogNode['id'],
      speaker: 'npc',
      text: { key: 'k.root', en: 'Choose.' },
      choices: [drinkChoice, oathChoice],
    },
    {
      id: 'node_drink' as DialogNode['id'],
      speaker: 'npc',
      text: { key: 'k.drink.r', en: 'Now you speak my language.' },
      choices: [],
    },
    {
      id: 'node_oath' as DialogNode['id'],
      speaker: 'npc',
      text: { key: 'k.oath.r', en: 'Then say it.' },
      choices: [],
    },
  ],
};

const baseScores: Readonly<Record<Virtue, number>> = {
  mercy: 0,
  truth: 0,
  honor: 0,
  humility: 0,
  justice: 0,
  devotion: 0,
  insight: 0,
  courage: 0,
};

describe('dialog.helpers', () => {
  describe('rootNode', () => {
    it('returns the entryNode when present', () => {
      expect(rootNode(sampleDlg)?.id).toBe('node_root');
    });

    it('returns undefined for an empty dialog', () => {
      const empty: NpcDialog = { ...sampleDlg, nodes: [] };
      expect(rootNode(empty)).toBeUndefined();
    });

    it('falls back to the first node when entryNodeId is missing', () => {
      const noEntry: NpcDialog = { ...baseDlg, nodes: sampleDlg.nodes ?? [] };
      const r = rootNode(noEntry);
      expect(r?.id).toBe('node_root');
    });

    it('returns undefined when input is undefined', () => {
      expect(rootNode(undefined)).toBeUndefined();
    });
  });

  describe('nextNode', () => {
    it('finds a node by id', () => {
      expect(nextNode(sampleDlg, 'node_drink')?.id).toBe('node_drink');
    });

    it('returns undefined for a missing id', () => {
      expect(nextNode(sampleDlg, 'node_does_not_exist')).toBeUndefined();
    });

    it('returns undefined when given no id', () => {
      expect(nextNode(sampleDlg, undefined)).toBeUndefined();
    });
  });

  describe('isChoiceLocked', () => {
    it('does not lock unrestricted choices', () => {
      expect(isChoiceLocked(drinkChoice, undefined)).toBe(false);
    });

    it('locks virtue-gated choices when score is below the threshold', () => {
      const avatar = { virtueScores: { ...baseScores, honor: 30 } };
      expect(isChoiceLocked(oathChoice, avatar)).toBe(true);
    });

    it('does not lock when score meets the threshold', () => {
      const avatar = { virtueScores: { ...baseScores, honor: 80 } };
      expect(isChoiceLocked(oathChoice, avatar)).toBe(false);
    });
  });

  describe('lockLabel', () => {
    it('returns null for unrestricted choices', () => {
      expect(lockLabel(drinkChoice)).toBeNull();
    });

    it('renders the virtue requirement', () => {
      expect(lockLabel(oathChoice)).toBe('honor ≥ 60');
    });
  });
});

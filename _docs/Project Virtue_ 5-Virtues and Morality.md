Document \#5: Virtues & Morality Engine Design DocumentProject Title: Ultima VII: Project Virtue  
Document Version: 1.0 (Prototype Planning Draft)  
Date: May 2026  
Author: \[Your Name / Systems & Narrative Design Lead\]  
Status: Living Design Reference – The philosophical core of every system in the game

---

1\. Virtues Philosophy – The Heart of Ultima

The Eight Virtues are not a simple “karma meter.” They are the central philosophical engine of Ultima VII: Project Virtue, exactly as Richard Garriott designed them in Ultima IV and refined through Ultima VII. Core Design Mantra:  
Every player action has moral weight. The world notices. The world remembers. The world reacts — not with binary “good/evil” labels, but with nuanced, emergent consequences that reflect the complexity of real ethics.In Project Virtue, the Virtues are:

* A personal reputation system that follows the player across single-player and persistent multiplayer.  
* A world-state driver that changes NPC behavior, economy, story branches, and even procedural events.  
* A creative constraint and enabler for UGC — player-created content is judged by how it aligns with (or challenges) the Virtues.

The goal is to make players feel the weight of their choices the way the original Ultima VII did, but at a massively multiplayer, persistent scale.

---

2\. The Eight Virtues – Mechanical Definition

Each Virtue is tracked independently on a scale of 0–100 (hidden from player until they seek a shrine or consult a sage). Actions raise or lower specific Virtues; opposing Virtues can create tension.

| Virtue | Core Question | Positive Actions (examples) | Negative Actions (examples) | Gameplay Impact |
| ----- | ----- | ----- | ----- | ----- |
| Honesty | Do you speak and act truthfully? | Tell truth in dialogue, return lost items | Lie, steal, cheat in trades | NPC trust, shop prices, quest availability |
| Compassion | Do you show mercy and empathy? | Heal wounded NPCs, donate gold, spare lives | Kill innocents, ignore suffering | Party loyalty, follower recruitment, healing costs |
| Valor | Do you face danger with courage? | Fight overwhelming odds, protect the weak | Flee combat, abandon allies | Combat reputation, guard/NPC aid in battle |
| Justice | Do you uphold fairness? | Punish criminals fairly, balance scales | Murder innocents, accept bribes | Legal consequences, High Court reputation |
| Sacrifice | Do you give of yourself? | Donate reagents, risk life for others | Hoard resources, exploit others | Crafting discounts, NPC gifts, story sacrifices |
| Honor | Do you keep your word? | Fulfill promises, respect oaths | Break contracts, betray allies | Guild membership, long-term NPC alliances |
| Spirituality | Do you seek inner wisdom? | Meditate at shrines, study lore | Desecrate holy sites, ignore spiritual quests | Magic power, vision/dream sequences |
| Humility | Do you remain humble? | Admit ignorance, help the lowly | Boast, demand rewards, act superior | Random helpful events, hidden quest access |

Opposing Tension: Raising one Virtue can slightly lower its philosophical opposite (e.g., extreme Valor may reduce Compassion if it leads to reckless violence).

---

3\. Reputation & Tracking Engine

Global Avatar Reputation

* A single hidden “Avatar Score” that weighs all eight Virtues and influences world events (e.g., Guardian’s influence grows if overall Virtue is low).  
* Persistent across sessions and shards unless the player chooses a “new Avatar” reset.

Visible Feedback Systems:

* Shrine meditation gives exact Virtue readings.  
* NPC dialogue changes tone based on reputation thresholds.  
* Visual/audio cues (e.g., guards salute high-Honor players; beggars avoid low-Compassion players).  
* Periodic “Virtue Visions” — dream sequences that narrate the consequences of recent actions.

Persistent Multiplayer Layer:

* Other players can see your public Virtue title (e.g., “The Compassionate” or “The Dishonorable”).  
* Guilds and towns may accept/reject players based on collective Virtue scores.

---

4\. Integration with Simulation & World Systems (Cross-Document Links)

* Simulation (\#4): Stealing an object triggers immediate Honesty/Justice loss. Burning an innocent’s home causes massive Compassion/Sacrifice penalties. Saving a burning NPC raises multiple Virtues.  
* Economy & Crafting: High Sacrifice players get free reagents from grateful NPCs; low Honor players pay higher taxes.  
* Combat: Killing with environmental objects (pushing enemy into fire) is judged less harshly than direct murder.  
* Story & Quests: Major branches (including the Black Gate campaign) have Virtue-gated endings and optional paths.  
* UGC & Modding (\#7): Player-created quests are automatically scored for Virtue alignment. Highly virtuous content gets promotion priority in the marketplace.

---

5\. Player Actions & Emergent Consequences

Examples of Emergent Morality:

* A player who consistently lies may find merchants giving fake discounts that are actually scams.  
* A high-Valor player who abandons a companion in combat may trigger a permanent companion desertion event.  
* In persistent multiplayer, a town may vote to exile a player whose low Justice score has caused chaos.

Redemption Path:  
Virtues can always be regained through atonement quests, shrine pilgrimages, or major sacrifices — true to Garriott’s belief that no one is beyond redemption.

---

6\. Prototype Scope – “Virtues in Britain”

Must be fully functional in vertical slice:

* All eight Virtues tracked in real time during the Britain town sequence.  
* Immediate feedback when player steals, lies, helps, or harms.  
* At least 8 NPCs whose dialogue and schedules change based on the player’s current Virtue profile.  
* One shrine (Compassion shrine outside Britain) fully interactive with meditation and Virtue readout.  
* Visible consequences: e.g., steal from a merchant → guards become hostile; help a beggar → free inn stay later.

Success Metric:  
A player who experiments with moral choices for 15 minutes should feel the world reacting intelligently — exactly as in the original Ultima VII.

---

Appendix: Open Questions for Lord British

* Desired edge-case rulings on Virtue conflicts.  
* Any new philosophical expansions he wishes to introduce for the persistent era.

This Virtues Engine is the moral compass that turns a simulation sandbox into a true Ultima experience. It touches every other system in the game.  

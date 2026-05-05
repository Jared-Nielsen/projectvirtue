Document \#8: Procedural Generation & World Expansion FrameworkProject Title: Ultima VII: Project Virtue  
Document Version: 1.0 (Prototype Planning Draft)  
Date: May 2026  
Author: \[Your Name / Procedural & Live Service Design Lead\]  
Status: Living Framework Reference – Ensures every new region feels like it belongs in classic Ultima VII

---

1\. Procedural Vision – “Guided Discovery, Never Random Chaos”

Procedural generation in Project Virtue is not about infinite identical planets like No Man’s Sky. It is about guided, hand-crafted-feeling expansion that grows Avermere outward from the 1992 map while preserving the retro isometric soul, simulation depth, and Virtue-driven storytelling of the original game.Core Design Rule:  
Every procedurally generated area must feel like a lost page from a Richard Garriott notebook — mysterious, wondrous, and morally complex. Randomness serves discovery; it never replaces hand-crafted narrative or simulation fidelity.This framework allows the world to grow for decades without requiring hundreds of artists and designers.

---

2\. Procedural Rules & Canon Guardrails

“Ultima Flavor” Filters (applied at every generation step):

* Visuals locked to official 1992 pixel-art tileset \+ approved expansions.  
* All objects obey full simulation rules (Document \#4).  
* Every region must contain at least one Virtue-related moral dilemma.  
* No anachronisms, no sci-fi, no modern references.  
* Guardian influence or new threats can appear, but never contradict established lore (Document \#3).

Generation Types:

* Frontier Regions — New landmasses bordering the original map (e.g., “Northwood Wilds”, “Eastern Isles”).  
* Pocket Realms — Small instanced dungeons or islands accessible via moongates.  
* Dynamic Events — Temporary or evolving areas (e.g., a village swallowed by a swamp that changes weekly).

---

3\. Procedural Generation Systems

3.1 Terrain & Environment

* Base heightmap seeded from original map edges.  
* Biome rules: temperate forests, mountains, swamps, coastlines — all using official tiles.  
* Rivers, roads, and ruins auto-generated then manually “touched up” by the live team for key areas.

3.2 Points of Interest (POIs)

* Hand-crafted “seed templates” (e.g., ruined castle, haunted hamlet, ancient shrine) mixed with procedural variation.  
* Each POI includes:  
  * Physical layout  
  * 3–8 interactive objects  
  * 2–4 NPCs with partial schedules  
  * 1–3 moral/quest triggers

3.3 Quests & Narrative

* Template library of Virtue-driven quest skeletons (“A farmer needs help choosing between truth and mercy”).  
* Dynamic dialogue generated from NPC personality \+ player Virtue score.  
* Branching outcomes based on player choices and group reputation.

3.4 NPC & Creature Population

* Base templates \+ procedural variation in appearance, schedules, and secret flags.  
* Spawn rates balanced by Virtue density (high-Mercy areas have fewer hostile creatures).

3.5 Resource & Economy Nodes

* Mines, farms, rare reagent groves — placed to create natural trade routes and player-driven scarcity.

---

4\. Integration with Core Systems

* Simulation (\#4): All generated objects are fully interactive from the moment they spawn.  
* Virtues (\#5): Every POI and quest is pre-scored for Virtue impact; player choices update the region’s “moral climate.”  
* Persistent World (\#6): New regions are added to live shards seamlessly; changes persist for all players.  
* UGC (\#7): Players can claim and expand procedural areas with their own creations (subject to moderation).  
* World Bible (\#3): New regions are named and lore-written by the official team or top community creators before going live.

---

5\. Live Service Expansion Roadmap (High-Level)

Year 1 (Launch \+ First Year):

* 4 new frontier regions added free via patches.  
* Monthly “Guardian Incursion” events that procedurally alter existing areas.

Year 2+:

* Player-voted expansion themes.  
* Seasonal events tied to real-world holidays or Virtue festivals.  
* Major story arcs that permanently change the world map (e.g., a new city founded by players).

Team Workflow:

* Procedural tools generate 80% of content.  
* Live team hand-polishes narrative, key NPCs, and balance.  
* Top UGC creators invited to contribute official regions.

---

6\. Prototype Scope – “First Procedural Test”

Must be functional in Highmere vertical slice:

* One small procedural dungeon (“Cave of Trials”) that can be regenerated with different layouts, objects, and a simple Virtue dilemma.  
* Basic quest template that reacts to player Virtue score.  
* Full simulation compatibility (fire, containers, NPC schedule inside the dungeon).

Success Metric:  
The procedural dungeon feels as rich and interactive as a hand-crafted one from the original Ultima VII, while being unique on every playthrough.

---

Appendix: Technical Implementation Notes

* Seed-based generation for reproducibility and moderation.  
* All procedural content stored as lightweight data packets (fast downloads).  
* Live team override tools for emergency fixes or special events.

This framework ensures Project Virtue can grow infinitely while always feeling like the same beloved world Lord Avermere first created.  

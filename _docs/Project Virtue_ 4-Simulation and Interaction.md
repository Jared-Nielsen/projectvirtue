Document \#4: Simulation & Interaction Systems Design DocumentProject Title: Ultima VII: Project Virtue  
Document Version: 1.0 (Prototype Planning Draft)  
Date: May 2026  
Author: \[Your Name / Systems Design Lead\]  
Status: Living Technical Design Reference – Drives all gameplay implementation

---

1\. Simulation Philosophy – “The World Is Alive”

The simulation system is Ultima VII. Every object in the world must behave as a real, physical entity with properties, states, and consequences. The player should be able to experiment endlessly and discover emergent gameplay exactly as they did in 1992\. Core Design Rule:  
If it exists in the world, the player can pick it up, move it, combine it, break it, or use it in ways the designers never explicitly planned — provided it respects physics, logic, and the Virtue system.This document defines the rules that make Avermere feel like a living, breathing place rather than a theme-park level.

---

2\. Object Interaction System (Core Loop)

Every object has the following data fields (stored per-instance):

* Physical Properties: Weight, Volume, Solidity, Flammability, Buoyancy, Fragility.  
* State Flags: On Fire, Poisoned, Wet, Locked, Open, Lit, Broken, etc.  
* Ownership Tag: NPC or player ownership (affects stealing & Virtue checks).  
* Script Hook: Optional lightweight script for special behavior (e.g., “forge sword” or “bake bread”).

Interaction Verbs (contextual, mouse-driven):

* Examine – Always available.  
* Use – Default action (open door, read book, eat food, light torch).  
* Drag / Drop – Move, combine, throw, place on surface.  
* Right-Click Menu – Advanced options (Mix, Pour, Ignite, Lockpick, etc.).

Combination Rules:

* Objects can be combined in any logical way (e.g., oil \+ rag \= torch; poison \+ weapon \= poisoned blade).  
* Invalid combinations simply do nothing or produce humorous feedback (“That doesn’t seem useful…”).

---

3\. Physics & Environmental Simulation

Core Physics (Isometric 2.5D simulation – not full 3D):

* Grid-based movement with sub-tile precision (original Ultima VII engine style).  
* Objects have collision, momentum, and stacking.  
* Gravity applies to loose items (barrels roll down hills, books fall off tables).

Environmental Systems (all interact with objects & NPCs):

* Fire: Spreads realistically to flammable objects; creates light and smoke; can be extinguished with water. Fire causes damage over time and can destroy items permanently.  
* Water: Objects can be submerged (rusts metal, extinguishes fire, dissolves certain reagents).  
* Wind & Weather: Affects loose light objects (papers blow away); dynamic day/night weather influences NPC behavior and visibility.  
* Lighting: Real-time dynamic lighting from torches, candles, fires, and spells. Darkness affects NPC line-of-sight and combat.  
* Sound Propagation: Noises travel and alert nearby NPCs (stealing a plate may wake a sleeping guard).

Destruction & Permanence:

* Most objects can be destroyed or permanently altered.  
* World state is saved per-shard; major changes persist for all players in that persistent world.

---

4\. Container & Inventory System

Unlimited Nesting: Bags inside chests inside barrels inside carts — exactly as in the original.  
Weight & Volume Limits: Enforced on characters and containers.  
Search & Sort: Click-and-drag or auto-sort options.  
Ownership Transfer: Moving an item from an NPC’s container triggers a Virtue check (Stealing \= loss of Truth/Justice).Special Containers:

* Corpses – Lootable with decay timer.  
* Chests & Doors – Lockable/pickable/trappable.  
* Forges, Anvils, Looms, etc. – Functional crafting stations that consume reagents and produce new objects.

---

5\. NPC Schedules & Daily Life AI

Schedule System (directly inspired by original SCHEDULE.DAT):

* Every NPC has up to 8 daily time slots.  
* Example schedule for a blacksmith:  
  * 06:00 – Wake, eat breakfast at home.  
  * 08:00 – Walk to forge, light fire, begin crafting.  
  * 12:00 – Lunch at tavern.  
  * 13:00 – Return to forge.  
  * 18:00 – Dinner at home.  
  * 22:00 – Sleep.

AI Behaviors While on Schedule:

* Pathfinding around dynamic obstacles.  
* Use of world objects (pick up tools, light forge, sit at table).  
* Social interactions (gossip, trade, react to player reputation).  
* Virtue-reactive dialogue and actions.

Emergent Gameplay:

* Follow an NPC all day to discover hidden secrets.  
* Interrupting a schedule (stealing their tools) has consequences.

---

6\. Magic & Spell Interactions with Simulation

* Spells affect the simulation directly (Fireball sets objects on fire; Telekinesis moves distant items; Create Food generates real edible objects).  
* Reagents are physical items that can be stolen, traded, or used in player-crafted spells via modding tools.  
* Magical effects respect physics (a levitated barrel still has momentum when dropped).

---

7\. Combat Interaction Layer

* Real-time with pause-on-inventory.  
* Weapons and spells interact with environment (swing axe to chop door, fire arrow to ignite hay).  
* Environmental kills count toward Virtue tracking (pushing enemy into fire vs. direct murder).

---

8\. Prototype Scope – “Highmere Simulation Vertical Slice”

Must be fully functional in first playable build:

* Every object in Highmere town is interactive with correct properties.  
* Fire spread, water, and lighting fully simulated in the starting area.  
* 20+ NPCs with complete daily schedules.  
* Full container nesting and drag-and-drop.  
* Basic crafting (bake bread, forge dagger, mix potion).  
* Virtue impact from stealing or destroying property clearly visible.

Stretch Goals for Prototype:

* One fully functional dungeon with environmental hazards.  
* Simple player-placed objects persisting in the world.

Success Metric:  
A player can spend 20 minutes doing nothing but picking up, stacking, burning, and combining objects — and still feel they are playing Ultima VII.

---

Appendix: Technical Implementation Notes

* Engine will use a hybrid ECS (Entity Component System) for objects \+ lightweight scripting layer.  
* All simulation state saved in a shard database for persistence.  
* Modding hooks exposed for every property and interaction verb.

This document is the technical soul of the game. All other systems (Virtues, UGC, combat, economy) are built on top of this simulation layer.  

Document \#2: Core Game Design Document (GDD)  
“The Avatar’s Britannia”Project Title: Ultima VII: Project Virtue  
Document Version: 1.0 (Prototype Planning Draft)  
Date: May 2026  
Author: \[Your Name / Design Lead\]  
Status: Living Document – Updated as Prototype Evolves

---

1\. Introduction & Design Philosophy

Ultima VII: Project Virtue is a faithful isometric simulation RPG that recreates the 1992 classic while expanding it into a persistent, player-shaped world. Core Design Mantra:  
“Every object matters. Every choice echoes. Britannia belongs to the Avatar — and to the community that walks beside them.”The game must feel exactly like stepping back into Ultima VII on day one, then gradually reveal its modern depth without ever breaking the original fantasy. No hand-holding tutorials that insult veteran players. No genre shifts. No platformer mechanics.Key Non-Negotiables (from License Alignment Doc \#1):

* Locked isometric perspective  
* Full-screen, mouse-driven interaction  
* Deep object simulation  
* Real-time world with NPC schedules  
* Eight Virtues as central moral system

---

2\. Core Gameplay Pillars

1. Simulation First  
   The world is a physics-and-logic sandbox. Players can pick up, stack, ignite, poison, or combine virtually any object. Environmental interactions (fire spreading, barrels rolling, doors slamming) are fully simulated.  
2. Virtue-Driven Morality  
   Player actions are permanently tracked against the Eight Virtues (Honesty, Compassion, Valor, Justice, Sacrifice, Honor, Spirituality, Humility). Reputation affects NPC dialogue, world events, and long-term story branches.  
3. Open-Ended Freedom  
   Non-linear campaign \+ endless side content. Players can ignore the main quest for dozens of hours and still feel they are “playing Ultima VII.”  
4. Community Creation  
   Every player is a potential world-builder. In-game tools let anyone create and publish quests, dungeons, and stories that become official canon if approved.  
5. Persistent Living World  
   A shared online Britannia where thousands of Avatars coexist, trade, form guilds, and influence global events.

---

3\. World & Setting

* Primary Setting: Classic Britannia (exact 1992 map recreated at launch).  
* Starting Location: Britain (fully interactive town as the vertical-slice prototype hub).  
* Scale at Launch: Original The Black Gate map \+ 3–4 procedurally generated “frontier” regions unlocked via live service.  
* Tone & Atmosphere: Dark fantasy with dry British humor, moral complexity, and Garriott’s signature social commentary. Day/night cycle, dynamic weather, and ambient sound design reinforce immersion.

Lore Integration Rule: All player-created content must respect established canon unless explicitly labeled “Alternate Britannia” mode.

---

4\. Core Mechanics

4.1 Movement & Controls

* Mouse-driven point-and-click (primary).  
* Keyboard hotkeys for power users.  
* Party follows in formation; individual commands available.  
* No auto-pathing that breaks simulation (characters physically walk around objects).

4.2 Interaction System

* Left-click: Examine / Talk / Use.  
* Drag-and-drop: Pick up, combine, equip, drop, throw.  
* Right-click context menu for advanced actions (e.g., “Mix potion,” “Light torch,” “Read book”).  
* Every object has weight, volume, and physical properties.

4.3 Combat

* Real-time tactical combat (original Ultima VII style).  
* Party AI commands: Attack nearest, defend, flank, etc.  
* Pause combat only when inventory or spell book is open.  
* Weapons, spells, and environmental objects all interact (e.g., push barrel onto enemy, set oil slick on fire).

4.4 Magic & Spell System

* Classic rune \+ reagent spellcasting.  
* Spell book interface identical to original.  
* New spells can be added via official patches or player mods.

4.5 Inventory & Containers

* Unlimited container nesting (bags inside chests inside barrels).  
* Weight and volume limits enforced.

4.6 NPC & Dialogue

* Schedule-based AI (NPCs eat, sleep, work).  
* Branching dialogue with Virtue reputation gates.  
* Full voice acting planned for key characters; text for background NPCs.

---

5\. Progression & Economy

* Character Growth: Light leveling (8 levels max) with skill points focused on combat, crafting, and magic.  
* Virtue Reputation: Primary progression system — affects everything from shop prices to epic story outcomes.  
* Crafting & Economy: Full player-driven crafting loop (forge swords, bake bread, mix potions). Persistent online marketplace for trading.  
* Housing: Player-owned homes and guild halls in persistent world.

---

6\. Multiplayer & Persistence

* Single-Player Mode: Fully playable offline with local save.  
* Online Persistent Mode: Seamless drop-in / drop-out. Shared world state persists when players log off.  
* Shard System: Multiple themed shards (Role-Play, Hardcore, Beginner-Friendly) to suit different playstyles.  
* Cross-Player Events: Guardian incursions, Virtue trials, player-voted world changes.

---

7\. User-Generated Content (UGC) & Modding – High-Level

* In-Game Editor (accessible after completing tutorial town):  
  * Place objects, NPCs, triggers, dialogue trees.  
  * Visual scripting \+ optional Lua-like code for advanced creators.  
  * One-click publish with moderation queue.  
* Approval & Monetization: Approved creations can earn creator revenue share. Top creations become “Official Expansions.”

---

8\. Prototype Scope (Vertical Slice – “Britain Alive”)

Deliverable for First Playable Demo (Target: 3–4 months from green-light):

* Fully interactive town of Britain (every object, NPC, and building functional).  
* Complete original opening sequence \+ first major quest.  
* 4-party-member combat system.  
* Basic Virtue tracking visible in real time.  
* Working in-game UGC editor (simple “build a room \+ 3 triggers” demo).  
* 8-player persistent server test (trade items, see each other’s actions).  
* Procedural dungeon generator test (one small dungeon).

Success Criteria for Prototype:  
A journalist or Garriott can play for 30 minutes and say, “This feels exactly like Ultima VII… but I can already see how the community will expand it forever.”

---

Appendix A: Key References

* Original Ultima VII manual & gameplay footage (for pixel-perfect fidelity).  
* Garriott interviews on Virtues and simulation design.  
* Roblox Studio, Unreal Engine 5 Editor, Star Citizen, and No Man’s Sky as technical benchmarks (not visual).

Appendix C: Engine & Stack (canonical)

The finalized stack is: a Rust authoritative server (all simulation, persistence, and rules), a UE5 production client (desktop + PS5 + Xbox), and a TS / PixiJS web thin-client (early prototype + permanent web client). Wire format is Protobuf with codegen for Rust, C++, and TS. The UE5 client is a "dumb view" — it renders state and forwards verbs; it never simulates authoritatively. See Doc \#41 — Engine & Stack ADR for the full decision record.

Appendix B: Open Questions for Lord British  
(Reserved section for Garriott’s direct input on Virtue edge cases, favorite NPCs, etc.)

---

This GDD is deliberately written as a living document. Every section will expand with diagrams, wireframes, and spreadsheets as we move into production.End of Document \#2  

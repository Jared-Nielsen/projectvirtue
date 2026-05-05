Document \#6: Persistent World & Multiplayer Architecture DocumentProject Title: Ultima VII: Project Virtue  
Document Version: 1.0 (Prototype Planning Draft)  
Date: May 2026  
Author: \[Your Name / Technical & Live Ops Design Lead\]  
Status: Living Architecture Reference – Combines design vision with technical implementation

---

1\. Persistent World Vision

Project Virtue delivers the first true persistent Ultima world — a shared, always-evolving Avermere where thousands of Avatars can coexist without breaking the intimate, simulation-driven fantasy of the original Ultima VII.Core Design Rule:  
The world must feel like the single-player Ultima VII you remember… except other living Avatars are walking the same streets, trading at the same shops, and shaping the same history alongside you.Single-player mode remains fully supported and identical in content. Multiplayer is opt-in and enriches rather than replaces the solo experience.

---

2\. Shard & Server Architecture

Shard Types (player-selectable at login):

* Classic Shard – Pure single-player or small private co-op groups (max 8 players). Full offline capability.  
* Virtue Shard – Public persistent world focused on role-play and cooperation. Strong Virtue enforcement.  
* Chaos Shard – Light PvP allowed (consensual duels, guild wars) with reduced Virtue penalties for combat.  
* Beginner / Tutorial Shard – Instanced starting zones with guided onboarding.

Technical Architecture (canonical — see Doc \#41 Engine & Stack ADR):

Shard simulation runs in a Rust authoritative server. UE5 is client-only (production target for desktop + PS5 + Xbox); the TS / PixiJS web thin-client connects to the same Rust shard. UE5 does not host shard logic, world simulation, or persistence — it is a "dumb view" rendering server-authoritative state over a Protobuf wire protocol.


* Hybrid Authoritative Server Model – Game servers handle simulation and physics; dedicated database cluster stores all persistent state.  
* Spatial Partitioning – World divided into “regions” (Highmere, Stonereach, etc.). Only players in the same region see each other unless using global chat or moongates.  
* Instance Layers – Personal housing and player-created dungeons run in private instances that can be visited by friends or made public.  
* Cross-Shard Travel – Limited via special moongates or paid cosmetic “recall scrolls” for friends.

Scalability Target:

* 2,000 concurrent players per major shard at launch, scaling to 10,000+ with live-service updates.

---

3\. Persistence Rules – What Is Saved Forever

| Category | Persistence Level | Examples | Reset Conditions |
| ----- | ----- | ----- | ----- |
| World State | Full (all players) | NPC schedules, fires, placed objects | None (unless server wipe) |
| Player Inventory | Per-player | Gear, gold, reagents | Death penalties optional |
| Housing & Creations | Per-player / Guild | Player homes, UGC dungeons | Owner inactivity (grace period) |
| Virtue Reputation | Global & permanent | All eight Virtues \+ Avatar title | Atonement quests only |
| Economy | Dynamic & shared | Shop prices, resource scarcity | Weekly balancing passes |
| Story Events | Phased & server-wide | Guardian incursions, Virtue trials | Resolved by community vote or time |

Save System:

* Continuous auto-save with 30-second rollback protection.  
* Manual “campfire saves” in single-player or private instances.

---

4\. Multiplayer Features & Social Systems

* Seamless Drop-In / Drop-Out: Join friends via moongate summons or party invites.  
* Cooperative Play: Shared party up to 8 players; Virtue sharing (group reputation affects everyone).  
* Player Housing & Guild Halls: Ownable buildings that function as persistent social hubs.  
* Global & Local Chat: Virtue-filtered channels (e.g., “Honest Discourse” channel requires high Truth score).  
* Dynamic Events: Server-wide Guardian attacks, Virtue festivals, player-voted elections for town mayors.  
* Trading & Economy: Fully player-driven marketplace with physical stalls in towns.

PvP Philosophy:  
Opt-in only. Duels, guild wars, and “Chaos Shard” zones allowed. Killing innocents in Virtue Shards causes massive permanent Virtue loss and potential exile.

---

5\. Anti-Griefing & Virtue Enforcement

* Virtue Watch System: Automated \+ community reporting. Repeated low-Virtue actions trigger temporary or permanent shard exile.  
* Guard & NPC Justice: High-Justice towns have roaming guards that physically arrest players.  
* Reputation Decay: Inactivity slowly restores minor Virtue points to prevent permanent “evil” locking.  
* Moderation Tools: In-game UGC review queue \+ live GMs for extreme cases.

---

6\. Integration with Other Systems

* Simulation (\#4): All environmental interactions (fire, containers, schedules) are fully synchronized across players in the same region.  
* Virtues (\#5): Every multiplayer action feeds the morality engine in real time and is visible to others.  
* World Bible (\#3): Persistent events advance the official lore timeline.  
* UGC (\#7 – next document): Player creations can become permanent world fixtures if they pass Virtue and moderation review.

---

7\. Prototype Scope – “Highmere Persistent Test”

Must be functional in first vertical slice:

* 8-player simultaneous presence in Highmere town.  
* Real-time synchronized simulation (watch another player pick up and move the same barrel you just placed).  
* Shared Virtue impact (steal in front of another player → both see reputation change).  
* Basic trading and chat.  
* One persistent player-placed object (e.g., a signpost or chest) that survives logout.

Success Metric:  
Two players can log in, explore Highmere together, trade items, and feel they are genuinely sharing the same living Ultima VII world.

---

Appendix: Technical Risks & Mitigations

* Server cost scaling → Start with cloud instances and optimize heavily.  
* Griefing → Virtue system is the primary deterrent.  
* Performance → Isometric view \+ spatial partitioning keeps draw calls low.

This architecture turns Avermere from a static map into a living society — the ultimate realization of Lord Avermere’s original vision for a virtuous virtual world.  

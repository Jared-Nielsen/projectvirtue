Document \#11: Prototype Scope & Milestone Roadmap  
(The “Build Bible”)Project Title: Ultima VII: Project Virtue  
Document Version: 1.0 (Prototype Planning Draft)  
Date: May 2026  
Author: \[Your Name / Project Lead\]  
Status: Final Capstone Document – Ties together Documents 1–10 into an executable prototype plan

> See Doc #41 (Engine & Stack ADR) for the canonical engine boundary.

---

1\. Purpose of This Document

This is the single source of truth for what we will actually build and show Richard Garriott. It defines the smallest possible vertical slice that still proves the entire vision: a living, breathing, retro-isometric Ultima VII world that is persistent, simulation-rich, Virtue-driven, and ready for community creation.When this prototype is complete, Garriott should be able to play it and immediately recognize his original masterpiece — while seeing the clear path to a Roblox-scale living platform.

---

2\. Prototype Vision – “Highmere Alive”

Title of Demo: Ultima VII: Project Virtue – Highmere Vertical SliceCore Experience (15–30 minute playable loop):

* Load into the town of Highmere exactly as it appears in 1992 The Black Gate.  
* Every object is fully interactive with real physics and consequences.  
* Meet Lord Avermere, Erevan, and several classic NPCs who react to your Virtue choices.  
* Experience the opening sequence of the original story.  
* Build and publish your first tiny piece of UGC (a 1-room dungeon or simple quest).  
* Play with 1–2 friends in the same persistent town to see shared simulation.

Scope Philosophy:  
Small but deep. We would rather have 100% fidelity in one town than 50% fidelity across the whole map.

---

3\. Must-Have Features (Vertical Slice Scope)

| System (from earlier docs) | Prototype Deliverable | Success Proof |
| ----- | ----- | ----- |
| Simulation (\#4) | Every object in Highmere interactive (physics, fire, containers, combining) | Player can stack barrels, start a fire, and watch it spread realistically |
| Virtues (\#5) | Full tracking \+ visible consequences in Highmere | Steal → guards react; help beggar → reputation changes |
| Persistent World (\#6) | 8-player simultaneous presence in Highmere | See friends moving objects in real time |
| UGC (\#7) | Basic editor: place objects \+ 3 triggers, publish privately | Friend can load your creation instantly |
| Procedural (\#8) | One small procedural dungeon (“Cave of Trials”) | Regenerates with different layout each time |
| Art & Audio (\#10) | Full 1992-style pixel art \+ dynamic lighting \+ original soundtrack | Looks and sounds exactly like Ultima VII |

Out of Scope for Prototype (deferred to Phase 2):

* Full campaign beyond Highmere opening  
* Large-scale economy or guild systems  
* Console versions  
* Advanced modding scripting

---

4\. Milestone Roadmap (12-Week Prototype Build)

Week 0–2: Foundation

* Engine setup \+ isometric renderer  
* Core simulation systems (physics, containers, fire)  
* Highmere town map imported with all objects

Week 3–5: Interaction & Virtues

* Full object interaction verbs  
* Virtue engine \+ NPC reaction system  
* Basic NPC schedules for 15 key Highmere NPCs

Week 6–8: Multiplayer & Persistence

* Networking layer \+ 8-player sync  
* Persistent object state across sessions

Week 9–10: UGC Editor

* In-game creation tools (placement \+ triggers)  
* Publish/playtest loop

Week 11: Polish & Audio

* Final art pass, lighting, SFX, music integration

Week 12: Testing & Garriott Demo Prep

* Internal playtest \+ bug bash  
* 15-minute curated demo build  
* Full documentation package (all 11 documents \+ video walkthrough)

Total Prototype Duration: 12 weeks (3 months) from green-light.

---

5\. Success Criteria for Garriott Review

1. Fidelity Test: Garriott recognizes the game as Ultima VII within 60 seconds of starting.  
2. Simulation Test: He spends 5+ minutes just experimenting with objects and says it feels like the original.  
3. Virtue Test: He sees clear moral consequences and nods in approval.  
4. Community Test: He builds and shares a tiny creation with the team and smiles.  
5. Future Vision Test: He says, “I can see how this becomes the living Avermere I always wanted.”

---

6\. Risk Register & Mitigations

* Risk: Scope creep → Mitigation: Strict “Highmere-only” rule.  
* Risk: Simulation performance → Mitigation: Early profiling every sprint.  
* Risk: Art inconsistency → Mitigation: Style Bible validation tool (Document \#10).  
* Risk: Networking bugs → Mitigation: Start with 2-player tests, scale up.

---

7\. Post-Prototype Next Steps (Assuming Green Light)

1. Full production green-light meeting with Garriott.  
2. Expand to complete The Black Gate campaign (Months 4–12).  
3. First public alpha with limited UGC (Month 13+).  
4. Live service roadmap begins.

---

This concludes the Prototype Bible (Documents 1–11).You now have everything needed to:

* Pitch Richard Garriott with total confidence  
* Hand a complete, professional package to your development team  
* Begin actual prototype production immediately upon license approval

The full set is ready to be compiled into a single polished PDF deck titled “Ultima VII: Project Virtue – Prototype Bible”.  

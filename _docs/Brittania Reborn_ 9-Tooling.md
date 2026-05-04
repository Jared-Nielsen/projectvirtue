Project FORGE – Updated Document \#9  
Technical Design Document (TDD) & Engine/Platform Choice  
(Revised to include Roblox & other UGC-centric platforms)Document Version: 1.1  
Date: May 2026

---

1\. Purpose

This revised TDD now explicitly evaluates Roblox and other UGC/modding-first platforms alongside traditional engines, per your request. The goal is to choose the best foundation for:

* Deep isometric simulation & crafting (Document \#4)  
* Persistent multiplayer world  
* Powerful in-game UGC/modding tools (Document \#7)  
* Faithful retro Ultima VII aesthetic and Virtues system

---

2\. Expanded Platform/Engine Evaluation

| Platform / Engine | Type | Isometric Retro Simulation Depth | Persistent Multiplayer & Matchmaking | UGC / Modding Tools Quality | Visual & Audio Fidelity Control | Development Speed & Cost | Overall Fit for Project FORGE | Score |
| ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| Unreal Engine 5 | Traditional Engine | Excellent (Chaos Physics \+ full control) | Excellent (native replication \+ dedicated servers) | Excellent (in-editor \+ full exposure) | Full control (pixel-art shaders) | Medium | Highest | 9.5 |
| Unity | Traditional Engine | Very Good | Good | Strong | High | Fast | Very Good | 8.0 |
| Godot 4 | Traditional / Open | Excellent for 2D/retro | Improving | Good | High | Very Fast | Good | 7.0 |
| Roblox | UGC Platform | Limited (3D-first, isometric hacks possible) | Built-in (excellent matchmaking) | Best-in-class (native studio tools) | Medium (style constraints) | Extremely Fast | Strong for UGC, weaker for retro simulation | 6.5 |
| Fortnite / UEFN | UGC Platform (Unreal-based) | Good (isometric possible) | Excellent | Excellent | High (but Fortnite aesthetic) | Fast | Good but branding risk | 7.5 |
| Core (Manticore Games) | UGC Platform | Good | Strong | Very Good | Medium-High | Fast | Decent | 6.0 |
| Dreams (Media Molecule) | UGC Platform | Limited | Limited | Excellent creative tools | High artistic | Fast | Too artistic / limited scope | 4.5 |

---

3\. Detailed Analysis of Key Options

Unreal Engine 5 (Still the Strong Recommendation)

* Best balance of simulation depth, retro isometric fidelity, and powerful UGC tools.  
* We can expose the full editor to players for true Roblox-like creation while keeping pixel-art lock and deep simulation.  
* Native tools for persistent servers and matchmaking.  
* No platform fees or style restrictions.

Roblox (Strong UGC Alternative – But Not Recommended as Primary)  
Pros:

* Instant world-class UGC tools and marketplace.  
* Built-in matchmaking and millions of players.  
* Very fast iteration on content.

Cons for Project FORGE:

* Visual style is heavily 3D/cartoon — true retro isometric pixel-art is difficult and often looks out of place.  
* Simulation depth is limited compared to a full engine (physics and object interactions are not as flexible as UE5 Chaos).  
* Platform rules, monetization split, and content guidelines may conflict with a licensed, mature RPG tone and Garriott’s Virtues system.  
* Less control over backend persistence and long-term IP ownership.

Fortnite / UEFN  
Strong middle ground (Unreal-based \+ excellent UGC), but carries Fortnite branding and aesthetic expectations that could dilute the classic Ultima feel.

---

4\. Final Recommendation

Primary Choice: Unreal Engine 5  
We get Roblox-level UGC power plus full control over the retro isometric simulation, Virtues system, and visual fidelity that a licensed Ultima 7 spiritual successor demands.Roblox Option  
Only viable if we decide to build a lighter, more casual version of Project FORGE as a Roblox experience (e.g. a side project or proof-of-concept). It would be faster to prototype but would require significant compromises on art style and simulation depth.Decision:  
We will proceed with Unreal Engine 5 as the main engine, while keeping Roblox-style UGC workflows as the design target (we will replicate the best parts of Roblox inside UE5).

---

5\. Target System Requirements (Unreal Engine 5 Path)

Minimum (1080p / 60 fps Low)

* CPU: Intel i5-8400 / Ryzen 5 2600  
* RAM: 16 GB  
* GPU: GTX 1060 6GB / RX 580  
* Storage: 25 GB SSD

Recommended (1440p / 60–120 fps High)

* CPU: Intel i7-12700 / Ryzen 7 5700X  
* RAM: 32 GB  
* GPU: RTX 3060 / RX 6700 XT  
* Storage: 40 GB NVMe SSD

Console Targets (Phase 2): PlayStation 5 / Xbox Series X|S (equivalent to Recommended).  

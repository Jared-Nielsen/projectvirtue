Project FORGE – Addendum Document  
Crafting & Alchemy MechanicsDocument ID: FORGE-CRAFT-001  
Version: 1.0  
Date: May 2026

---

1\. Philosophy – “Crafting Is Simulation, Not a Menu”

In Project FORGE (the Ultima 7 remake), crafting is not a separate mini-game or crafting table UI.  
It is an emergent extension of the core simulation system (Document \#4).Every crafting action must feel exactly like the original 1992 Ultima VII: you pick up real objects in the world, combine them, apply heat, tools, or magic, and the world reacts physically and logically.Design Rule:  
If it makes sense in a medieval fantasy world, it should work — even if the designers never explicitly planned it.

---

2\. Core Crafting Principles (Faithful to Original Ultima 7\)

* No Crafting Menu — All actions are performed by dragging objects onto each other, onto tools, or onto environmental features (oven, forge, anvil, cauldron).  
* Reagents & Ingredients Are Physical Objects — Flour, water, ore, reagents, herbs, etc. exist as droppable, stealable, storable items.  
* Heat Is Required for Many Recipes — Ovens, forges, campfires, and magical flames are functional environmental objects.  
* Failure States Exist — Wrong combinations can create useless sludge, cause explosions, or poison the player.  
* Quality Matters — Better tools, higher skill, or higher Virtue alignment can improve results.

---

3\. Major Crafting Categories (Original \+ Remake Enhancements)

3.1 Cooking & Baking

* Flour \+ Water → Dough  
* Dough \+ Heat (oven/fire) → Bread  
* Meat \+ Heat → Cooked meat  
* Advanced: Pies, cakes, stews using multiple ingredients in pots/pans.  
* Remake addition: Spoilage timer on raw food (adds realism and Devotion opportunities).

3.2 Smithing & Metalwork

* Ore → Ingot (at forge with heat)  
* Ingot \+ Anvil \+ Hammer → Weapon or armor  
* Can add gems or enchantments for magical variants.  
* Remake addition: Durability and quality tiers that affect combat (ties into simulation).

3.3 Alchemy & Potion Making

* Reagents (mandrake, nightshade, spider silk, etc.) \+ Mortar & Pestle → Mixtures  
* Mixture \+ Heat or specific container → Potion  
* Classic spells-in-a-bottle system preserved.  
* Remake addition: Visible mixing animation \+ failure explosions that can set the lab on fire.

3.4 Miscellaneous / Emergent Crafting

* Thread \+ Loom → Cloth  
* Wood \+ Tools → Furniture or arrows  
* Poison \+ Weapon → Poisoned blade  
* Any object \+ Spell (e.g. “Create Food”) → Magical variants

---

4\. Technical Implementation Rules

* Every recipe is defined as a combination rule in the simulation database (no hard-coded crafting list).  
* The system scans for:  
  * Ingredients present  
  * Correct tool/environment (forge, oven, etc.)  
  * Player skill / Virtue bonus  
* All crafted items become fully simulated objects (can be dropped, stolen, burned, etc.).  
* UGC creators can add new recipes via the editor (Document \#7).

---

5\. Integration with Other Systems

* Virtues (\#5): High Devotion players may receive free ingredients from grateful NPCs. Low Truth players risk being caught stealing reagents.  
* Simulation (\#4): Crafted items obey full physics and environmental rules (a fresh loaf can be set on fire or eaten by rats).  
* Persistent World (\#6): Crafted goods can be traded in the player economy.  
* UGC (\#7): Players can publish new recipes and crafting stations.  
* Art & Audio (\#10): Every crafting action has satisfying chunky SFX and particle feedback that matches the 1992 feel.

---

6\. Prototype Scope for “Highmere Alive”

* Functional forge, oven, and alchemy lab in Highmere.  
* At least 8 working recipes (bread, dagger, basic healing potion, etc.).  
* Visible crafting animations and failure states.  
* Items created in the prototype remain fully simulated (can be dropped, traded with friends, or used in combat).

---

This document serves as the official crafting reference for Project FORGE. It stays 100% faithful to the original Ultima VII while giving the simulation enough depth to support decades of player creativity.  

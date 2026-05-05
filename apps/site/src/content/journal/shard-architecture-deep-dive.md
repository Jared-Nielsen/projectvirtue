---
title: 'Shard Architecture Deep Dive'
excerpt: 'A look at how Order shards, Chaos shards, and GM-hosted campaigns share infrastructure but diverge sharply on rules, latency, and player density.'
date: '2026-04-21'
author: 'Josh'
tags:
  - engineering
  - architecture
category: 'dev-update'
---

A "shard" in our terminology is a self-contained instance of Sosaria — a complete world with its own population, economy, history, and tick cadence. We launch with two flavors that share infrastructure but disagree on the rules.

Order shards enforce the virtue system as a hard ruleset. PvP is consensual or arena-bounded. Looting is restricted. Reputation is sticky. These are the canonical Britannia experience.

Chaos shards remove the velvet rope. Open PvP, full looting, reduced virtue rewards. Same world, different social contract. They're also the source of the most talked-about emergent stories.

Then there's GM mode: a private shard hosted by a single player for six to eight friends, running a curated campaign over multiple sessions. Per Doc #42, GM mode is a first-class shard kind, not an afterthought.

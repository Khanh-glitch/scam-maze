---
inclusion: auto
name: product
description: "SCAMMAZE product definition, players, core loop and product principles. Use when designing features, scenarios, UI copy or anything that changes what the player experiences."
---

# SCAMMAZE product

Canonical definition: #[[file:docs/product/PRODUCT_POSITIONING.md]]. If anything here disagrees
with it, that document wins. AGENTS.md (always loaded) holds the hard rules; this file is the
working summary.

## What it is

A browser-based, first-person 3D narrative game in a small, persistent, fictional world. Scams
reach the player the way they do in life: through an in-game smartphone (calls, messages, a bank
app) and through people and devices in the world (for example a laptop in the player's room). Chapters are self-contained stories in the same world.

North star: a safe, living world where people learn to spot scams before facing them in real life.

## Players

- Everyday people in Vietnam and worldwide, with equal weight (see `audience.md`). Not security
  experts. Many play on laptops without a strong GPU.
- Game UI in English (default and fallback) and Vietnamese. Repository content in English.

## Core loop

physical world, then digital interaction, then investigation, then decision, then consequence,
then learning (debrief). Chapter 1 ("The Urgent Call", narrative subtitle "The False Victory") is the implemented
reference: a first scam call the player can reject, then a second scam that looks like the fix,
evidence in the player's room (laptop, phone records, papers), combining clues into
deductions, independent verification, one of four endings (`false-victory`, `perfect-chain`,
`break-the-chain`, `unfinished-case`) and a forensic debrief built from the event log. It is
covered by automated tests; no human has playtested it yet.

## Principles

- The 3D world is the experience. Do not drift back to the old 2D "simulated Internet" concept,
  a quiz, a chatbot with a 3D background or a URL scanner.
- Teach by consequence, never by shame. Risky choices lead to an honest, non-graphic outcome and a
  clear explanation of the warning signs.
- Deterministic core: outcomes come from authored rules, never from AI. AI is optional, may only
  propose wording, and the game must work offline without it.
- Fictional everything: brands, people, phone numbers (`+000...`), reserved domains (`.test`,
  `.example`, `.invalid`). Never "safe" as a verdict (see `safety.md`).
- Small scope done well: one neighborhood, one apartment and a few showcase maps (`/ueh`, `/hue`, `/mientay`) over an
  open world. Stylized realism; no horror direction.

## Value proposition

Practice spotting manipulation under realistic social pressure (urgency, authority, isolation)
without real risk, then see exactly which signals were there.

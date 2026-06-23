# VITNESS — Project Write-up

*Qubika World Cup Challenge 2026 · Fan Experience track · by Martín Barea*

## The problem we tried to solve

Watching a World Cup on a second screen is strangely lonely and forgettable. You half-watch, you scroll, the goals blur together, and a week later you can't remember who set up what. The thing that used to make a tournament *stick* — the sticker album, the "I was there" feeling — is something you buy at a kiosk, disconnected from the matches you actually lived. I wanted to rebuild that feeling around attention: make *watching well* the thing that earns the album.

## What we built

VITNESS is a second-screen companion that turns each key play into a tiny game. A goal happens → the app redraws it as an anonymized 2D reconstruction on a pitch → you prove you were paying attention by naming who was in the play → correct answers (graded on the server, never in the client) earn coins and sticker packs. Packs tear open with a physical drag gesture and the cards land in per-country albums — 22-player squads for every nation — plus a Golazos shelf of legendary real goals you can replay. Every card is "VITNESSED": stamped with how you earned it. The whole thing runs on Supabase (Postgres + RLS + edge functions + realtime) with an Expo app that ships to web and native from one codebase, and a replay engine that streams a recorded match into the stack so the live experience is demoable with zero external feed.

## How we used AI to build it

This project is, honestly, a demonstration of building *with* AI more than anything else — it was built almost entirely through **Claude (Opus) in Claude Code**, on Qubika's Agentic Framework.

- I delegated the **server-authoritative core** — schema, RLS, the `open_pack` roll, and the `submit-answer` grader that keeps the trivia answer key off the client — and Claude got the security model right (the kind of thing that's easy to fumble under time pressure).
- The **animation-heavy front-end** — a Reanimated drag-to-tear pack opening and an SVG pitch that animates players from a `PlayScript` — came together far faster than I'd have managed alone, including a long debugging session chasing a yellow rendering artifact at the pack's tear seam (it turned out to be an emoji's anti-aliased colour bleeding through a clip mask).
- The most fun surprise: when each country album needed a full 22-man squad, I **fanned the work out to a fleet of Claude subagents in parallel**, each authoring a few nations, then wrote a deterministic validation pass to catch their duplicate players and shirt-number collisions before seeding. Treating AI as a *swarm + a verifier* beat both doing it by hand and trusting a single model's output.
- In-product, the architecture is designed around Claude too: the "La Mesa" AI pundit personas and a live play-composition pipeline that turns a raw goal event into an animatable reconstruction. Those are scaffolded (the demo runs on hand-authored and real StatsBomb data) — a deliberate call to keep the experience fully playable without a live model in the loop.

## What we'd do next with another week

- **Wire the in-product AI for real** — turn the `personas` and `compose-play` skeletons into live Claude calls so pundits react to events and any goal auto-composes into a reconstruction, with a deterministic fallback.
- **Trading** — the album already records provenance ("VITNESSED · 76' ARG–MEX"); the natural next loop is trading the duplicates you earned for moments you missed.
- **Live data** — swap the replay engine for a real fixture feed during the tournament.
- **Polish the squads** — replace best-effort rosters with verified, up-to-date 26-player lists and kits per nation.

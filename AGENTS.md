# AGENTS.md — repository rules

This repository hosts more than one game. Keep them separate:

- `/` (root, `src/`, `tools/`): **Prehistoric Off-Road** racing prototype. See `README.md`, `DESIGN.md`.
- `elsewhere/`: **The Elsewhere** (Chapter One). Self-contained Vite + TypeScript + Three.js project with
  its own `package.json`/lockfile. Do not import between the two projects or share build output.

## The Elsewhere — permanent delivery rule

Every playable update to `elsewhere/` must ship with:

1. An updated **playable ZIP** in `elsewhere/releases/` (built by `cd elsewhere && npm run build && npm run package`),
   containing a self-contained `PLAY.html`, the prebuilt `dist/`, source + lockfile, `README.md`, `LAUNCH.txt`
   and the `evidence/` folder.
2. **Exact launch instructions** (in `LAUNCH.txt` and `elsewhere/README.md`): what to open, what runtime is
   required (none for `PLAY.html`; Node for the dev server), and how a phone reaches a desktop-served build
   (LAN address, not `localhost`).
3. **Current screenshots** from the running build at the key moments of the scene, captured by
   `npm run walkthrough` (never reuse captures from an older build), plus the walkthrough `report.json`.
4. A written list of **testing limitations** (`elsewhere/TEST_REPORT.md`): what was run, in which
   environments, what was not tested (e.g. physical phones, Safari, real audio output), and known visual issues.

Also for `elsewhere/`:

- `elsewhere/design/` is the immutable design input (V3.1 chapter archive + handoff). Never edit it; the
  slice's own configuration lives in `elsewhere/src/config/`.
- Do not call art "approved" on the owner's behalf; report visual mismatches against
  `elsewhere/design/references/` honestly.
- Keep the build identifier in `elsewhere/src/config/buildInfo.ts` in step with the release ZIP name and
  the start/about screen.

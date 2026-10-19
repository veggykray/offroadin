# Design inputs (immutable)

This folder holds the handoff pack exactly as supplied. Nothing in here is edited by the build.

- The outer handoff ZIP itself is not duplicated here (11 MB); every file it contained is retained below unchanged.
- `the_elsewhere_chapter_one_v3_1_corrected.zip` — unchanged V3.1 chapter baseline
  (sha256 `9f9927e6505150aedc31b56744db8e93aadd432f72c1daac4cb36c459b4706e7`, matches `manifest.json`).
- `chapter_one_v3_1/` — plain extraction of that archive for reading (canonical JSON, atlas, walkthrough, blueprint, QA).
- `references/` — the three concept PNGs (visual direction only, not textures or rigs).
- `01_CODEX_FIRST_PLAYABLE_PROMPT.txt`, `02_VISUAL_REFERENCE_NOTES.txt`, `00_READ_ME_FIRST.txt`, `manifest.json`.

The playable slice's own configuration lives in `src/config/p2Slice.ts`, separate from this chapter source.

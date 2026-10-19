THE ELSEWHERE — CHAPTER ONE — V3.1
DOCUMENTATION & DIAGRAM REPAIR / GAME DESIGN FROZEN

This package supersedes V3. The island coordinates, route endpoints, route gates,
actor restrictions, fall destinations, puzzle order and 78-minute design estimate
are unchanged. This is not a new expansion or a new mechanics pass.

START HERE
  00_INTERACTIVE_ATLAS_v3_1.html — offline, self-contained island and route atlas.
  VERTICAL_ROUTES_v3_1.png — explicit source/destination diagrams, one per route.
  FLOOR_0_v3_1.png ... FLOOR_3_v3_1.png — corrected labelled floor maps.
  ALL_FLOORS_OVERVIEW_v3_1.png — compact overview, not the full reading resolution.
  01_WORLD_ATLAS_v3_1.txt — islands, route definitions and inhabitants.
  02_CHAPTER_WALKTHROUGH_v3_1.txt — puzzle solutions and optional objectives.
  03_MECHANICAL_BLUEPRINT_v3_1.txt — rules, circuits, state and mobile requirements.
  05_CORRECTIONS_v3_1.txt — issue-by-issue repair record and scope.
  06_QA_REPORT_v3_1.txt — checks run on THIS package and their limitations.

REBUILD / VERIFY (Python 3)
  python rebuild_v3_1.py
  python validate_design_v3_1.py
  python validate_diagrams_v3_1.py
  python test_atlas_browser_v3_1.py

Rebuild uses only the corrected canonical JSON beside the script; it does not
load V1 or V2 files. Rebuild dependencies: Pillow and CairoSVG. Diagram tests
also use Shapely. Browser tests use Playwright and an installed Chromium.
No external website or font download is used by the atlas.

CANONICAL SOURCE
  chapter_one_canonical_v3_1.json
  puzzle_sequences_v3_1.json is a generated view, not another editable authority.
  SVG files are shared by the PNG exporter and the interactive atlas.
  diagram_geometry_v3_1.json exposes line/label/card geometry for inspection.

STATUS
Static design and rendered-diagram checks are not an exhaustive gameplay proof.
P1–P4 still need a greybox playtest; exact navigation geometry, guardian behaviour,
White's following and fear states, dynamic liquids and mobile performance remain
runtime work. No new core mechanics are requested in this correction.

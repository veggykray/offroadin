// Build the release ZIP: PLAY.html + dist/ + source + lockfile + README + evidence.
// usage: node tools/package.mjs   (run `npm run build` and the walkthroughs first)
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, cpSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
const build = readFileSync('src/config/buildInfo.ts', 'utf8').match(/BUILD_ID = '([^']+)'/)[1];
const name = `elsewhere_first_rise_${build}`;
const stageRoot = join(tmpdir(), 'elsewhere_release'); const stage = join(stageRoot, name);
rmSync(stage, { recursive: true, force: true }); mkdirSync(stage, { recursive: true });
if (!existsSync('dist/PLAY.html')) throw new Error('dist/PLAY.html missing — run npm run build');
cpSync('dist/PLAY.html', join(stage, 'PLAY.html'));
cpSync('dist', join(stage, 'dist'), { recursive: true });
for (const f of ['src', 'test', 'tools', 'index.html', 'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'README.md', 'TEST_REPORT.md', 'ASSET_PROVENANCE.md']) if (existsSync(f)) cpSync(f, join(stage, f), { recursive: true, filter: (s) => !s.includes('tools/out') });
if (existsSync('evidence')) cpSync('evidence', join(stage, 'evidence'), { recursive: true, filter: (s) => !s.includes('video_raw') });
writeFileSync(join(stage, 'LAUNCH.txt'), `THE ELSEWHERE — First Rise test — build ${build}

QUICKEST: double-click PLAY.html (self-contained, no install, no server).
  Works in current Chrome, Edge, Firefox and Safari from the local file. If a browser blocks WebGL for
  local files, use the served option below.

SERVED (for phones on the same Wi-Fi):
  1. Install Node.js 18+ (https://nodejs.org) if you do not have it.
  2. In this folder run:  npx --yes serve dist      (or: python3 -m http.server 8000 --directory dist)
  3. Open the printed address on the desktop, or on the phone use the DESKTOP'S LAN address
     (e.g. http://192.168.1.23:3000), not "localhost" — localhost on the phone is the phone itself.

FROM SOURCE:  npm install && npm run dev   (Vite dev server on port 5174)

Controls: tap ground to walk; tap objects to use them; portraits switch dog/cat (also across floors);
drag to pan; pinch/wheel to zoom; ↺ reset; speaker = mute; ❚❚ pause; press G for the plain-geometry dev view.

Evidence: evidence/ (screenshots, walkthrough video, report.json per viewport), TEST_REPORT.md.
`);
mkdirSync('releases', { recursive: true });
const zip = join('releases', name + '.zip');
rmSync(zip, { force: true });
execFileSync('zip', ['-qr', resolve(zip), name], { cwd: stageRoot });
console.log('wrote', zip);

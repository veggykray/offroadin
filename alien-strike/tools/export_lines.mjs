// Evaluates the game's data + level scripts in Node and prints every voice line as JSON.
import fs from 'fs'; import vm from 'vm'; import path from 'path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
globalThis.window = globalThis;
const files = ['src/core/util.js', 'data/voice.js', 'data/structures.js', 'levels/levels.js', ...Array.from({ length: 10 }, (_, i) => 'levels/world' + String(i + 1).padStart(2, '0') + '.js')];
for (const f of files) vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
const out = {};
for (const [id, L] of Object.entries(globalThis.AS.Data.voice)) out[id] = { t: L.t, s: L.s };
process.stdout.write(JSON.stringify(out, null, 1));

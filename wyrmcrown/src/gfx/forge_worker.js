/* WYRMCROWN — background sprite forging.
 * Loads the same model code as the page and forges creature frames on an
 * OffscreenCanvas, so a sheet seen for the first time does not stall a frame.
 * Each job names a recipe (model generator + plain-data arguments) and one
 * direction / animation phase; the frame (and for the first phase the direction's
 * shadow silhouette) goes back as an ImageBitmap. See AS.Forge.useWorkers. */
'use strict';
self.window = self; self.AS = self.AS || {};
const LIBS = [
  '../../../alien-strike/src/core/util.js',
  '../../../alien-strike/src/gfx/forge.js', '../../../alien-strike/src/gfx/models.js', '../../../alien-strike/src/gfx/models4.js',
  '../../data/palettes.js', '../../data/factions.js', '../../data/buildings.js', '../../data/sites.js',
  'materials.js', 'dragon_art.js', 'models_nature.js', 'models_human.js', 'models_elf.js', 'models_ice.js', 'models_undead.js',
  'models_units.js', 'models_beasts.js', 'models_beasts2.js', 'models_giants.js', 'models_landmarks_realm.js', 'models_town_extra.js', 'models_sites.js', 'models_world.js',
];
const failed = [];
for (const f of LIBS) { try { importScripts(f); } catch (e) { failed.push(f + ': ' + e.message); } }
const core = ['util.js', 'forge.js', 'materials.js'];
const ok = !failed.some((f) => core.some((c) => f.indexOf(c + ':') >= 0));
self.postMessage({ type: 'ready', ok, failed });
const models = new Map(); // recipe key → model, most recent last
self.onmessage = (e) => {
  const m = e.data;
  if (m.type !== 'frame') return;
  try {
    let model = models.get(m.key);
    if (model) models.delete(m.key);
    else { const r = m.recipe; model = AS.Models[r.gen](r.pal, r.opt); }
    models.set(m.key, model);
    if (models.size > 24) models.delete(models.keys().next().value);
    const t0 = performance.now(), f = AS.Forge.renderModel(model, m.angle, m.anim, { res: m.res }), ms = performance.now() - t0;
    const shadow = m.shadow ? AS.Forge.silhouette(f.img, m.blur).transferToImageBitmap() : null;
    const img = f.img.transferToImageBitmap();
    self.postMessage({ type: 'frame', id: m.id, img, shadow, ms }, shadow ? [img, shadow] : [img]);
  } catch (err) { self.postMessage({ type: 'frame', id: m.id, err: String(err && err.message || err) }); }
};

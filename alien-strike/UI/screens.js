/* ALIEN STRIKE — menus and screens (DOM), plus the animated menu backdrop and
 * the procedural planet renderer used by the menu, mission select and briefing. */
'use strict';
(function (AS) {
  const U = AS.U, TAU = U.TAU;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const h = (tag, attrs, ...kids) => {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== false && attrs[k] !== undefined && attrs[k] !== null) e.setAttribute(k, attrs[k]);
    }
    for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) e.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    return e;
  };
  const btn = (label, fn, cls, sub) => {
    const b = h('button', { class: 'btn ' + (cls || ''), onclick: (e) => { AS.Audio.sfx('ui_click'); fn(e); }, onmouseenter: () => AS.Audio.sfx('ui_hover') }, label);
    if (sub) b.appendChild(h('span', { class: 'sub' }, sub));
    return b;
  };

  /* ---------------- procedural planets ---------------- */
  const Planet = {
    tex: {},
    texture(world) {
      if (this.tex[world.id]) return this.tex[world.id];
      const T = new AS.Terrain(world, { w: 3600, h: 1800, seed: 3, zones: [] });
      const cv = T.buildMap(20);
      const ctx = cv.getContext('2d');
      const data = ctx.getImageData(0, 0, cv.width, cv.height);
      this.tex[world.id] = { w: cv.width, h: cv.height, d: data.data };
      return this.tex[world.id];
    },
    render(ctx, world, cx, cy, R, rot) {
      const tx = this.texture(world);
      const img = ctx.createImageData(R * 2 + 8, R * 2 + 8);
      const D = img.data, W = R * 2 + 8;
      const sky = U.C.hex(world.sky[1]);
      const L = [-0.55, -0.45, 0.7];
      for (let y = -R - 4; y < R + 4; y++) for (let x = -R - 4; x < R + 4; x++) {
        const d2 = x * x + y * y, q = ((y + R + 4) * W + (x + R + 4)) * 4;
        const rr = Math.sqrt(d2);
        if (rr > R + 3) continue;
        if (rr > R) { const a = (1 - (rr - R) / 3) * 0.6; D[q] = sky[0]; D[q + 1] = sky[1]; D[q + 2] = sky[2]; D[q + 3] = a * 255; continue; }
        const nx = x / R, ny = y / R, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        const lon = Math.atan2(nx, nz) + rot, lat = Math.asin(ny);
        let u = (lon / TAU) % 1; if (u < 0) u += 1;
        const v = lat / Math.PI + 0.5;
        const ti = (Math.min(tx.h - 1, Math.floor(v * tx.h)) * tx.w + Math.floor(u * tx.w)) * 4;
        let lum = Math.max(0.05, nx * L[0] + ny * L[1] + nz * L[2]);
        lum = 0.12 + lum * 1.05;
        const rim = Math.pow(1 - nz, 3) * 0.8;
        D[q] = Math.min(255, tx.d[ti] * lum + sky[0] * rim); D[q + 1] = Math.min(255, tx.d[ti + 1] * lum + sky[1] * rim); D[q + 2] = Math.min(255, tx.d[ti + 2] * lum + sky[2] * rim); D[q + 3] = 255;
      }
      ctx.putImageData(img, Math.round(cx - R - 4), Math.round(cy - R - 4));
    },
    thumb(world, size) {
      const cv = AS.Forge.canvas(size, size);
      this.render(cv.getContext('2d'), world, size / 2, size / 2, size / 2 - 4, world.id * 0.7);
      return cv;
    },
  };
  AS.Planet = Planet;

  /* ---------------- menu backdrop (drawn on the game canvas) ---------------- */
  const Backdrop = {
    buf: null, stars: [], t: 0, world: null, craftT: 0,
    init() {
      this.buf = AS.Forge.canvas(480, 270);
      this.stars = [];
      for (let i = 0; i < 260; i++) this.stars.push({ x: Math.random() * 480, y: Math.random() * 270, b: Math.random(), s: Math.random() < 0.08 ? 2 : 1, tw: Math.random() * 6 });
      this.planetBuf = AS.Forge.canvas(480, 270);
    },
    setWorld(w) { this.world = w; this.lastRot = null; },
    draw(dt) {
      if (!this.buf) this.init();
      this.t += dt;
      const c = this.buf.getContext('2d');
      const w = this.world || AS.Data.worlds[0];
      const grd = c.createLinearGradient(0, 0, 480, 270);
      grd.addColorStop(0, '#03060a'); grd.addColorStop(0.6, '#070d14'); grd.addColorStop(1, U.C.css(w.sky[0], 0));
      c.fillStyle = grd; c.fillRect(0, 0, 480, 270);
      // nebula
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = 0.18; c.drawImage(AS.Forge.glow(w.sky[1], 64), 230, -40, 300, 260);
      c.globalAlpha = 0.1; c.drawImage(AS.Forge.glow('#5a7aff', 64), -60, 120, 280, 200);
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      for (const s of this.stars) { c.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(this.t * 0.6 + s.tw)) * s.b; c.fillStyle = '#dfefff'; c.fillRect(Math.round(s.x - this.t * 2 * s.b) % 480 < 0 ? Math.round(s.x - this.t * 2 * s.b) % 480 + 480 : Math.round(s.x - this.t * 2 * s.b) % 480, s.y, s.s, s.s); }
      c.globalAlpha = 1;
      // planet (re-rendered a few times a second)
      const rot = this.t * 0.05;
      if (this.lastRot === null || Math.abs(rot - this.lastRot) > 0.004) {
        const pc = this.planetBuf.getContext('2d'); pc.clearRect(0, 0, 480, 270);
        Planet.render(pc, w, 360, 150, 96, rot); this.lastRot = rot;
      }
      c.drawImage(this.planetBuf, 0, 0);
      // craft flyby
      this.craftT += dt;
      const sh = AS.Forge.sheet('craft:menu', () => AS.Models.craft({ speed: 1, armor: 1 }), 48, 1);
      const k = (this.craftT % 16) / 16;
      const cx = -40 + k * 560, cy = 200 - k * 90 + Math.sin(this.craftT * 1.5) * 4;
      const ang = Math.atan2(-90, 560);
      const fi = AS.Forge.frameIndex(sh, ang);
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.6;
      c.drawImage(AS.Forge.glow('#5fe6ff', 32), cx - 30, cy - 12, 24, 24); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      c.drawImage(sh.frames[0][fi], Math.round(cx - sh.ax), Math.round(cy - sh.ay - 10), sh.w, sh.h);
      // present
      const R = AS.Renderer, ctx = R.ctx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const W = R.canvas.width, H = R.canvas.height;
      const sc = Math.max(W / 480, H / 270);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.buf, (W - 480 * sc) / 2, (H - 270 * sc) / 2, 480 * sc, 270 * sc);
      ctx.imageSmoothingEnabled = true;
    },
  };

  /* ---------------- mission briefing: data, sprite portraits, tactical map ----------------
   * Everything here reads the mission data directly (no game instance): objective map
   * points come from the entity ids the objectives reference, threat cards from the unit
   * kinds placed in the mission, portraits from the game's own sprite models and the map
   * from the mission's terrain generator, built a few rows per frame so the screen opens
   * instantly and the map "scans in". */
  const BF = {
    COL: { p: '#ffc35a', s: '#7fe8ff', h: '#ffd36b', ok: '#7dff9a', bad: '#ff6a4a', mark: '#e6f0f5', dark: '#05090d' },
    DANGER: [['LOW', '#7dff9a'], ['GUARDED', '#c9ef6a'], ['ELEVATED', '#ffc35a'], ['HIGH', '#ff8f3a'], ['EXTREME', '#ff4f3a']],
    CLS: { creature: 'Creature', infantry: 'Infantry', air: 'Aircraft', vehicle: 'Armour' },
    ATK: { leap: 'Leaping melee', melee: 'Melee', acid: 'Acid spit', bullet: 'Kinetic guns', plasma: 'Plasma bolts', missile: 'Homing missiles', flak: 'Flak', lightning: 'Arc lightning', beam: 'Lance beam', shell: 'Artillery', spore: 'Spore lobs', burst: 'Burst fire', bomb: 'Bombs' },
    F: (px, w) => (w || 600) + ' ' + px + 'px "Chakra Petch", "Share Tech Mono", sans-serif',

    /* entities placed at mission start, and ones spawned later by triggers */
    flat(a, out) { for (const e of [].concat(a || [])) { if (Array.isArray(e)) this.flat(e, out); else if (e && typeof e === 'object') out.push(e); } return out; },
    ents(m) { return this.flat(m.entities, []); },
    lateEnts(m) { const out = []; for (const t of m.triggers || []) for (const a of [].concat(t.do || [])) if (a && a.spawn) this.flat(a.spawn, out); return out; },

    /* objectives as the briefing shows them: numbered primaries, lettered optionals */
    objectives(m) {
      const byId = {};
      for (const e of this.ents(m).concat(this.lateEnts(m))) if (e.id && !byId[e.id]) byId[e.id] = e;
      const pts = (o) => {
        const out = [];
        if (o.noMarker) return out;
        const add = (id) => { const e = byId[id]; if (e && isFinite(e.x) && isFinite(e.y)) out.push({ x: e.x, y: e.y }); };
        [].concat(o.targets || [], o.groups || [], o.items || []).forEach(add);
        if (o.zone && o.type !== 'discover') add(o.zone);
        if (o.target) add(o.target);
        if (o.convoy) add(o.convoy);
        for (const q of o.points || []) if (q && isFinite(q.x)) out.push({ x: q.x, y: q.y });
        return out;
      };
      const all = m.objectives || [], prim = [], sec = [];
      for (const o of all) {
        if (o.cat === 'hidden' || o.locked) continue;
        const it = { id: o.id, cat: o.cat === 'secondary' ? 's' : 'p', text: o.short || o.text, reward: o.reward || 0, pts: pts(o) };
        // the long objective text doubles as a description only when it says something the short one does not
        const wds = (x) => String(x || '').toLowerCase().match(/[a-z0-9']{3,}/g) || [];
        const extra = wds(o.text).filter((x) => !wds(o.short).includes(x)).length;
        it.desc = o.desc || (o.short && extra >= 2 ? o.text : '');
        if (it.cat === 'p') { it.tag = String(prim.length + 1); prim.push(it); } else { it.tag = String.fromCharCode(65 + sec.length); sec.push(it); }
      }
      return {
        prim, sec,
        lockedP: all.filter((o) => o.locked && o.cat !== 'secondary' && o.cat !== 'hidden').length,
        lockedS: all.filter((o) => o.locked && o.cat === 'secondary').length,
        hidden: all.filter((o) => o.cat === 'hidden').length,
      };
    },

    /* distinct hostile (and allied) unit kinds in the mission, most dangerous first */
    threats(m) {
      const D = AS.Data.enemies || {}, B = (AS.Bosses && AS.Bosses.DEFS) || {};
      const seen = new Map();
      const add = (k, boss, team, late) => {
        if (!k || seen.has(k)) return;
        const def = boss ? B[k] : D[k];
        if (!def || !def.name) return;
        seen.set(k, { k, def, boss: !!boss, late: !!late, ally: team === 'player' || def.team === 'player' });
      };
      const scan = (list, late) => {
        for (const e of list) {
          if (e.t === 'boss') add(e.k, true, null, late);
          else if (e.t === 'unit' || (e.t === 'scatter' && e.what === 'unit')) add(e.k, false, e.team);
          else if (e.t === 'convoy') for (const u of e.units || []) add(typeof u === 'string' ? u : u && u.k, false, e.team);
        }
      };
      scan(this.ents(m), false);
      if (m.reinforcements) for (const sq of m.reinforcements.squads || []) for (const k of [].concat(sq)) add(k);
      scan(this.lateEnts(m), true);
      const rank = (t) => (t.boss ? 100 : 0) + (t.def.elite ? 10 : 0) + (t.def.threat || 0);
      return [...seen.values()].sort((a, b) => (a.ally - b.ally) || rank(b) - rank(a));
    },
    /* attach the briefing's own threat lines to the matching cards; return the lines no card covers */
    describe(list, lines) {
      const used = new Set(), mentioned = new Set();
      const STOP = /^(the|choir|drone|drones|tank|tanks|battery|unit|units|frc|deep|mouth|of|and|with|a|an|in|on|at)$/i;
      const DASH = /\s[—–]\s|\s-\s/;
      const cap = (x) => x.charAt(0).toUpperCase() + x.slice(1);
      const stem = (x) => x.toLowerCase().replace(/s$/, '');
      const keys = (t) => t.def.name.split(/[\s,]+/).map((x) => x.replace(/[^a-z'-]/gi, '')).filter((x) => x.length >= 3 && !STOP.test(x)).map(stem);
      // a unit is named by its head noun ("Hive Warrior" -> warrior), as a whole word, singular or plural
      const word = (k) => new RegExp('\\b(' + k.replace(/[-']/g, '\\$&') + '|' + k.replace(/[-']/g, '\\$&') + 'e?s|' + k.replace(/y$/, 'ies').replace(/[-']/g, '\\$&') + ')\\b', 'i');
      for (const t of list) { t.keys = keys(t); t.head = t.keys.length ? word(t.keys[t.keys.length - 1]) : null; }
      for (const t of list) {
        if (t.late && t.boss) continue; // a boss that surfaces mid-mission stays a mystery
        if (!t.head) continue;
        lines.forEach((x, i) => { if (t.head.test(String(x))) mentioned.add(i); });
        for (let i = 0; i < lines.length; i++) {
          if (used.has(i)) continue;
          const raw = String(lines[i]), L = raw.toLowerCase();
          if (!t.head.test(raw)) continue;
          mentioned.add(i);
          const parts = raw.split(DASH);
          let d = parts.length > 1 ? parts.slice(1).join(' — ') : '';
          if (!d) { // a plain line describes this unit only if it leads with it, says more than its name and lists no other unit
            const toks = L.replace(/[^a-z' -]/g, ' ').split(/\s+/).filter((x) => x && !STOP.test(x));
            const mine = (x) => t.keys.some((k) => x.startsWith(k));
            const others = list.some((o) => o !== t && o.head && o.head.test(raw));
            if (toks.length && mine(toks[0]) && toks.filter((x) => !mine(x)).length >= 2 && !others) d = raw;
          }
          if (d) { t.desc = cap(d); used.add(i); break; }
        }
      }
      for (const t of list) if (t.late && t.boss) {
        const i = lines.findIndex((x, j) => !used.has(j) && /unknown|unidentified|contact|signature/i.test(x));
        if (i >= 0) { const parts = String(lines[i]).split(DASH); t.desc = cap(parts.length > 1 ? parts.slice(1).join(' — ') : String(lines[i])); used.add(i); }
      }
      return lines.filter((_, i) => !used.has(i) && !mentioned.has(i));
    },
    traits(def) {
      const out = [this.CLS[def.cls] || 'Contact'];
      if (def.weapon && this.ATK[def.weapon.k]) out.push(this.ATK[def.weapon.k]);
      return out.join(' · ');
    },

    /* sprite portrait: body + turret composited the way the renderer stacks them,
     * then cropped to the opaque pixels so every unit fills its frame */
    portrait(cv, def, world, o) {
      o = o || {};
      try {
        const md = def.model;
        if (!md || !AS.Models[md.gen]) return false;
        const pal = AS.Art.pal(md.pal, world);
        const model = AS.Models[md.gen](pal, md.opt || {});
        const size = ((model.r || 10) * 2 + (model.h || 10)) * (model.scale || 1);
        const res = Math.max(2, Math.min(8, Math.ceil(cv.width * 1.6 / Math.max(8, size))));
        const ang = o.ang !== undefined ? o.ang : 2.35;
        const parts = [{ f: AS.Forge.renderModel(model, ang, 0, { res }), z: 0 }];
        if (def.gun) {
          const alt = AS.ArtMap && AS.ArtMap.gen('gun');
          const gen = def.gun.gen && AS.Models[def.gun.gen] ? def.gun.gen : alt ? alt.gen : 'gun';
          if (AS.Models[gen]) {
            let gz = md.gen === 'boat' ? 6 : 7;
            if (md.opt && md.opt.size) gz *= md.opt.size;
            if (def.gunZ !== undefined) gz = def.gunZ;
            parts.push({ f: AS.Forge.renderModel(AS.Models[gen](pal, def.gun), ang, 0, { res }), z: gz });
          }
        }
        const lift = o.lift !== undefined ? o.lift : (def.cls === 'air' || def.alt) ? Math.min(12, (def.alt || 30) * 0.25) : 0;
        const ramp = world.terrain && world.terrain.ramp;
        this.compose(cv, parts, lift, res, { sil: o.sil, ground: ramp ? ramp[(ramp.length / 2) | 0] : '#4a5058' });
        return true;
      } catch (e) { return false; }
    },
    compose(cv, parts, lift, res, o) {
      o = o || {};
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const p of parts) { const f = p.f; x0 = Math.min(x0, -f.ax); x1 = Math.max(x1, f.w - f.ax); y0 = Math.min(y0, -f.ay - p.z - lift); y1 = Math.max(y1, f.h - f.ay - p.z - lift); }
      const f0 = parts[0].f, off = 2 + lift * 0.12, sx = off + lift * 0.15, sy = off * 0.5;
      x1 = Math.max(x1, f0.w - f0.ax + sx); y1 = Math.max(y1, f0.h - f0.ay + sy);
      // 1) composite at render resolution: cast shadow, then body and turret
      const TW = Math.ceil((x1 - x0) * res) + 2, TH = Math.ceil((y1 - y0) * res) + 2;
      const tmp = AS.Forge.canvas(TW, TH), t = tmp.getContext('2d');
      const X = (v) => (v - x0) * res + 1, Y = (v) => (v - y0) * res + 1;
      if (!o.sil) {
        t.globalAlpha = lift ? 0.26 : 0.42;
        t.drawImage(AS.Forge.silhouette(f0.img, res), X(-f0.ax + sx), Y(-f0.ay + sy), f0.w * res, f0.h * res);
        t.globalAlpha = 1;
      }
      const body = o.sil ? AS.Forge.canvas(TW, TH) : tmp, bc = body.getContext('2d');
      for (const p of parts) bc.drawImage(p.f.img, X(-p.f.ax), Y(-p.f.ay - p.z - lift), p.f.w * res, p.f.h * res);
      if (o.sil) { bc.globalCompositeOperation = 'source-atop'; bc.fillStyle = '#1c0b0d'; bc.fillRect(0, 0, TW, TH); t.drawImage(body, 0, 0); }
      // 2) crop to the opaque pixels
      const d = t.getImageData(0, 0, TW, TH).data;
      let bx0 = TW, by0 = TH, bx1 = -1, by1 = -1;
      for (let y = 0; y < TH; y++) for (let x = 0, q = y * TW * 4 + 3; x < TW; x++, q += 4) if (d[q] > 20) { if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
      if (bx1 < 0) return;
      const bw = bx1 - bx0 + 1, bh = by1 - by0 + 1;
      // 3) fit into the frame over a dim patch of the world's ground
      const W = cv.width, H = cv.height, pad = W * (o.pad !== undefined ? o.pad : 0.12);
      const k = Math.min((W - pad * 2) / bw, (H - pad * 2) / bh);
      const c = cv.getContext('2d');
      c.clearRect(0, 0, W, H);
      if (o.ground) {
        const g = c.createRadialGradient(W / 2, H * 0.6, W * 0.04, W / 2, H * 0.55, W * 0.75);
        g.addColorStop(0, U.C.str(U.C.shade(o.ground, -0.18), 0.95)); g.addColorStop(0.55, U.C.str(U.C.shade(o.ground, -0.55), 0.9)); g.addColorStop(1, U.C.str(U.C.shade(o.ground, -0.82), 0.9));
        c.fillStyle = g; c.fillRect(0, 0, W, H);
      }
      c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
      const dx = (W - bw * k) / 2, dy = (H - bh * k) / 2;
      if (o.sil) { c.shadowColor = 'rgba(255,90,60,0.95)'; c.shadowBlur = W * 0.09; c.drawImage(tmp, bx0, by0, bw, bh, dx, dy, bw * k, bh * k); c.shadowBlur = 0; }
      c.drawImage(tmp, bx0, by0, bw, bh, dx, dy, bw * k, bh * k);
    },

    /* ---------- tactical map: progressive terrain + animated overlay ---------- */
    map(UI, m, w, ob, el) {
      const C = this.COL, Fnt = this.F;
      const MW = m.map.w, MH = m.map.h;
      const ctl = { alive: true, hl: null, hover: null, terrain: null, tw: 0, th: 0, rows: 0, cw: 0, ch: 0, dpr: 1 };
      const { wrap, stage, terr, ovl, tip, rows } = el;
      // objective markers: laid out per map size so coincident markers fan out instead of stacking
      const objMarks = [];
      for (const o of ob.prim.concat(ob.sec)) for (const q of o.pts) objMarks.push({ q, o, kind: o.cat, x: 0, y: 0, bx: 0, by: 0 });
      const unit = () => Math.max(0.85, Math.min(1.6, ctl.cw / 470));
      let layW = 0;
      const layout = () => {
        if (layW === ctl.cw) return;
        layW = ctl.cw;
        const sx = ctl.cw / MW, sy = ctl.ch / MH, minD = 19 * unit(), placed = [];
        const clash = (x, y) => placed.some((p) => Math.hypot(p.x - x, p.y - y) < minD);
        for (const mk of objMarks) {
          mk.bx = mk.q.x * sx; mk.by = mk.q.y * sy; mk.x = mk.bx; mk.y = mk.by;
          if (clash(mk.x, mk.y)) for (const a of [-0.79, 0.79, -2.36, 2.36, 0, Math.PI, -1.57, 1.57]) { const x = mk.bx + Math.cos(a) * minD, y = mk.by + Math.sin(a) * minD; if (!clash(x, y)) { mk.x = x; mk.y = y; break; } }
          placed.push(mk);
        }
      };
      // other hover targets, in world space
      const items = [];
      const marks = (m.briefing && m.briefing.marks) || [];
      for (const mk of marks) items.push({ x: mk.x, y: mk.y, kind: 'm', mk });
      const lz = m.extraction || m.start;
      if (lz) items.push({ x: lz.x, y: lz.y, kind: 'lz' });
      const convoys = this.ents(m).filter((e) => e.t === 'convoy' && Array.isArray(e.path));
      for (const cv of convoys) items.push({ x: cv.x, y: cv.y, kind: 'cv', cv, ally: cv.team === 'player' });
      // destination arrow: launch point to the nearest point of the first located primary
      let dest = null;
      const st = m.start || lz;
      const firstP = ob.prim.find((o) => o.pts.length);
      if (st && firstP) { let bd = 1e12; for (const q of firstP.pts) { const d = (q.x - st.x) ** 2 + (q.y - st.y) ** 2; if (d < bd) { bd = d; dest = q; } } }

      const T = new AS.Terrain(w, m.map);
      const paint = () => {
        if (!ctl.cw) return;
        const c = terr.getContext('2d'), cw = ctl.cw, ch = ctl.ch;
        c.setTransform(ctl.dpr, 0, 0, ctl.dpr, 0, 0);
        c.fillStyle = '#060b10'; c.fillRect(0, 0, cw, ch);
        if (ctl.terrain && ctl.rows > 0) {
          c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
          c.drawImage(ctl.terrain, 0, 0, ctl.tw, ctl.rows, 0, 0, cw, ch * ctl.rows / ctl.th);
        }
        // grade the terrain down a touch so markers read, plus a soft vignette
        c.fillStyle = 'rgba(6,14,22,0.24)'; c.fillRect(0, 0, cw, ch);
        const vg = c.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.3, cw / 2, ch / 2, Math.max(cw, ch) * 0.72);
        vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,4,8,0.55)');
        c.fillStyle = vg; c.fillRect(0, 0, cw, ch);
        // sector grid (1000 m) with edge labels
        const step = 1000, sx = cw / MW, sy = ch / MH;
        c.strokeStyle = 'rgba(160,235,255,0.13)'; c.lineWidth = 1;
        c.beginPath();
        for (let x = step; x < MW; x += step) { const X = Math.round(x * sx) + 0.5; c.moveTo(X, 0); c.lineTo(X, ch); }
        for (let y = step; y < MH; y += step) { const Y = Math.round(y * sy) + 0.5; c.moveTo(0, Y); c.lineTo(cw, Y); }
        c.stroke();
        c.font = '400 ' + Math.round(Math.max(9, cw / 52)) + 'px "Share Tech Mono", monospace';
        c.fillStyle = 'rgba(205,236,246,0.5)'; c.textBaseline = 'top'; c.textAlign = 'center';
        for (let i = 0; i * step < MW; i++) c.fillText(String.fromCharCode(65 + i), (i + 0.5) * step * sx, 4);
        c.textAlign = 'left'; c.textBaseline = 'middle';
        for (let j = 0; j * step < MH; j++) c.fillText(String(j + 1), 4, (j + 0.5) * step * sy);
      };
      const build = () => {
        const tw = Math.max(260, Math.min(760, Math.round(ctl.cw * Math.min(ctl.dpr, 1.5))));
        const sc = MW / tw, th = Math.ceil(MH / sc);
        const fast = typeof T.field === 'function' && typeof T.levelOf === 'function' && typeof T.colorize === 'function';
        if (!fast) { // fall back to the one-shot builder
          setTimeout(() => { if (!ctl.alive) return; const img = T.buildMap(sc); ctl.terrain = img; ctl.tw = img.width; ctl.th = img.height; ctl.rows = img.height; paint(); }, 30);
          return;
        }
        const cv = AS.Forge.canvas(tw, th), cx = cv.getContext('2d');
        const img = cx.createImageData(tw, th), D = img.data, f = new Float32Array(4), out = [0, 0, 0], prev = new Float32Array(tw);
        Object.assign(ctl, { terrain: cv, tw, th, rows: 0 });
        let j = 0;
        const stepFn = () => {
          if (!ctl.alive) return;
          const t0 = performance.now(), j0 = j;
          while (j < th && performance.now() - t0 < 7) {
            for (let i = 0; i < tw; i++) {
              const x = i * sc + sc / 2, y = j * sc + sc / 2;
              T.field(x, y, f);
              const l = T.levelOf(f[0]);
              T.colorize(x, y, f[0], f[1], f[2], f[3], l, out);
              const lu = j > 0 ? prev[i] : l, k = lu > l ? 0.7 : lu < l ? 1.15 : 1;
              prev[i] = l;
              const q = (j * tw + i) * 4;
              D[q] = out[0] * k; D[q + 1] = out[1] * k; D[q + 2] = out[2] * k; D[q + 3] = 255;
            }
            j++;
          }
          cx.putImageData(img, 0, 0, 0, j0, tw, j - j0);
          ctl.rows = j; paint();
          if (j < th) requestAnimationFrame(stepFn);
        };
        requestAnimationFrame(stepFn);
      };
      const fit = () => {
        const r = wrap.getBoundingClientRect();
        if (r.width < 20 || r.height < 20) return false;
        const a = MW / MH;
        let W = r.width, H = W / a;
        if (H > r.height) { H = r.height; W = H * a; }
        ctl.cw = Math.floor(W); ctl.ch = Math.floor(H); ctl.dpr = Math.min(2, window.devicePixelRatio || 1);
        stage.style.width = ctl.cw + 'px'; stage.style.height = ctl.ch + 'px';
        for (const c of [terr, ovl]) { c.width = Math.round(ctl.cw * ctl.dpr); c.height = Math.round(ctl.ch * ctl.dpr); }
        paint();
        return true;
      };

      /* overlay primitives */
      const pill = (c, x, y, txt, col, u, align, dry) => {
        c.font = Fnt(Math.round(10.5 * u), 700);
        const tw = c.measureText(txt).width, pw = tw + 12 * u, ph = 16 * u;
        let px = align === 'left' ? x - pw : x;
        px = Math.max(3, Math.min(ctl.cw - pw - 3, px));
        const py = Math.max(3, Math.min(ctl.ch - ph - 3, y - ph / 2));
        if (dry) return { x: px, y: py, w: pw, h: ph };
        c.beginPath(); c.roundRect ? c.roundRect(px, py, pw, ph, 4 * u) : c.rect(px, py, pw, ph);
        c.fillStyle = 'rgba(5,10,15,0.86)'; c.fill(); c.strokeStyle = col; c.lineWidth = 1; c.stroke();
        c.fillStyle = col; c.textAlign = 'left'; c.textBaseline = 'middle';
        c.fillText(txt, px + 6 * u, py + ph / 2 + 0.5);
        return { x: px, y: py, w: pw, h: ph };
      };
      const arrowHead = (c, x, y, ang, s, col) => {
        c.save(); c.translate(x, y); c.rotate(ang);
        c.beginPath(); c.moveTo(s, 0); c.lineTo(-s * 0.7, -s * 0.75); c.lineTo(-s * 0.35, 0); c.lineTo(-s * 0.7, s * 0.75); c.closePath();
        c.fillStyle = col; c.fill(); c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 1; c.stroke();
        c.restore();
      };
      const diamond = (c, x, y, s) => { c.beginPath(); c.moveTo(x, y - s); c.lineTo(x + s, y); c.lineTo(x, y + s); c.lineTo(x - s, y); c.closePath(); };

      const draw = (now) => {
        if (!ctl.cw) return;
        const c = ovl.getContext('2d'), cw = ctl.cw, ch = ctl.ch, t = now / 1000;
        c.setTransform(ctl.dpr, 0, 0, ctl.dpr, 0, 0);
        c.clearRect(0, 0, cw, ch);
        const sx = cw / MW, sy = ch / MH, u = Math.max(0.85, Math.min(1.6, cw / 470));
        const scanY = ctl.th ? ch * ctl.rows / ctl.th : 0, done = ctl.th && ctl.rows >= ctl.th;
        const vis = (y) => done ? 1 : Math.max(0, Math.min(1, (scanY - y) / 40));
        const hot = (o) => ctl.hl === o.id || (ctl.hover && ctl.hover.o === o);
        // convoy routes
        for (const cv of convoys) {
          const col = cv.team === 'player' ? C.ok : C.bad;
          const pts = [[cv.x, cv.y]].concat(cv.path).map((q) => [q[0] * sx, q[1] * sy]);
          c.globalAlpha = 0.9 * vis(pts[0][1]);
          c.setLineDash([5 * u, 4 * u]); c.lineDashOffset = -t * 14 * u; c.lineWidth = 2 * u; c.strokeStyle = col;
          c.beginPath(); pts.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.stroke();
          c.setLineDash([]);
          const a = pts[pts.length - 1], b = pts[pts.length - 2] || pts[0];
          arrowHead(c, a[0], a[1], Math.atan2(a[1] - b[1], a[0] - b[0]), 7 * u, col);
          c.globalAlpha = 1;
        }
        // destination arrow
        if (dest && st) {
          const x0 = st.x * sx, y0 = st.y * sy, x1 = dest.x * sx, y1 = dest.y * sy;
          const L = Math.hypot(x1 - x0, y1 - y0), ang = Math.atan2(y1 - y0, x1 - x0);
          if (L > 40 * u) {
            const s0 = 14 * u, s1 = L - 20 * u;
            c.globalAlpha = done ? 1 : 0.5;
            c.lineCap = 'round';
            c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = 5 * u; c.setLineDash([]);
            c.beginPath(); c.moveTo(x0 + Math.cos(ang) * s0, y0 + Math.sin(ang) * s0); c.lineTo(x0 + Math.cos(ang) * s1, y0 + Math.sin(ang) * s1); c.stroke();
            c.strokeStyle = C.p; c.lineWidth = 2.2 * u; c.setLineDash([8 * u, 6 * u]); c.lineDashOffset = -t * 22 * u;
            c.beginPath(); c.moveTo(x0 + Math.cos(ang) * s0, y0 + Math.sin(ang) * s0); c.lineTo(x0 + Math.cos(ang) * s1, y0 + Math.sin(ang) * s1); c.stroke();
            c.setLineDash([]); c.lineCap = 'butt';
            arrowHead(c, x0 + Math.cos(ang) * (s1 + 3 * u), y0 + Math.sin(ang) * (s1 + 3 * u), ang, 8 * u, C.p);
            c.globalAlpha = 1;
          }
        }
        // briefing marks: soft area rings with labels
        const R = 17 * u;
        for (const mk of marks) {
          const x = mk.x * sx, y = mk.y * sy, col = mk.col || C.mark, a = vis(y);
          if (a <= 0) continue;
          c.globalAlpha = a;
          c.beginPath(); c.arc(x, y, R, 0, TAU);
          c.save(); c.globalAlpha = a * 0.14; c.fillStyle = col; c.fill(); c.restore();
          c.setLineDash([4 * u, 3 * u]); c.lineDashOffset = t * 6; c.strokeStyle = col; c.lineWidth = 1.3 * u; c.stroke(); c.setLineDash([]);
          c.globalAlpha = 1;
        }
        // optional objectives (cyan rings), then primaries (amber diamonds) on top
        layout();
        for (const mk of objMarks) {
          if (mk.x === mk.bx && mk.y === mk.by) continue;
          c.globalAlpha = vis(mk.by) * 0.8;
          c.beginPath(); c.arc(mk.bx, mk.by, 2.2 * u, 0, TAU); c.fillStyle = mk.kind === 'p' ? C.p : C.s; c.fill();
          c.beginPath(); c.moveTo(mk.bx, mk.by); c.lineTo(mk.x, mk.y); c.strokeStyle = mk.kind === 'p' ? C.p : C.s; c.lineWidth = 1.2 * u; c.stroke();
          c.globalAlpha = 1;
        }
        for (const mk of objMarks) {
          if (mk.kind !== 's') continue;
          const o = mk.o, x = mk.x, y = mk.y, a = vis(mk.by), H = hot(o);
          if (a <= 0) continue;
          c.globalAlpha = a;
          const r = (H ? 9.5 : 7.5) * u;
          if (H) { c.beginPath(); c.arc(x, y, r + 5 * u + Math.sin(t * 6) * 1.5 * u, 0, TAU); c.strokeStyle = 'rgba(127,232,255,0.5)'; c.lineWidth = 1.5 * u; c.stroke(); }
          c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = 'rgba(5,10,15,0.9)'; c.fill();
          c.strokeStyle = C.s; c.lineWidth = 2 * u; c.stroke();
          c.font = Fnt(Math.round(9.5 * u * (H ? 1.15 : 1)), 700); c.fillStyle = C.s; c.textAlign = 'center'; c.textBaseline = 'middle';
          c.fillText(o.tag, x, y + 0.5);
          c.globalAlpha = 1;
        }
        for (const mk of objMarks) {
          if (mk.kind !== 'p') continue;
          {
            const o = mk.o, x = mk.x, y = mk.y, a = vis(mk.by), H = hot(o);
            if (a <= 0) continue;
            c.globalAlpha = a;
            const s = (H ? 12 : 9.5) * u;
            const ph = (t * 0.7 + (+o.tag || 0) * 0.33) % 1;
            c.beginPath(); c.arc(x, y, s + ph * 16 * u, 0, TAU); c.strokeStyle = 'rgba(255,195,90,' + (0.75 * (1 - ph)).toFixed(3) + ')'; c.lineWidth = 2 * u; c.stroke();
            diamond(c, x, y, s + 2 * u); c.fillStyle = 'rgba(0,0,0,0.55)'; c.fill();
            diamond(c, x, y, s); c.fillStyle = C.p; c.fill();
            c.strokeStyle = 'rgba(255,240,200,0.9)'; c.lineWidth = 1; c.stroke();
            c.font = '800 ' + Math.round(s * 0.95) + 'px Orbitron, sans-serif'; c.fillStyle = '#1c1405'; c.textAlign = 'center'; c.textBaseline = 'middle';
            c.fillText(o.tag, x, y + 1);
            c.globalAlpha = 1;
          }
        }
        // landing zone + launch heading
        if (lz) {
          const x = lz.x * sx, y = lz.y * sy;
          c.globalAlpha = vis(y);
          c.beginPath(); c.arc(x, y, 9 * u, 0, TAU); c.fillStyle = 'rgba(5,15,9,0.85)'; c.fill();
          c.strokeStyle = C.ok; c.lineWidth = 2 * u; c.stroke();
          c.beginPath(); c.arc(x, y, 3.5 * u, 0, TAU); c.fillStyle = C.ok; c.fill();
          c.beginPath(); c.arc(x, y, 13 * u + (t * 10 % 8) * u, 0, TAU); c.strokeStyle = 'rgba(125,255,154,' + (0.5 - (t * 10 % 8) / 16).toFixed(3) + ')'; c.lineWidth = 1.2 * u; c.stroke();
          pill(c, x + 12 * u, y + 14 * u, 'LZ', C.ok, u, x + 50 * u < cw ? 'right' : 'left');
          c.globalAlpha = 1;
        }
        // intel labels last, placed on whichever side of their ring keeps clear of objective markers
        const taken = objMarks.map((q) => ({ x: q.x - 11 * u, y: q.y - 11 * u, w: 22 * u, h: 22 * u }));
        if (lz) taken.push({ x: lz.x * sx - 12 * u, y: lz.y * sy - 12 * u, w: 40 * u, h: 40 * u });
        const hits = (r) => taken.some((q) => r.x < q.x + q.w && r.x + r.w > q.x && r.y < q.y + q.h && r.y + r.h > q.y);
        for (const mk of marks) {
          const x = mk.x * sx, y = mk.y * sy, col = mk.col || C.mark, a = vis(y);
          if (a <= 0 || !mk.label) continue;
          c.globalAlpha = a;
          if (mk.label === '?') {
            c.font = Fnt(Math.round(15 * u), 700); c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'middle';
            c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 3; c.strokeText('?', x, y - R - 6 * u); c.fillText('?', x, y - R - 6 * u);
          } else {
            const cands = [[x + R * 0.8, y - R * 0.85, 'right'], [x - R * 0.8, y - R * 0.85, 'left'], [x + R * 0.8, y + R * 0.85, 'right'], [x - R * 0.8, y + R * 0.85, 'left'], [x - 1, y - R - 9 * u, 'mid']];
            let pick = null;
            for (const cd of cands) {
              const r = cd[2] === 'mid' ? (() => { const r0 = pill(c, cd[0], cd[1], mk.label, col, u, 'right', true); return pill(c, cd[0] - r0.w / 2, cd[1], mk.label, col, u, 'right', true); })() : pill(c, cd[0], cd[1], mk.label, col, u, cd[2], true);
              if (!hits(r)) { pick = r; break; }
            }
            if (!pick) pick = pill(c, cands[0][0], cands[0][1], mk.label, col, u, 'right', true);
            pill(c, pick.x, pick.y + pick.h / 2, mk.label, col, u, 'right');
            taken.push(pick);
          }
          c.globalAlpha = 1;
        }
        // highlighted objective: name it on the map
        const hlO = ctl.hover ? ctl.hover.o : (ctl.hl && ob.prim.concat(ob.sec).find((o) => o.id === ctl.hl));
        const hlM = hlO && !ctl.hover && objMarks.find((mk) => mk.o === hlO);
        if (hlM) {
          const x = hlM.x, y = hlM.y, col = hlO.cat === 'p' ? C.p : C.s;
          const right = x + 160 * u < cw;
          pill(c, right ? x + 16 * u : x - 16 * u, y, hlO.tag + '  ' + hlO.text.toUpperCase(), col, u, right ? 'right' : 'left');
        }
        // compass
        const nx = cw - 16 * u, ny = 20 * u;
        c.beginPath(); c.moveTo(nx, ny - 9 * u); c.lineTo(nx + 5 * u, ny + 5 * u); c.lineTo(nx, ny + 2 * u); c.lineTo(nx - 5 * u, ny + 5 * u); c.closePath();
        c.fillStyle = 'rgba(230,245,250,0.85)'; c.fill();
        c.font = Fnt(Math.round(9 * u), 700); c.textAlign = 'center'; c.textBaseline = 'top'; c.fillText('N', nx, ny + 7 * u);
        // scan line while the terrain builds
        if (ctl.th && !done) {
          const g = c.createLinearGradient(0, scanY - 26, 0, scanY + 2);
          g.addColorStop(0, 'rgba(127,232,255,0)'); g.addColorStop(1, 'rgba(127,232,255,0.35)');
          c.fillStyle = g; c.fillRect(0, scanY - 26, cw, 28);
          c.fillStyle = 'rgba(190,245,255,0.9)'; c.fillRect(0, scanY, cw, 1.5);
          c.font = '400 ' + Math.round(10 * u) + 'px "Share Tech Mono", monospace'; c.textAlign = 'right'; c.textBaseline = 'bottom';
          c.fillStyle = 'rgba(190,245,255,0.85)'; c.fillText('SURVEYING ' + Math.round(ctl.rows / ctl.th * 100) + '%', cw - 8, Math.max(14, scanY - 4));
        }
      };

      /* hover: tooltips on the map, linked highlight with the objective list */
      const setRowHl = (id) => { for (const k in rows) rows[k].classList.toggle('hl', k === id); };
      const tipFor = (it) => {
        if (it.kind === 'p') return { col: C.p, k: '◆ PRIMARY OBJECTIVE ' + it.o.tag, v: it.o.text, x: it.o.desc };
        if (it.kind === 's') return { col: C.s, k: '● OPTIONAL OBJECTIVE ' + it.o.tag, v: it.o.text, x: it.o.reward ? '+' + it.o.reward + ' salvage bonus' : '' };
        if (it.kind === 'm') return { col: it.mk.col || C.mark, k: 'INTEL MARKER', v: it.mk.label === '?' ? 'Unconfirmed contact' : it.mk.label, x: '' };
        if (it.kind === 'cv') return { col: it.ally ? C.ok : C.bad, k: 'CONVOY ROUTE', v: it.ally ? 'Friendly convoy' : 'Hostile convoy', x: 'Dashed line shows the route it will drive.' };
        return { col: C.ok, k: 'LANDING ZONE', v: 'Dropship and extraction', x: 'Drop off survivors and cargo here. Land on it to finish once the primaries are done.' };
      };
      const onMove = (e) => {
        const r = stage.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
        const sx = ctl.cw / MW, sy = ctl.ch / MH, u = unit();
        let best = null, bd = 1e9;
        layout();
        for (const mk of objMarks) { const d = Math.hypot(mk.x - mx, mk.y - my) - (mk.kind === 'p' ? 3 : 0); if (d < 14 * u && d < bd) { bd = d; best = mk; } }
        for (const it of items) {
          const d = Math.hypot(it.x * sx - mx, it.y * sy - my) - (it.kind === 'p' ? 3 : it.kind === 'm' ? -4 : 0);
          if (d < (it.kind === 'm' ? 18 : 14) * u && d < bd) { bd = d; best = it; }
        }
        ctl.hover = best && best.o ? best : null;
        setRowHl(best && best.o ? best.o.id : ctl.hl);
        if (!best) { tip.classList.remove('on'); return; }
        const d = tipFor(best);
        tip.style.setProperty('--tc', d.col);
        tip.replaceChildren(h('div', { class: 'k' }, d.k), h('div', { class: 'v' }, d.v), d.x ? h('div', { class: 'x' }, d.x) : null);
        tip.classList.add('on');
        const tw = tip.offsetWidth, th = tip.offsetHeight;
        let tx = mx + 16, ty = my + 14;
        if (tx + tw > ctl.cw - 4) tx = mx - tw - 16;
        if (ty + th > ctl.ch - 4) ty = my - th - 12;
        tip.style.left = Math.max(4, tx) + 'px'; tip.style.top = Math.max(4, ty) + 'px';
      };
      const onLeave = () => { ctl.hover = null; tip.classList.remove('on'); setRowHl(ctl.hl); };
      stage.addEventListener('mousemove', onMove);
      stage.addEventListener('mouseleave', onLeave);
      ctl.setHl = (id) => { ctl.hl = id; setRowHl(id); };

      const onResize = () => { if (ctl.alive) fit(); };
      window.addEventListener('resize', onResize);
      ctl.destroy = () => { ctl.alive = false; window.removeEventListener('resize', onResize); };
      const loop = (now) => {
        if (!ctl.alive) return;
        if (!ovl.isConnected || UI.current !== 'briefing') { ctl.destroy(); return; }
        if (!ctl.cw) { if (fit()) build(); }
        draw(now);
        if (ctl.onFrame) ctl.onFrame(now);
        requestAnimationFrame(loop);
      };
      if (fit()) build();
      requestAnimationFrame(loop);
      return ctl;
    },
  };

  /* ---------------- screens ---------------- */
  const TIPS = [
    'Fuel drains while you fly and burns hard when you boost. Plan your route through fuel caches.',
    'Destroy power nodes to shut down every turret they feed.',
    'Comm relays call in reinforcements. Silence them early.',
    'Missile batteries need radar to lock at long range. Kill the radar and they go half-blind.',
    'Your passenger bay is limited. Ferry survivors to a landing pad, then go back for more.',
    'Hold the secondary trigger over targets to paint several missile locks, then release.',
    'Shields regenerate after a few seconds without damage. The hull does not — use repair kits, pads and survivor medics.',
    'Out of fuel? The emergency reserve gives you thirty seconds to reach a fuel cell.',
    'Press M for the tactical map. The game pauses while you plan.',
    'Hidden objectives are found by exploring. They pay well.',
    'Scanner upgrades reveal supply caches on the tactical map and burrowed contacts on radar.',
  ];

  const UI = {
    root: null, screens: {}, current: null, tickFn: null,
    boot(showMenu) {
      this.root = $('#ui');
      for (const id of ['menu', 'select', 'briefing', 'hangar', 'options', 'controls', 'pause', 'results', 'loading', 'modal']) {
        const s = h('div', { id, class: 'screen scan' });
        this.root.appendChild(s); this.screens[id] = s;
      }
      document.addEventListener('keydown', (e) => {
        if (e.code === 'Escape' && !AS.Input.captureHandler) {
          if (this.current === 'options' || this.current === 'controls') this.back();
          else if (this.current === 'pause') AS.App.resume();
          else if (this.current === 'select' || this.current === 'briefing' || this.current === 'hangar') { if (!AS.App.game) this.showMenu(); }
        }
      });
      if (showMenu !== false) this.showMenu();
    },
    hideAll() { for (const k in this.screens) this.screens[k].classList.remove('show'); this.current = null; AS.Renderer.canvas.style.cursor = 'crosshair'; },
    show(id) {
      this.hideAll(); this.screens[id].classList.add('show'); this.current = id;
      AS.Renderer.canvas.style.cursor = 'default';
      const first = this.screens[id].querySelector('.btn:not(:disabled)');
      if (first && id !== 'hangar') setTimeout(() => first.focus({ preventScroll: true }), 30);
    },
    tick(dt) { if (AS.App.state !== 'play') Backdrop.draw(dt); },
    menuMusic() {
      if (AS.Music.playing && AS.Music.world && AS.Music.world.id === 0) return;
      AS.Music.play({ id: 0, music: { root: 45, scale: 'aeolian', tempo: 72, pad: 'choir', lead: 'sine', perc: 'soft' } });
    },

    /* ---------- main menu ---------- */
    showMenu() {
      AS.App.state = 'menu';
      const s = this.screens.menu; s.innerHTML = '';
      const has = AS.Save.hasProfile();
      if (has && !AS.Save.profile) AS.Save.loadProfile();
      const p = AS.Save.profile;
      const next = has ? AS.Levels.byId[AS.Campaign.nextMission()] : null;
      Backdrop.setWorld(next ? AS.Data.worldById(next.world) : AS.Data.worlds[0]);
      this.menuMusic();
      s.appendChild(h('div', null,
        h('h1', { class: 'title' }, 'ALIEN', h('br'), 'STRIKE'),
        h('div', { class: 'subtitle' }, 'VESPER PROTOCOL // FRONTIER RECLAMATION'),
        h('div', { class: 'buttons' },
          btn('Start Campaign', () => this.startCampaign(), 'primary', has ? 'new' : null),
          btn('Continue', () => this.continueCampaign(), '', next ? next.name : 'no campaign saved'),
          btn('Mission Select', () => this.showSelect()),
          btn('Upgrades', () => this.showHangar(), '', has ? 'hangar' : 'start a campaign first'),
          btn('Options', () => this.showOptions('menu')),
          btn('Controls', () => this.showControls('menu')),
        )));
      const buttons = s.querySelectorAll('.btn');
      if (!has) { buttons[1].disabled = true; buttons[3].disabled = true; }
      s.appendChild(h('div', { class: 'foot' }, 'v' + AS.version + ' · keyboard + mouse · gamepad supported · ' + (AS.Save.available ? 'progress saves automatically' : 'storage unavailable — progress will not persist')));
      if (p) s.appendChild(h('div', { class: 'stat' }, 'CAMPAIGN ' + AS.Campaign.progressPct() + '% · SALVAGE ' + p.salvage + ' · TECH ' + p.tech, h('br'), 'KILLS ' + p.stats.kills + ' · RESCUED ' + p.stats.rescued + ' · MISSIONS ' + p.stats.missions));
      this.show('menu');
    },
    startCampaign() {
      const go = () => { AS.Save.newProfile(); this.showIntro(); };
      if (AS.Save.hasProfile()) this.confirm('Start a new campaign? Your current campaign progress, upgrades and salvage will be erased. Settings are kept.', go);
      else go();
    },
    continueCampaign() {
      if (!AS.Save.profile) AS.Save.loadProfile();
      this.showHangar();
    },
    showIntro() {
      this.bfStop();
      const s = this.screens.briefing; s.innerHTML = '';
      const text = [
        'Ninety years ago the survey ship Halcyon followed a dead signal through the Veil and found ten worlds wrapped around one ancient star.',
        'Every world was built — or broken — by the same intelligence. We call it the Choir: a dominion of living machines that has been asleep for longer than humanity has existed.',
        'The frontier colonies woke it.',
        'You fly the Vesper: a salvaged Choir drive core bolted into a scavenger gunship. Limited fuel. Limited ammunition. No cavalry. Rescue who you can. Recover what you can. Burn the rest.',
        'Your first sortie is Ashen Vale, where the Kessler survey team went silent.',
      ];
      const cls = ['lead', '', 'short', '', 'go'];
      const worlds = h('div', { class: 'bf-worlds bf-in', style: '--i:1' });
      const thumbs = [];
      AS.Data.worlds.forEach((w, i) => {
        const cv = h('canvas', { width: i ? 72 : 112, height: i ? 72 : 112 });
        thumbs.push([cv, w]);
        worlds.appendChild(h('div', { class: 'w' + (i ? '' : ' first') }, cv, h('span', null, i ? String(w.id).padStart(2, '0') : w.name)));
      });
      const box = h('div', { class: 'bf-card bf-intro' },
        h('div', { class: 'bf-kicker bf-in' }, 'FRONTIER RECLAMATION COMMAND — HALCYON'),
        h('h2', { class: 'bf-in', style: '--i:1' }, 'THE VEIL'),
        worlds);
      text.forEach((t, i) => box.appendChild(h('p', { class: (cls[i] + ' bf-in').trim(), style: '--i:' + (i + 2) }, t)));
      box.appendChild(h('div', { class: 'bf-actions' }, btn('Proceed to briefing', () => this.showBriefing(AS.Campaign.nextMission()), 'primary bf-go'), btn('Hangar', () => this.showHangar())));
      s.appendChild(box);
      this.show('briefing');
      // the ten worlds, one per frame so the screen appears immediately
      let k = 0;
      const next = () => {
        if (k >= thumbs.length || this.current !== 'briefing' || !box.isConnected) return;
        const [cv, w] = thumbs[k++];
        try { Planet.render(cv.getContext('2d'), w, cv.width / 2, cv.height / 2, cv.width / 2 - 5, w.id * 0.7); } catch (e) { /* decorative */ }
        requestAnimationFrame(next);
      };
      requestAnimationFrame(next);
    },

    /* ---------- mission select ---------- */
    showSelect(worldId) {
      AS.App.state = 'menu';
      if (!AS.Save.profile) AS.Save.loadProfile() || AS.Save.newProfile();
      const s = this.screens.select; s.innerHTML = '';
      const cur = worldId || (AS.Levels.byId[AS.Campaign.nextMission()] || {}).world || 1;
      Backdrop.setWorld(AS.Data.worldById(cur));
      s.appendChild(h('div', { class: 'row', style: 'align-items:baseline;justify-content:space-between' }, h('div', null, h('div', { class: 'planet mono', style: 'color:var(--amber);letter-spacing:4px' }, 'CAMPAIGN — ' + AS.Campaign.progressPct() + '% COMPLETE'), h('h2', { style: 'margin:4px 0;font:900 30px Orbitron;letter-spacing:3px' }, 'MISSION SELECT')), h('div', null, btn('Hangar', () => this.showHangar(), 'small'), ' ', btn('Main Menu', () => this.showMenu(), 'small'))));
      const grid = h('div', { class: 'worlds' });
      for (const w of AS.Data.worlds) {
        const ms = AS.Levels.worldMissions(w.id);
        const unlocked = AS.Campaign.worldUnlocked(w.id);
        const done = ms.filter((m) => AS.Campaign.isDone(m.id)).length;
        const card = h('div', { class: 'world-card' + (unlocked ? '' : ' locked') + (w.id === cur ? ' sel' : ''), onclick: () => { if (unlocked) { AS.Audio.sfx('ui_click'); this.showSelect(w.id); } else AS.Audio.sfx('denied'); } });
        card.appendChild(Planet.thumb(w, 64));
        card.appendChild(h('div', { class: 'num' }, 'WORLD ' + String(w.id).padStart(2, '0')));
        card.appendChild(h('div', { class: 'nm' }, unlocked ? w.name : '??????'));
        card.appendChild(h('div', { class: 'reg' }, unlocked ? w.region : 'Signal not yet traced'));
        card.appendChild(h('div', { class: 'prog' }, unlocked ? done + '/' + ms.length + ' cleared' : 'LOCKED'));
        grid.appendChild(card);
      }
      s.appendChild(grid);
      const w = AS.Data.worldById(cur);
      const det = h('div', { class: 'detail' });
      det.appendChild(h('div', { class: 'panel', style: 'flex:1' }, h('h2', null, w.name), h('div', { class: 'mono dim' }, w.region), h('p', { style: 'line-height:1.55' }, w.blurb), h('h3', null, 'KNOWN THREATS'), h('p', { class: 'dim' }, w.threat), h('h3', null, 'WORLD CONDITIONS'), h('p', { class: 'dim' }, this.mechText(w))));
      const list = h('div', { class: 'panel', style: 'flex:1.3' }, h('h2', null, 'OPERATIONS'));
      AS.Levels.worldMissions(w.id).forEach((m) => {
        const un = AS.Campaign.isUnlocked(m.id), dn = AS.Campaign.isDone(m.id);
        const rec = AS.Save.profile.missions[m.id];
        const row = h('div', { class: 'mission-row' + (un ? '' : ' locked'), onclick: () => { if (un) { AS.Audio.sfx('ui_click'); this.showBriefing(m.id); } else AS.Audio.sfx('denied'); } },
          h('div', { class: 'idx' }, m.index),
          h('div', { class: 'grow' }, h('div', { class: 'mn' }, un ? m.name : 'CLASSIFIED'), h('div', { class: 'md' }, un ? (m.briefing.tagline || m.region) : 'Complete the previous operation to unlock.')),
          dn ? h('span', { class: 'tag green' }, 'CLEARED ' + U.fmtTime(rec.best || 0)) : un ? h('span', { class: 'tag amber' }, 'AVAILABLE') : h('span', { class: 'tag' }, 'LOCKED'),
          m.boss ? h('span', { class: 'tag red' }, 'MAJOR THREAT') : null);
        list.appendChild(row);
      });
      det.appendChild(list);
      s.appendChild(det);
      this.show('select');
    },
    mechText(w) {
      const M = { sandstorm: 'Periodic sandstorms reduce scanner and visual range.', spores: 'Caustic spore clouds strip shields and corrode the hull.', whiteout: 'Whiteout storms blind scanners.', fractures: 'Unstable ice fractures erupt beneath you.', submerged: 'Some targets lie under water and must be scanned before they can be attacked.', eruptions: 'Lava eruptions without warning.', heat: 'Heat zones burn shields and fuel.', lowgrav: 'Low gravity: the craft drifts further.', sporecontrol: 'Spores scramble flight controls on contact.', wind: 'Violent wind currents push the craft off course.', lightning: 'Lightning strikes across the cloud decks.', power: 'Power networks can be rerouted to disable whole sectors.', allies: 'Allied forces fight alongside you.' };
      return w.mechanics.length ? w.mechanics.map((k) => M[k]).join(' ') : 'Stable conditions. Dry winds, good visibility.';
    },

    /* ---------- briefing ---------- */
    bfStop() {
      clearInterval(this.typeT);
      if (this.bfMap) { this.bfMap.destroy(); this.bfMap = null; }
    },
    showBriefing(id) {
      const m = AS.Levels.byId[id];
      if (!m) return;
      AS.App.state = 'menu';
      if (!AS.Save.profile) AS.Save.loadProfile() || AS.Save.newProfile();
      if (AS.ArtMap) AS.ArtMap.apply(); // redesigned sprite models for the threat portraits
      this.bfStop();
      const w = AS.Data.worldById(m.world);
      Backdrop.setWorld(w);
      const s = this.screens.briefing; s.innerHTML = '';
      const b = m.briefing || {};
      const P = AS.Save.profile, WD = AS.Data.weapons;
      const done = AS.Campaign.isDone(m.id), rec = P.missions && P.missions[m.id];
      const stop = () => { AS.Voice.stop(); this.bfStop(); };
      const sec = (title, end, ...kids) => h('div', { class: 'bf-h' }, title, end ? h('span', { class: 'end' }, end) : null, ...kids);

      /* header: world, region, operation, danger */
      const dz = U.clamp(Math.round(b.danger || 1), 1, 5), [dWord, dCol] = BF.DANGER[dz - 1];
      const planet = h('canvas', { class: 'bf-planet', width: 132, height: 132 });
      const chips = h('div', { class: 'bf-chips' }, h('span', { class: 'bf-chip' }, 'OP ' + String(w.id).padStart(2, '0') + '-' + m.index));
      if (m.boss) chips.appendChild(h('span', { class: 'bf-chip boss' }, '▲ MAJOR THREAT'));
      if (done) chips.appendChild(h('span', { class: 'bf-chip done' }, '✔ CLEARED' + (rec && rec.best ? ' ' + U.fmtTime(rec.best) : '')));
      const head = h('header', { class: 'bf-card bf-head' }, planet,
        h('div', { class: 'bf-title' },
          h('div', { class: 'bf-kicker' }, 'WORLD ' + String(w.id).padStart(2, '0') + ' · ' + w.name.toUpperCase() + ' ', h('span', { class: 'reg' }, '— ' + String(m.region || w.region || '').toUpperCase())),
          h('div', { class: 'mname' }, h('span', { class: 'op' }, 'OPERATION'), m.name),
          b.tagline ? h('div', { class: 'bf-tagline' }, b.tagline) : null),
        h('div', { class: 'bf-meta' }, chips,
          h('div', { class: 'bf-danger', style: '--dc:' + dCol }, h('div', { class: 'lbl' }, 'THREAT LEVEL'),
            h('div', { class: 'bars' }, [1, 2, 3, 4, 5].map((i) => h('i', { class: i <= dz ? 'on' : '' }))), h('div', { class: 'word' }, dWord))));

      /* objectives, colour-coded and keyed to the map */
      const ob = BF.objectives(m), rows = {};
      // what an optional actually pays: its own bonus plus the first-completion payment (AS.Campaign.optionalValue)
      const seenObj = (rec && rec.objectives) || {};
      const optPay = (o) => AS.Campaign.optionalValue(m.id, o);
      const objCard = h('div', { class: 'bf-card bf-obj bf-in', style: '--i:1' }, sec('Mission objectives'));
      const row = (o) => {
        const r = h('div', { class: 'bf-o ' + o.cat, onmouseenter: () => this.bfMap && this.bfMap.setHl(o.id), onmouseleave: () => this.bfMap && this.bfMap.setHl(null) },
          h('div', { class: 'bf-badge' }, o.tag),
          h('div', null, h('div', { class: 't' }, o.text), o.cat === 'p' && o.desc ? h('div', { class: 'd' }, o.desc) : null),
          o.cat === 's' ? h('span', { class: 'rw', title: (o.reward ? o.reward + ' bonus' : 'No bonus') + (seenObj[o.id] ? ' (already completed once)' : ' + ' + AS.Campaign.optionalPay + ' first-completion pay') + ' — salvage paid at the end of the mission' }, '+' + optPay(o)) : h('span'));
        rows[o.id] = r;
        return r;
      };
      objCard.appendChild(h('div', { class: 'bf-grp p' }, '◆ PRIMARY', h('span', { class: 'n' }, '· required to extract')));
      ob.prim.forEach((o) => objCard.appendChild(row(o)));
      if (ob.lockedP) objCard.appendChild(h('div', { class: 'bf-o p lk' }, h('div', { class: 'bf-badge' }, h('b', null, '?')), h('div', { class: 't' }, ob.lockedP > 1 ? ob.lockedP + ' more primaries will be assigned in the field' : 'A further primary will be assigned in the field'), h('span')));
      if (ob.sec.length || ob.lockedS) {
        objCard.appendChild(h('div', { class: 'bf-grp s' }, '● OPTIONAL', h('span', { class: 'n' }, '· bonus salvage')));
        ob.sec.forEach((o) => objCard.appendChild(row(o)));
      }
      if (ob.hidden) objCard.appendChild(h('div', { class: 'bf-hid' }, h('span', { class: 'st' }, '★'.repeat(Math.min(ob.hidden, 5))), h('span', null, ob.hidden + ' hidden objective' + (ob.hidden > 1 ? 's' : '') + ' — found by exploring. ' + ((m.objectives || []).filter((o) => o.cat === 'hidden').every((o) => seenObj[o.id]) ? 'All found on an earlier sortie.' : 'A first find pays +' + AS.Campaign.hiddenPay + ' salvage and a tech core.'))));
      const left = h('section', { class: 'bf-left' }, objCard);
      if (b.intel && b.intel.length) left.appendChild(h('div', { class: 'bf-card bf-intel bf-in', style: '--i:3' }, sec('Intelligence'), h('ul', { class: 'bf-list' }, b.intel.map((t) => h('li', null, t)))));

      /* tactical map */
      const terr = h('canvas'), ovl = h('canvas'), tip = h('div', { class: 'bf-tip' });
      const stage = h('div', { class: 'bf-stage' }, terr, ovl, tip);
      const wrap = h('div', { class: 'bf-mapwrap' }, stage);
      const legend = h('div', { class: 'bf-legend' },
        h('span', null, h('i', { class: 'lg-p' }), 'PRIMARY'), ob.sec.length ? h('span', null, h('i', { class: 'lg-s' }), 'OPTIONAL') : null,
        (b.marks && b.marks.length) ? h('span', null, h('i', { class: 'lg-m' }), 'INTEL') : null,
        h('span', null, h('i', { class: 'lg-lz' }), 'LANDING ZONE'), ob.prim.some((o) => o.pts.length) ? h('span', null, h('i', { class: 'lg-r' }), 'FIRST OBJECTIVE') : null);
      const mapCard = h('section', { class: 'bf-card bf-map bf-in', style: '--i:2' }, sec('Area of operations', h('span', null, (m.map.w / 1000).toFixed(1) + ' × ' + (m.map.h / 1000).toFixed(1) + ' KM')), wrap, legend);

      /* situation (typed + narrated) and threat cards */
      const sit = h('p', { class: 'typing' });
      const vu = h('span', { class: 'bf-vu', title: 'Halcyon Actual is briefing you' }, h('i'), h('i'), h('i'), h('i'));
      const replay = h('button', { class: 'bf-replay', title: 'Play the spoken briefing again', onclick: () => { AS.Audio.sfx('ui_click'); AS.Voice.stop(); AS.Voice.say('brief_' + m.id); } }, '↻ REPLAY');
      const sitCard = h('div', { class: 'bf-card bf-sit bf-in', style: '--i:1' }, sec('Situation', h('span', null, vu, AS.Voice.line('brief_' + m.id) ? replay : null)), sit);
      const right = h('section', { class: 'bf-right' }, sitCard);
      const list = BF.threats(m), enemies = list.filter((t) => !t.ally), allies = list.filter((t) => t.ally);
      const also = BF.describe(list, (b.threats || []).slice());
      const hasBoss = enemies.some((t) => t.boss);
      const cap = hasBoss ? 5 : 6, shownE = enemies.slice(0, cap);
      const shown = shownE.concat(allies.slice(0, Math.max(0, cap - shownE.length)));
      const portraits = [];
      const thrCard = h('div', { class: 'bf-card bf-threats bf-in', style: '--i:2' }, sec('Known threats', enemies.length ? h('span', null, enemies.length + ' hostile type' + (enemies.length > 1 ? 's' : '')) : null));
      const grid = h('div', { class: 'bf-thr' });
      for (const t of shown) {
        const unknown = t.boss && t.late;
        const cv = h('canvas', { width: t.boss ? 160 : 112, height: t.boss ? 160 : 112 });
        portraits.push([cv, t, unknown]);
        const pips = Math.max(1, Math.min(5, t.boss ? 5 : Math.ceil((t.def.threat || 0.5) / 0.6)));
        const name = unknown ? 'Unidentified contact' : t.def.name;
        grid.appendChild(h('div', { class: 'bf-en' + (t.boss ? ' boss' : '') + (t.ally ? ' ally' : ''), title: name + (t.desc ? ' — ' + t.desc : '') },
          cv,
          h('div', { class: 'tx' },
            h('div', { class: 'top' }, h('span', { class: 'nm' }, name),
              t.ally ? h('span', { class: 'bf-chip ok' }, 'ALLY') : h('span', { class: 'bf-pips', title: 'Threat ' + pips + ' of 5' }, [1, 2, 3, 4, 5].map((i) => h('i', { class: i <= pips ? 'on' : '' })))),
            h('div', { class: 'cl' }, t.ally ? 'Friendly · ' + BF.traits(t.def) : t.boss ? (unknown ? 'Boss-class signature · identity unknown' : 'Boss · ' + BF.traits(t.def)) : BF.traits(t.def)),
            t.desc ? h('div', { class: 'ds' }, t.desc) : null)));
      }
      thrCard.appendChild(grid);
      const more = h('div', { class: 'bf-more' });
      const setMore = () => { const n = enemies.length - [...grid.children].filter((e) => !e.classList.contains('ally')).length; more.textContent = n > 0 ? '+ ' + n + ' more contact type' + (n > 1 ? 's' : '') + ' reported in the area' : ''; more.style.display = n > 0 ? '' : 'none'; };
      setMore();
      thrCard.appendChild(more);
      const alsoEl = also.length ? h('ul', { class: 'bf-list warn bf-also' }, also.map((t) => h('li', null, t))) : null;
      if (alsoEl) thrCard.appendChild(alsoEl);
      right.appendChild(thrCard);

      /* footer: craft + loadout, rewards, actions */
      const craft = h('canvas', { class: 'bf-craft', width: 150, height: 110 });
      const wpn = (slot, label) => { const W = WD[P.loadout[slot]]; return h('div', { class: 'bf-wpn', style: '--wc:' + ((W && W.col) || '#7fe8ff') }, h('span', { class: 'sl' }, label), h('span', { class: 'wn' }, W ? W.name : '—')); };
      const R = m.rewards || {}, pay = ((R.salvage || 400) * (done ? 0.5 : 1)) | 0;
      const bonus = ob.sec.reduce((a, o) => a + optPay(o), 0);
      const rw = h('div', { class: 'bf-row' },
        h('div', { class: 'bf-rw' }, h('b', null, '+' + pay), h('span', null, done ? 'SALVAGE · REPLAY' : 'SALVAGE')),
        !done ? h('div', { class: 'bf-rw', style: '--rc:#c58aff' }, h('b', null, '+' + (R.tech || 1)), h('span', null, 'TECH')) : null,
        bonus ? h('div', { class: 'bf-rw', style: '--rc:#7fe8ff' }, h('b', null, '+' + bonus), h('span', null, 'OPTIONAL')) : null,
        !done && R.unlock && R.unlock.length ? h('div', { class: 'bf-rw', style: '--rc:#ffc35a' }, h('b', null, R.unlock.map((k) => (WD[k] ? WD[k].short || WD[k].name : k)).join(' + ')), h('span', null, 'BLUEPRINT')) : null);
      const actions = h('div', { class: 'bf-actions' },
        btn('Launch', () => { stop(); AS.App.startMission(m.id); }, 'primary bf-go'),
        btn('Hangar', () => { stop(); this.showHangar(m.id); }),
        btn('Back', () => { stop(); this.showSelect(m.world); }));
      const foot = h('footer', { class: 'bf-card bf-foot' }, craft,
        h('div', { class: 'bf-sec' }, h('span', { class: 'lbl' }, 'VESPER LOADOUT'), h('div', { class: 'bf-row' }, wpn('primary', 'PRIMARY'), wpn('secondary', 'SECONDARY'), wpn('special', 'SPECIAL'), h('div', { class: 'bf-rw', style: '--rc:#8dffb0' }, h('b', null, '×' + (P.repairKits || 0)), h('span', null, 'REPAIR KITS')))),
        h('div', { class: 'bf-vsep' }),
        h('div', { class: 'bf-sec' }, h('span', { class: 'lbl' }, 'REWARDS'), rw),
        actions);

      s.appendChild(h('div', { class: 'bf' }, head, left, mapCard, right, foot));
      this.show('briefing');

      // fit the threat column to the screen (measured with the full situation text in place)
      const full = b.situation || '';
      sit.textContent = full;
      const over = () => right.scrollHeight > right.clientHeight + 1;
      if (getComputedStyle(right).overflowY !== 'visible') {
        while (over() && grid.children.length > 3) grid.lastChild.remove();
        if (over() && alsoEl) alsoEl.remove();
        while (over() && grid.children.length > 2) grid.lastChild.remove();
        setMore();
      }
      sit.textContent = '';

      // typewriter + narration
      let i = 0;
      this.typeT = setInterval(() => { i += 3; sit.textContent = full.slice(0, i); if (i >= full.length) { clearInterval(this.typeT); sit.classList.remove('typing'); } }, 16);
      setTimeout(() => { if (this.current === 'briefing') AS.Voice.say('brief_' + m.id); }, 400);
      // tactical map (terrain scans in over a few frames) + narration indicator
      this.bfMap = BF.map(this, m, w, ob, { wrap, stage, terr, ovl, tip, rows });
      this.bfMap.onFrame = () => { const c = AS.Voice.current; vu.classList.toggle('live', !!(c && c.id === 'brief_' + m.id)); };
      // planet, craft and threat portraits: one per frame so nothing blocks the first paint
      const jobs = [
        () => Planet.render(planet.getContext('2d'), w, 66, 66, 60, w.id * 0.7),
        () => { const md = AS.Models.craft(P.upgrades || {}); BF.compose(craft, [{ f: AS.Forge.renderModel(md, -Math.PI / 2 - 0.7, 0, { res: 3 }), z: 0 }], 6, 3, { pad: 0.04 }); },
      ];
      for (const [cv, t, unknown] of portraits) jobs.push(() => BF.portrait(cv, t.def, w, { sil: unknown }));
      const run = () => {
        if (this.current !== 'briefing' || !s.contains(planet) || !jobs.length) return;
        try { jobs.shift()(); } catch (e) { /* decorative: a model that fails to render leaves its frame empty */ }
        requestAnimationFrame(run);
      };
      requestAnimationFrame(run);
    },

    /* ---------- hangar (UI/hangar.js) ---------- */
    showHangar(missionId) { AS.Hangar.show(this.screens.hangar, missionId); this.show('hangar'); AS.App.state = 'menu'; },

    /* ---------- options ---------- */
    showOptions(from) {
      this.backTo = from || this.backTo || 'menu';
      const S = AS.Settings;
      const s = this.screens.options; s.innerHTML = '';
      const slider = (key, label) => {
        const val = h('span', { class: 'val' }, Math.round(S[key] * 100) + '%');
        const inp = h('input', { type: 'range', min: 0, max: 100, value: Math.round(S[key] * 100), oninput: (e) => { S[key] = e.target.value / 100; val.textContent = e.target.value + '%'; AS.Audio.setVolumes(); AS.Save.saveSettings(); }, onchange: () => AS.Audio.sfx(key === 'voice' ? 'radio_on' : 'pickup') });
        return h('div', { class: 'opt-row' }, h('label', null, label), inp, val);
      };
      const seg = (key, label, opts, after) => {
        const box = h('div', { class: 'seg' });
        for (const [v, t] of opts) box.appendChild(h('button', { class: S[key] === v ? 'on' : '', onclick: () => { S[key] = v; AS.Save.saveSettings(); AS.Audio.sfx('ui_click'); if (after) after(v); this.showOptions(); } }, t));
        return h('div', { class: 'opt-row' }, h('label', null, label), box, h('span'));
      };
      const panel = h('div', { class: 'panel', style: 'width:min(720px,94vw)' }, h('h2', null, 'OPTIONS'),
        h('h3', null, 'AUDIO'), slider('master', 'Master volume'), slider('music', 'Music volume'), slider('sfx', 'Effects volume'), slider('voice', 'Voice volume'),
        h('h3', null, 'VIDEO'),
        seg('quality', 'Graphics quality', [['low', 'LOW'], ['medium', 'MEDIUM'], ['high', 'HIGH']], (v) => { AS.Particles.density = v === 'low' ? 0.5 : v === 'medium' ? 0.8 : 1; }),
        seg('view', 'View distance', [['near', 'NEAR'], [undefined, 'NORMAL'], ['far', 'FAR']], () => { AS.Renderer.resize(); }),
        seg('shake', 'Screen shake', [[true, 'ON'], [false, 'OFF']]),
        seg('flash', 'Screen flashes', [[true, 'ON'], [false, 'OFF']]),
        seg('subtitles', 'Subtitles', [[true, 'ON'], [false, 'OFF']]),
        h('div', { class: 'opt-row' }, h('label', null, 'Fullscreen'), h('div', null, btn(document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen', () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {}); setTimeout(() => this.showOptions(), 300); }, 'small')), h('span')),
        h('h3', null, 'TESTING'),
        seg('testMode', 'Test mode', [[false, 'OFF'], [true, 'ON']]),
        h('div', { class: 'dim mono', style: 'font-size:12px;margin:-4px 0 10px' }, 'Every mission is unlocked in Mission select. In flight, F9 (or Pause → Skip mission) completes the current mission so you can move on.'),
        h('h3', null, 'CONTROLS'),
        seg('controlMode', 'Control mode', [['twinstick', 'TWIN-STICK'], ['assault', 'ASSAULT'], ['tactical', 'CLASSIC']]),
        h('div', { class: 'dim mono', style: 'font-size:12px;margin:-4px 0 10px' }, S.controlMode === 'tactical' ? 'CLASSIC: W/S thrust, A/D rotate the craft, Q/F strafe. Mouse aims the weapon pods independently.' : S.controlMode === 'assault' ? 'ASSAULT: W/S thrust toward the cursor, A/D strafe around it.' : 'TWIN-STICK: WASD moves the craft in screen directions, the craft faces the mouse. Strafe, retreat and circle while you fire.'),
        h('div', { class: 'row', style: 'margin-top:12px;flex-wrap:wrap' }, btn('Key bindings', () => this.showControls('options')), btn('Back', () => this.back(), 'primary'), this.backTo === 'menu' ? btn('Erase campaign', () => this.confirm('Erase all campaign progress? This cannot be undone.', () => { AS.Save.deleteProfile(); this.showMenu(); }), 'danger small') : null));
      s.appendChild(panel);
      this.show('options');
    },
    back() {
      const t = this.backTo || 'menu';
      if (t === 'pause') this.showPause();
      else if (t === 'options') this.showOptions(this.prevBack || 'menu');
      else if (t === 'hangar') this.showHangar();
      else this.showMenu();
    },

    /* ---------- controls ---------- */
    showControls(from) {
      if (from && from !== 'options') this.backTo = from;
      if (from === 'options') { this.prevBack = this.backTo; this.backTo = 'options'; }
      const s = this.screens.controls; s.innerHTML = '';
      const I = AS.Input;
      const panel = h('div', { class: 'panel', style: 'width:min(820px,95vw);max-height:92vh;overflow:auto' }, h('h2', null, 'CONTROLS'));
      panel.appendChild(h('div', { class: 'row', style: 'gap:30px;flex-wrap:wrap' },
        h('div', { class: 'grow' }, h('h3', null, 'MOUSE'), h('div', { class: 'mono' }, 'Aim ............ move the mouse'), h('div', { class: 'mono' }, 'Primary fire ... left button (hold)'), h('div', { class: 'mono' }, 'Missiles ....... right button: hold to lock, release to fire')),
        h('div', { class: 'grow' }, h('h3', null, 'GAMEPAD'), h('div', { class: 'mono dim' }, 'Left stick: fly · Right stick: aim · RT/LT: primary/secondary · RB: special · A: interact · X: objectives · Y: repair · Back: map · Start: pause'))));
      panel.appendChild(h('h3', null, 'KEYBOARD — click a key to rebind (Esc cancels)'));
      for (const a in I.DEFAULT_BINDINGS) {
        const keys = I.bindings[a] || [];
        const mk = (slot) => {
          const b = h('button', { onclick: () => {
            b.textContent = 'press a key…'; b.classList.add('wait');
            I.captureHandler = (code) => {
              I.captureHandler = null;
              if (code !== 'Escape') {
                for (const k in I.bindings) I.bindings[k] = I.bindings[k].filter((c) => c !== code);
                I.bindings[a][slot] = code; I.bindings[a] = I.bindings[a].filter(Boolean);
                AS.Settings.bindings = I.bindings; AS.Save.saveSettings();
              }
              this.showControls();
            };
          } }, I.keyName(keys[slot]) || '—');
          return b;
        };
        panel.appendChild(h('div', { class: 'bind-row' }, h('span', null, I.ACTION_LABELS[a] || a), mk(0), mk(1)));
      }
      panel.appendChild(h('div', { class: 'row', style: 'margin-top:16px' }, btn('Reset defaults', () => { I.setBindings(null); AS.Settings.bindings = null; AS.Save.saveSettings(); this.showControls(); }, 'small'), btn('Back', () => this.back(), 'primary')));
      s.appendChild(panel);
      this.show('controls');
    },

    /* ---------- pause ---------- */
    showPause() {
      this.backTo = 'pause';
      const s = this.screens.pause; s.innerHTML = '';
      const g = AS.App.game;
      s.appendChild(h('div', { class: 'panel', style: 'width:380px' }, h('h2', null, 'PAUSED'), h('div', { class: 'mono dim', style: 'margin-bottom:12px' }, g ? g.mission.name + ' · T+' + U.fmtTime(g.time) : ''),
        h('div', { class: 'col' },
          btn('Resume', () => AS.App.resume(), 'primary'),
          btn('Restart mission', () => this.confirm('Restart this mission? Progress in this sortie will be lost.', () => AS.App.restart())),
          AS.Settings.testMode ? btn('Skip mission (test mode)', () => AS.App.skipMission()) : null,
          btn('Options', () => this.showOptions('pause')),
          btn('Controls', () => this.showControls('pause')),
          btn('Abort to hangar', () => this.confirm('Abort the mission and return to the hangar? Nothing from this sortie is kept.', () => { AS.Campaign.profile().repairKits = Math.min(AS.Campaign.profile().repairKits, g ? g.player.kits : 99); AS.Save.saveProfile(); AS.App.abandon(false); })),
          btn('Main menu', () => this.confirm('Quit to the main menu? Nothing from this sortie is kept.', () => AS.App.abandon(true))))));
      this.show('pause');
    },

    /* ---------- results ---------- */
    showResults(res, rw) {
      const s = this.screens.results; s.innerHTML = '';
      const m = res.mission, st = res.stats;
      const ok = res.success;
      const objs = h('div', { class: 'obj-list' });
      for (const o of res.objectives) {
        if (o.cat === 'hidden' && o.state !== 'done') continue;
        const tag = o.cat === 'primary' ? '◆' : o.cat === 'hidden' ? '★' : '◇';
        objs.appendChild(h('div', { class: o.state === 'done' ? 'done' : o.state === 'failed' ? 'failed' : 'open' }, (o.state === 'done' ? '✔ ' : o.state === 'failed' ? '✖ ' : '○ ') + tag + ' ' + o.text));
      }
      const sec = res.objectives.filter((o) => o.cat === 'secondary');
      const secDone = sec.filter((o) => o.state === 'done').length;
      const hidDone = res.objectives.filter((o) => o.cat === 'hidden' && o.state === 'done').length;
      const grid = h('div', { class: 'res-grid' },
        h('div', null, 'Optional objectives', h('b', null, secDone + ' / ' + sec.length + (hidDone ? '  +' + hidDone + ' hidden' : ''))),
        h('div', null, 'Enemies destroyed', h('b', null, st.kills + st.structures)),
        h('div', null, 'Survivors rescued', h('b', null, st.rescued + (st.lost ? ' (' + st.lost + ' lost)' : ''))),
        h('div', null, 'Salvage collected', h('b', null, st.salvage + st.bonusSalvage)),
        h('div', null, 'Fuel remaining', h('b', null, Math.round(res.fuelPct * 100) + '%')),
        h('div', null, 'Damage sustained', h('b', null, Math.round(res.damage))),
        h('div', null, 'Mission time', h('b', null, U.fmtTime(res.time))),
        h('div', null, 'Missiles shot down', h('b', null, st.missilesDowned)));
      const rewards = h('div', null);
      if (rw) {
        rewards.appendChild(h('h3', null, ok ? 'REWARDS' : 'RECOVERED'));
        for (const [k, v] of rw.lines) rewards.appendChild(h('div', { class: 'mono', style: 'display:flex;justify-content:space-between;max-width:420px' }, h('span', { class: 'dim' }, k), h('span', { style: 'color:#e8c24a' }, '+' + v)));
        rewards.appendChild(h('div', { class: 'mono', style: 'margin-top:6px' }, 'TOTAL ', h('span', { style: 'color:#e8c24a' }, '+' + rw.salvage + ' SALVAGE'), '   ', h('span', { style: 'color:var(--violet)' }, '+' + rw.tech + ' TECH')));
        if (rw.unlocks.length) rewards.appendChild(h('div', { class: 'mono', style: 'margin-top:8px;color:var(--amber)' }, 'BLUEPRINT RECOVERED: ' + rw.unlocks.map((w) => AS.Data.weapons[w].name).join(', ') + ' — fabricate it in the hangar.'));
        if (rw.newMission) { const nm = AS.Levels.byId[rw.newMission]; const nw = AS.Data.worldById(nm.world); rewards.appendChild(h('div', { class: 'mono', style: 'margin-top:6px;color:var(--cyan)' }, (nm.world !== m.world ? 'NEW WORLD UNLOCKED: ' + nw.name + ' — ' : 'NEXT OPERATION: ') + nm.name)); }
      }
      const buttons = ok
        ? h('div', { class: 'row', style: 'margin-top:18px;flex-wrap:wrap' }, btn('Continue to hangar', () => { AS.App.endGame(); this.showHangar(); }, 'primary'), btn('Replay mission', () => AS.App.restart()), btn('Mission select', () => { AS.App.endGame(); this.showSelect(m.world); }))
        : h('div', { class: 'row', style: 'margin-top:18px;flex-wrap:wrap' }, btn('Retry', () => AS.App.restart(), 'primary'), btn('Return to hangar', () => { AS.App.endGame(); this.showHangar(); }), btn('Main menu', () => { AS.App.endGame(); this.showMenu(); }));
      s.appendChild(h('div', { class: 'panel', style: 'width:min(860px,95vw);max-height:94vh;overflow:auto' },
        h('div', { class: 'planet mono', style: 'color:var(--amber);letter-spacing:4px' }, AS.Data.worldById(m.world).name + ' · OPERATION ' + m.name),
        h('div', { class: 'big ' + (ok ? 'ok' : 'fail') }, ok ? 'MISSION SUCCESS' : 'MISSION FAILED'),
        !ok ? h('div', { class: 'mono', style: 'color:var(--red)' }, res.reason) : null,
        h('h3', null, 'OBJECTIVES'), objs, grid, rewards, buttons));
      this.show('results');
    },

    showLoading(m) {
      const s = this.screens.loading; s.innerHTML = '';
      const w = AS.Data.worldById(m.world);
      s.appendChild(h('div', { class: 'ld' }, h('div', { class: 'mono', style: 'color:var(--amber);letter-spacing:5px' }, w.name + ' — ' + m.region.toUpperCase()), h('div', { class: 't' }, 'OPERATION ' + m.name), h('div', { class: 'bar' }, h('i')), h('div', { class: 'tip' }, 'TIP: ' + U.pick(TIPS))));
      this.show('loading');
    },
    confirm(text, yes) {
      const s = this.screens.modal; s.innerHTML = '';
      const prev = this.current;
      s.appendChild(h('div', { class: 'panel', style: 'width:min(520px,92vw)' }, h('h2', null, 'CONFIRM'), h('p', null, text), h('div', { class: 'row' }, btn('Confirm', () => { s.classList.remove('show'); yes(); }, 'danger'), btn('Cancel', () => { s.classList.remove('show'); if (prev) this.show(prev); }))));
      s.classList.add('show');
    },
    error(text) {
      const s = this.screens.modal; s.innerHTML = '';
      s.appendChild(h('div', { class: 'panel', style: 'width:min(520px,92vw)' }, h('h2', null, 'ERROR'), h('p', null, text), btn('Main menu', () => { s.classList.remove('show'); this.showMenu(); })));
      s.classList.add('show');
    },
  };
  UI.h = h; UI.btn = btn;
  AS.UI = UI;
})(window.AS);

/* HOLLOW CROWNS — "what am I fighting?": a card at the lower right with a close-up portrait of
 * the foe you are fighting, its name, what it is, its health, how it hurts you and a line about it.
 * It appears when you strike a foe, when a foe strikes you, or when your aim rests on one, and
 * fades a few seconds after the fight moves on.
 * Portraits: assets/portraits/<key>.png (see FoeCard.keys()); the files shipped are placeholders
 * (drawn by FoeCard.placeholder) to be replaced by painted art of the same name and size (256²).
 * A portrait missing from the folder is drawn as a placeholder in the game. */
'use strict';
(function (AS) {
  const U = AS.U, TAU = U.TAU, K = AS.UIKit;
  // what each creature is (cat picks the placeholder silhouette) and a line about it
  const INFO = {
    soldier: { cat: 'humanoid', what: 'Footman', line: 'Shield and spear; hurls spears at a dragon flying low.' },
    archer: { cat: 'humanoid', what: 'Archer', line: 'Looses arrows at anything in range, dragons included.' },
    elite: { cat: 'humanoid', what: 'Knight', line: 'Heavy armour: small blows glance off. Hits hard up close.' },
    siege: { cat: 'engine', what: 'Siege engine', line: 'Hurls stones at walls and towers. Helpless up close.' },
    bandit: { cat: 'humanoid', what: 'Outlaw', line: 'Crossbow and cudgel; guards stolen hoards.' },
    skeleton: { cat: 'undead', what: 'Risen dead', line: 'Brittle bones, but the fallen keep rising.' },
    wolf: { cat: 'beast', what: 'Wild beast', line: 'A fast pack hunter: weak alone, dangerous in numbers.' },
    moorhound: { cat: 'beast', what: 'Wild beast', line: 'Lean hound of the moors that runs prey to exhaustion.' },
    bear: { cat: 'beast', what: 'Wild beast', line: 'Thick hide and heavy claws; slow to fall.' },
    snowstalker: { cat: 'beast', what: 'Frost beast', line: 'The fastest hunter of the snows, pale as the drifts.' },
    gravehound: { cat: 'beast', what: 'Undead beast', line: 'A corpse-hound that hunts by the glow of its own rot.' },
    plagueboar: { cat: 'beast', what: 'Blighted beast', line: 'Sickly and savage; charges anything that moves.' },
    greatbeetle: { cat: 'crawler', what: 'Giant vermin', line: 'Armoured shell: slow, stubborn and hard to crack.' },
    spindlelurker: { cat: 'crawler', what: 'Giant spider', line: 'Lurks in the old forest and strikes from the shadows.' },
    icecrawler: { cat: 'crawler', what: 'Frost vermin', line: 'Ice-shelled crawler of the glaciers.' },
    carrioncrawler: { cat: 'crawler', what: 'Grave vermin', line: 'Feeds on the dead; its glow marks the blighted lands.' },
    treeshambler: { cat: 'tree', what: 'Forest guardian', line: 'Walking oak: slow, tough, and it hits like a falling tree.' },
    ogre: { cat: 'giant', what: 'Monster', line: 'A brute with a crushing club; throws rocks at low dragons.' },
    troll: { cat: 'giant', what: 'Monster', line: 'Its wounds close as you watch — finish it quickly.' },
    giant: { cat: 'giant', what: 'Giant', line: 'Towering and tough; its boulders can bring down a low dragon.' },
    titan: { cat: 'giant', what: 'Colossus', line: 'An ancient wanderer of the deep wilds. Beware its reach.' },
    icebehemoth: { cat: 'giant', what: 'Colossus', line: 'A mountain of ice that walks. Few have seen one and lived.' },
    spiderqueen: { cat: 'crawler', what: 'Colossus', line: 'Mother of the forest spiders. Leaves you be, unless provoked.' },
    greatworm: { cat: 'worm', what: 'Colossus', line: 'A worm the size of a river. It sleeps unless disturbed.' },
  };
  const FACTION_TROOPS = { soldier: 1, archer: 1, elite: 1, siege: 1 };
  const BOLT_NAME = { arcane: 'golden spheres', verdant: 'spectral arrows', frost: 'ice shards', necrotic: 'poison orbs' };

  const FoeCard = {
    INFO, focus: null, imgs: new Map(), ph: new Map(),
    // the portrait key of a foe: a realm's troops by realm (human_soldier, …), beasts and
    // monsters by kind (troll, …), dragons as dragon_<realm>
    keyOf(e) {
      if (e.isDragon) return 'dragon_' + e.fk;
      if (FACTION_TROOPS[e.role] && AS.Data.factions[e.team]) return e.team + '_' + e.role;
      return e.role;
    },
    keys() {
      const out = [];
      for (const fk of AS.Data.factionOrder) { out.push('dragon_' + fk); for (const r in FACTION_TROOPS) out.push(fk + '_' + r); }
      for (const r in INFO) if (!FACTION_TROOPS[r]) out.push(r);
      return out;
    },
    infoOf(key) {
      if (key.startsWith('dragon_')) { const F = AS.Data.factions[key.slice(7)]; return { cat: 'dragon', name: F ? F.dragon.name : 'Dragon', col: F ? F.color : '#c8a060' }; }
      const parts = key.split('_'), role = INFO[key] ? key : parts.slice(1).join('_'), F = AS.Data.factions[parts[0]];
      const I = INFO[role] || { cat: 'humanoid', what: key };
      const T = AS.Data.troops[role];
      return { cat: I.cat, name: (F ? F.adj + ' ' : '') + (T ? T.name : role), col: F ? F.color : { beast: '#8a6a4a', crawler: '#6a7a5a', giant: '#7a6a5a', tree: '#4a7a3a', worm: '#7a5a4a', undead: '#7a8a6a', engine: '#7a6a4a' }[I.cat] || '#7a6a5a' };
    },
    // the painted portrait if the file exists, else a placeholder (drawn once)
    portrait(key) {
      let im = this.imgs.get(key);
      if (im === undefined) {
        im = new Image(); im.ok = false;
        im.onload = () => { im.ok = true; }; im.onerror = () => { im.ok = false; im.bad = true; };
        im.src = 'assets/portraits/' + key + '.png';
        this.imgs.set(key, im);
      }
      if (im.ok) return im;
      if (!this.ph.has(key)) this.ph.set(key, this.placeholder(key));
      return this.ph.get(key);
    },
    /* a clearly-marked placeholder portrait: a tinted vignette, a silhouette of the creature's
     * kind, its name and "PLACEHOLDER ART" */
    placeholder(key, size) {
      const S = size || 256, cv = AS.Forge.canvas(S, S), c = cv.getContext('2d'), I = this.infoOf(key);
      const rgb = U.C.hex(I.col);
      const bg = c.createRadialGradient(S * 0.5, S * 0.42, S * 0.05, S * 0.5, S * 0.5, S * 0.75);
      bg.addColorStop(0, 'rgb(' + (rgb[0] * 0.55 + 40 | 0) + ',' + (rgb[1] * 0.55 + 34 | 0) + ',' + (rgb[2] * 0.55 + 30 | 0) + ')'); bg.addColorStop(1, '#0c0806');
      c.fillStyle = bg; c.fillRect(0, 0, S, S);
      // a faint grid, so it reads as a stand-in
      c.strokeStyle = 'rgba(255,240,210,0.06)'; c.lineWidth = 1;
      for (let i = 0; i <= S; i += S / 8) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, S); c.moveTo(0, i); c.lineTo(S, i); c.stroke(); }
      c.save(); c.translate(S / 2, S * 0.56); c.scale(S / 256, S / 256);
      c.fillStyle = 'rgba(8,5,4,0.88)'; c.strokeStyle = 'rgba(255,236,200,0.35)'; c.lineWidth = 2;
      SIL[I.cat] ? SIL[I.cat](c) : SIL.humanoid(c);
      c.restore();
      c.textAlign = 'center';
      c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(0, S - S * 0.2, S, S * 0.2);
      c.font = '700 ' + Math.round(S * 0.07) + 'px Georgia, serif'; c.fillStyle = '#f0e2c0'; c.fillText(I.name.toUpperCase(), S / 2, S - S * 0.11);
      c.font = '600 ' + Math.round(S * 0.045) + 'px Georgia, serif'; c.fillStyle = '#c8a060'; c.fillText('PLACEHOLDER ART · ' + key + '.png', S / 2, S - S * 0.045);
      c.strokeStyle = '#c8963a'; c.lineWidth = Math.max(2, S * 0.012); c.strokeRect(1, 1, S - 2, S - 2);
      return cv;
    },

    /* a foe was struck by, or struck, the player's dragon */
    note(g, e) {
      if (!e || !g || !g.player || e === g.player || !(e.isDragon || e.role)) return;
      if (e.team === g.playerKey || e.role === 'cart') return;
      if (this.focus && this.focus.e === e) { this.focus.t = 5; return; }
      // a stronger foe takes the card from a weaker one; otherwise the newest
      const f = this.focus;
      if (f && f.e.alive && f.t > 2 && (f.e.maxHp || 0) > (e.maxHp || 0) * 2) return;
      this.focus = { e, t: 5, a: 0, dead: 0 };
    },
    hover(g) {
      const p = g.player, I = p.input;
      if (!I || I.aimX === undefined || !g.grid) return;
      const list = g.grid.query(I.aimX, I.aimY + 30, 70, this._q || (this._q = []));
      let best = null, bd = 30 * 30;
      for (const e of list) {
        if (!e.alive || e === p || !(e.isDragon || e.role) || e.role === 'cart' || e.targetable === false || !g.hostile(p.team, e.team)) continue;
        const ey = e.py !== undefined ? e.py : e.y, dd = (e.x - I.aimX) ** 2 + (ey - I.aimY) ** 2;
        if (dd < bd) { bd = dd; best = e; }
      }
      list.length = 0;
      if (best) { if (!this.focus || this.focus.e !== best) this.note(g, best); else this.focus.t = Math.max(this.focus.t, 2.5); }
    },
    draw(ctx, g, W, H, s, dt) {
      this.hover(g);
      const f = this.focus;
      if (!f) return;
      const e = f.e, gone = !e.alive || (e.isDragon && e.down > 0) || e.removed;
      if (gone && !f.dead) { f.dead = 1.4; f.t = Math.min(f.t, 1.4); }
      f.t -= dt; f.a = U.clamp(f.a + (f.t > 0.3 ? dt * 5 : -dt * 3), 0, 1);
      if (f.t <= 0 && f.a <= 0) { this.focus = null; return; }
      const w = 316 * s, h = 132 * s, x = W - w - 16 * s, y = H - 16 * s - 58 * s - h;
      ctx.save(); ctx.globalAlpha = f.a;
      AS.HUD.plate(ctx, x, y, w, h, 10 * s, 0.9);
      // the portrait, framed
      const key = this.keyOf(e), im = this.portrait(key), ps = h - 20 * s, px = x + 10 * s, py = y + 10 * s;
      ctx.drawImage(im, px, py, ps, ps);
      ctx.strokeStyle = '#c8963a'; ctx.lineWidth = 2 * s; ctx.strokeRect(px, py, ps, ps);
      if (f.dead) { ctx.fillStyle = 'rgba(10,4,2,0.6)'; ctx.fillRect(px, py, ps, ps); ctx.font = AS.HUD.F(Math.round(15 * s)); ctx.textAlign = 'center'; K.keyText(ctx, e.isDragon ? 'DRIVEN OFF' : 'SLAIN', px + ps / 2, py + ps / 2, '#ffd27a', 3 * s); }
      // name, kind, health, threat, a line about it
      const tx = px + ps + 12 * s, tw = x + w - tx - 10 * s;
      let name, kind, threat, line;
      if (e.isDragon) {
        const F = e.fdef, B = AS.Data.breaths[F.dragon.breath] || {};
        name = F.dragon.name; kind = F.dragon.title + ' · ridden by ' + F.rider.name;
        threat = (B.name || 'Breath') + ' · ' + (BOLT_NAME[F.rider.bolt] || 'spells');
        line = F.dragon.style ? F.dragon.style + ': ' + (F.short || '') + '’s dragon.' : '';
      } else {
        const T = e.tdef || AS.Data.troops[e.role] || {}, I = INFO[e.role] || {}, F = AS.Data.factions[e.team];
        name = (F && FACTION_TROOPS[e.role] ? F.adj + ' ' : '') + (T.name || e.role);
        kind = (I.what || 'Foe') + (F ? ' · ' + F.short : e.team === 'wild' ? ' · the wilds' : '');
        const bits = [];
        if (T.melee) bits.push('Melee ' + Math.round(T.melee.dmg));
        if (T.ranged) bits.push({ arrow: 'Arrows', crossbow: 'Crossbow', stone: 'Siege stones', magic: 'Spells' }[T.ranged.kind] || 'Ranged');
        if (T.throwSpear) bits.push('Spears');
        if (T.throwRock) bits.push('Throws rocks');
        if (T.regen) bits.push('Regenerates');
        if (T.armor) bits.push('Armour ' + T.armor);
        threat = bits.join(' · ');
        line = I.line || '';
      }
      ctx.textAlign = 'left';
      ctx.font = AS.HUD.F(Math.round(15 * s)); K.keyText(ctx, name, tx, y + 22 * s, '#ffe6a0', 3 * s);
      ctx.font = AS.HUD.B(Math.round(11.5 * s), '600'); K.keyText(ctx, kind, tx, y + 40 * s, AS.HUD.COL.dim, 2.5 * s, tw);
      const hp = Math.max(0, e.hp) / (e.maxHp || 1);
      K.bar(ctx, tx, y + 50 * s, tw, 8 * s, hp, hp > 0.5 ? '#7ad06a' : hp > 0.25 ? '#e0b040' : '#e0473a');
      ctx.font = AS.HUD.B(Math.round(10.5 * s), '800'); ctx.textAlign = 'right';
      K.keyText(ctx, Math.ceil(Math.max(0, e.hp)) + ' / ' + Math.round(e.maxHp || 0), tx + tw - 3 * s, y + 54.5 * s, '#fff8e8', 2.5 * s);
      if (AS.Poison && AS.Poison.active(e)) { ctx.textAlign = 'left'; K.keyText(ctx, 'POISONED', tx + 3 * s, y + 54.5 * s, '#e0b0ff', 2.5 * s); }
      ctx.textAlign = 'left'; ctx.font = AS.HUD.B(Math.round(11.5 * s), '700');
      K.keyText(ctx, threat, tx, y + 74 * s, '#ffb08a', 2.5 * s, tw);
      ctx.font = AS.HUD.B(Math.round(11.5 * s), '500'); ctx.fillStyle = AS.HUD.COL.dim;
      const lines = AS.HUD.wrap ? AS.HUD.wrap(ctx, line, tw) : [line];
      lines.slice(0, 3).forEach((l, i) => ctx.fillText(l, tx, y + 92 * s + i * 14 * s));
      ctx.restore();
    },
  };

  // placeholder silhouettes, drawn about the origin in a 256-unit box
  const SIL = {
    humanoid(c) {
      c.beginPath(); c.arc(0, -78, 22, 0, TAU); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(-46, 70); c.lineTo(-38, -40); c.quadraticCurveTo(0, -60, 38, -40); c.lineTo(46, 70); c.closePath(); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(56, 80); c.lineTo(62, -110); c.lineWidth = 6; c.stroke(); c.lineWidth = 2;
      c.beginPath(); c.ellipse(-56, 10, 20, 34, 0, 0, TAU); c.fill(); c.stroke();
    },
    undead(c) {
      SIL.humanoid(c);
      c.fillStyle = 'rgba(255,236,200,0.35)'; c.beginPath(); c.arc(-8, -80, 5, 0, TAU); c.arc(8, -80, 5, 0, TAU); c.fill();
    },
    beast(c) {
      c.beginPath(); c.ellipse(-6, 0, 72, 34, 0, 0, TAU); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(52, -14); c.lineTo(96, -34); c.lineTo(104, -6); c.lineTo(66, 16); c.closePath(); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(84, -32); c.lineTo(90, -52); c.lineTo(96, -32); c.fill();
      for (const lx of [-50, -26, 24, 46]) { c.fillRect(lx - 6, 20, 12, 52); }
      c.beginPath(); c.moveTo(-74, -6); c.quadraticCurveTo(-110, -30, -112, -60); c.lineWidth = 9; c.stroke(); c.lineWidth = 2;
    },
    giant(c) {
      c.beginPath(); c.arc(0, -86, 24, 0, TAU); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(-70, 90); c.lineTo(-64, -50); c.quadraticCurveTo(0, -78, 64, -50); c.lineTo(70, 90); c.closePath(); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(-70, -40); c.lineTo(-104, 40); c.lineTo(-86, 46); c.lineTo(-56, -10); c.fill();
      c.beginPath(); c.moveTo(70, -40); c.lineTo(96, -100); c.lineWidth = 16; c.stroke(); c.lineWidth = 2;
      c.beginPath(); c.ellipse(100, -112, 20, 28, 0.4, 0, TAU); c.fill();
    },
    crawler(c) {
      c.lineWidth = 6; c.beginPath();
      for (const sd of [-1, 1]) for (let i = 0; i < 4; i++) { const a = -0.9 + i * 0.6; c.moveTo(0, 0); c.lineTo(sd * Math.cos(a) * 90, Math.sin(a) * 60 + 10); c.lineTo(sd * Math.cos(a) * 120, Math.sin(a) * 60 + 50); }
      c.stroke(); c.lineWidth = 2;
      c.beginPath(); c.ellipse(0, 10, 46, 56, 0, 0, TAU); c.fill(); c.stroke();
      c.beginPath(); c.arc(0, -56, 24, 0, TAU); c.fill(); c.stroke();
    },
    tree(c) {
      c.beginPath(); c.moveTo(-30, 90); c.lineTo(-24, -40); c.lineTo(24, -40); c.lineTo(30, 90); c.closePath(); c.fill(); c.stroke();
      c.lineWidth = 12; c.beginPath(); c.moveTo(-20, -20); c.lineTo(-80, -60); c.lineTo(-96, -20); c.moveTo(20, -20); c.lineTo(80, -70); c.lineTo(100, -40); c.stroke(); c.lineWidth = 2;
      c.beginPath(); c.arc(0, -78, 54, 0, TAU); c.fill(); c.stroke();
    },
    worm(c) {
      c.lineWidth = 46; c.lineCap = 'round'; c.beginPath(); c.moveTo(-100, 70); c.bezierCurveTo(-60, -40, 40, 100, 60, -40); c.stroke();
      c.lineWidth = 2; c.beginPath(); c.arc(64, -60, 34, 0, TAU); c.fill(); c.stroke();
    },
    engine(c) {
      c.fillRect(-90, -10, 180, 50);
      for (const wx of [-60, 60]) { c.beginPath(); c.arc(wx, 50, 26, 0, TAU); c.fill(); c.stroke(); }
      c.lineWidth = 10; c.beginPath(); c.moveTo(-40, -10); c.lineTo(50, -100); c.stroke(); c.lineWidth = 2;
      c.beginPath(); c.arc(56, -108, 18, 0, TAU); c.fill();
    },
    dragon(c) {
      c.beginPath(); c.moveTo(-20, 0); c.lineTo(-120, -90); c.lineTo(-90, -10); c.lineTo(-120, 30); c.closePath(); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(20, 0); c.lineTo(120, -90); c.lineTo(90, -10); c.lineTo(120, 30); c.closePath(); c.fill(); c.stroke();
      c.beginPath(); c.ellipse(0, 10, 28, 60, 0, 0, TAU); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(-14, -48); c.lineTo(0, -100); c.lineTo(14, -48); c.closePath(); c.fill(); c.stroke();
      c.lineWidth = 10; c.beginPath(); c.moveTo(0, 66); c.quadraticCurveTo(30, 100, 10, 120); c.stroke(); c.lineWidth = 2;
    },
  };

  AS.FoeCard = FoeCard;
})(window.AS);

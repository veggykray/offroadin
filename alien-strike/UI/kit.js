/* Shared UI kit for games on this engine: DOM builders for menu screens and the
 * canvas drawing helpers used by in-game HUDs (rounded rects, soft backdrops,
 * dimensional bars, keyline text, objective glyphs). Theme colours stay with
 * each game's HUD; everything here is colour-agnostic or takes colours as input. */
'use strict';
(function (AS) {
  const U = AS.U, TAU = U.TAU;

  /* ---------- DOM ---------- */
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
  /* ---------- canvas ---------- */
  function rrect(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  // soft translucent backdrop that fades out toward one side (no hard box)
  function wash(ctx, x, y, w, h, dir, a) {
    a = a || 0.5;
    const g = dir === 'left' ? ctx.createLinearGradient(x + w, 0, x, 0) : ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, 'rgba(4,9,14,' + a + ')'); g.addColorStop(0.7, 'rgba(4,9,14,' + (a * 0.45) + ')'); g.addColorStop(1, 'rgba(4,9,14,0)');
    ctx.fillStyle = g; rrect(ctx, x, y, w, h, Math.min(h / 2, 14)); ctx.fill();
  }

  function textShadow(ctx, on) {
    if (on) { ctx.shadowColor = 'rgba(0,0,0,0.75)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1; } else { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; }
  }

  // dimensional bar: dark well, gradient fill, specular line, faint ticks, damage ghost
  function bar(ctx, x, y, w, h, frac, col, ghost, extra) {
    frac = U.clamp(frac, 0, 1);
    const sh = ctx.shadowBlur; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    rrect(ctx, x, y, w, h, h / 2); ctx.fillStyle = 'rgba(2,6,10,0.62)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.09)'; ctx.lineWidth = 1; ctx.stroke();
    if (ghost !== undefined && ghost > frac + 0.002) {
      rrect(ctx, x, y, w * Math.min(1, ghost), h, h / 2); ctx.fillStyle = 'rgba(255,240,220,0.35)'; ctx.fill();
    }
    if (frac > 0.002) {
      const fw = Math.max(h, w * frac);
      const gr = ctx.createLinearGradient(0, y, 0, y + h);
      gr.addColorStop(0, U.C.css(col, 0.35)); gr.addColorStop(0.45, col); gr.addColorStop(1, U.C.css(col, -0.3));
      rrect(ctx, x, y, fw, h, h / 2); ctx.fillStyle = gr; ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(x + h * 0.5, y + 0.5, Math.max(0, fw - h), Math.max(1, h * 0.16));
    }
    if (extra > 0) { rrect(ctx, x, y - 1, w * Math.min(0.3, extra), h + 2, h / 2); ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill(); }
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    for (let i = 1; i < 10; i++) ctx.fillRect(Math.round(x + w * i / 10), y + 1, 1, h - 2);
    if (sh) textShadow(ctx, true);
  }

  // category glyph centred at (x, y); sz ≈ half-height. Dark keyline keeps it readable on sand and snow.
  function glyph(ctx, kind, x, y, sz, col, keyline) {
    const kl = keyline === undefined ? Math.max(1.2, sz * 0.32) : keyline;
    const path = () => {
      ctx.beginPath();
      if (kind === 'dia' || kind === 'odia') { ctx.moveTo(x, y - sz); ctx.lineTo(x + sz * 0.8, y); ctx.lineTo(x, y + sz); ctx.lineTo(x - sz * 0.8, y); ctx.closePath(); }
      else if (kind === 'star') { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? sz * 0.46 : sz * 1.08; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } ctx.closePath(); }
      else ctx.arc(x, y, sz * 0.86, 0, TAU);
    };
    const sb = ctx.shadowBlur; ctx.shadowBlur = 0;
    path();
    if (kl > 0) { ctx.strokeStyle = 'rgba(4,8,12,0.78)'; ctx.lineWidth = kl * 2 + (kind === 'odia' || kind === 'lz' ? sz * 0.34 : 0); ctx.stroke(); }
    if (kind === 'odia' || kind === 'lz') {
      ctx.strokeStyle = col; ctx.lineWidth = sz * 0.34; ctx.stroke();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, sz * (kind === 'lz' ? 0.3 : 0.24), 0, TAU); ctx.fill();
    } else { ctx.fillStyle = col; ctx.fill(); }
    ctx.shadowBlur = sb;
  }

  // text with a dark keyline under it: legible over bright terrain without a box
  function keyText(ctx, txt, x, y, col, lw, maxW) {
    const sb = ctx.shadowBlur; ctx.shadowBlur = 0;
    ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(3,7,11,0.82)'; ctx.lineWidth = lw || 3;
    if (maxW) ctx.strokeText(txt, x, y, maxW); else ctx.strokeText(txt, x, y);
    ctx.fillStyle = col;
    if (maxW) ctx.fillText(txt, x, y, maxW); else ctx.fillText(txt, x, y);
    ctx.shadowBlur = sb;
  }

  function fmtDist(d) { return d < 995 ? Math.max(10, Math.round(d / 10) * 10) + ' m' : (d / 1000).toFixed(1) + ' km'; }
  function fitText(ctx, txt, maxW) {
    maxW += 0.5; // float slack: text measured for this exact width must not be clipped
    if (ctx.measureText(txt).width <= maxW) return txt;
    while (txt.length > 4 && ctx.measureText(txt + '…').width > maxW) txt = txt.slice(0, -1);
    return txt.replace(/[\s—·,-]+$/, '') + '…';
  }
  AS.UIKit = { $, h, btn, rrect, wash, textShadow, bar, glyph, keyText, fmtDist, fitText };
})(window.AS);

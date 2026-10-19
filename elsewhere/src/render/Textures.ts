import * as THREE from 'three';

/**
 * Authored procedural textures, painted onto canvases at start-up (no image files, no
 * image-generation tooling). Each is a deliberate "illustrated surface": big readable cellular
 * pits for basalt, warm paving tiles for walkable ground, crackled porcelain, patinated copper.
 * Deterministic seeded RNG so every load looks the same.
 */
function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return (s % 100000) / 100000; };
}

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas'); c.width = c.height = size;
  return [c, c.getContext('2d')!];
}

function tex(c: HTMLCanvasElement, repeat = 1): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

/** Draw with wrap-around copies so the texture tiles. */
function wrapped(_ctx: CanvasRenderingContext2D, size: number, draw: (ox: number, oy: number) => void): void {
  for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) draw(ox, oy);
}

export function basaltTexture(seed = 7, size = 512): THREE.CanvasTexture {
  const [c, ctx] = canvas(size); const r = rng(seed);
  ctx.fillStyle = '#463a56'; ctx.fillRect(0, 0, size, size);
  // low-frequency mottling
  for (let i = 0; i < 26; i++) {
    const x = r() * size, y = r() * size, rad = 60 + r() * 120;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    const warm = r() > 0.5;
    g.addColorStop(0, warm ? 'rgba(96,70,92,0.35)' : 'rgba(44,38,70,0.4)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; wrapped(ctx, size, (ox, oy) => { ctx.beginPath(); ctx.arc(x + ox, y + oy, rad, 0, Math.PI * 2); ctx.fill(); });
  }
  // cellular pits: medium/large, distinct, with a lit upper-left rim and warm inner bounce
  const pits: { x: number; y: number; a: number; b: number; rot: number }[] = [];
  for (let i = 0; i < 95; i++) {
    const a = 9 + r() * 22, b = a * (0.6 + r() * 0.5);
    const x = r() * size, y = r() * size;
    if (pits.some((p) => Math.hypot(p.x - x, p.y - y) < (p.a + a) * 0.9)) continue;
    pits.push({ x, y, a, b, rot: r() * Math.PI });
  }
  for (const p of pits) wrapped(ctx, size, (ox, oy) => {
    ctx.save(); ctx.translate(p.x + ox, p.y + oy); ctx.rotate(p.rot);
    // rim highlight (offset up-left)
    ctx.beginPath(); ctx.ellipse(-1.5, -1.5, p.a + 1.5, p.b + 1.5, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(120,100,128,0.55)'; ctx.fill();
    // pit body
    const g = ctx.createRadialGradient(p.a * 0.25, p.b * 0.3, 0, 0, 0, p.a);
    g.addColorStop(0, '#15101c'); g.addColorStop(0.65, '#1b1522'); g.addColorStop(1, '#2a2233');
    ctx.beginPath(); ctx.ellipse(0, 0, p.a, p.b, 0, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
    // warm bounce on the lower-right inner wall
    ctx.beginPath(); ctx.ellipse(p.a * 0.3, p.b * 0.35, p.a * 0.55, p.b * 0.45, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(190,96,110,0.22)'; ctx.fill();
    ctx.restore();
  });
  // fine speckle
  for (let i = 0; i < 900; i++) { ctx.fillStyle = r() > 0.5 ? 'rgba(90,76,100,0.35)' : 'rgba(20,14,26,0.35)'; ctx.fillRect(r() * size, r() * size, 1.5, 1.5); }
  return tex(c);
}

export function pavingTexture(seed = 11, size = 512): THREE.CanvasTexture {
  const [c, ctx] = canvas(size); const r = rng(seed);
  const palette = ['#c48a7a', '#b3786b', '#d29a88', '#a86f63', '#cc9686', '#bd8474', '#c2857e', '#b98c7c'];
  ctx.fillStyle = '#6a4a4e'; ctx.fillRect(0, 0, size, size);
  const n = 3, tile = size / n, grout = 5;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const x = i * tile + grout / 2, y = j * tile + grout / 2, w = tile - grout;
    ctx.fillStyle = palette[Math.floor(r() * palette.length)];
    ctx.fillRect(x, y, w, w);
    // soft centre light + darker edge
    const g = ctx.createRadialGradient(x + w * 0.45, y + w * 0.4, 4, x + w / 2, y + w / 2, w * 0.75);
    g.addColorStop(0, 'rgba(255,230,210,0.16)'); g.addColorStop(1, 'rgba(70,40,60,0.22)');
    ctx.fillStyle = g; ctx.fillRect(x, y, w, w);
    // a few shallow pits per tile
    for (let k = 0; k < 2 + Math.floor(r() * 3); k++) {
      const px = x + 8 + r() * (w - 16), py = y + 8 + r() * (w - 16), pr = 2.5 + r() * 5;
      ctx.beginPath(); ctx.ellipse(px, py, pr, pr * 0.75, r() * 3, 0, Math.PI * 2); ctx.fillStyle = 'rgba(60,34,52,0.55)'; ctx.fill();
      ctx.beginPath(); ctx.ellipse(px - 1, py - 1, pr + 1, pr * 0.75 + 1, 0, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,220,200,0.25)'; ctx.lineWidth = 1; ctx.stroke();
    }
    // chipped corner now and then
    if (r() > 0.7) { ctx.fillStyle = 'rgba(70,45,55,0.5)'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 14, y); ctx.lineTo(x, y + 14); ctx.fill(); }
  }
  // broad stains that cross tile borders (breaks up the grid)
  for (let i = 0; i < 9; i++) {
    const x = r() * size, y = r() * size, rad = 50 + r() * 120;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, r() > 0.5 ? 'rgba(120,60,90,0.22)' : 'rgba(255,200,170,0.18)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; wrapped(ctx, size, (ox, oy) => { ctx.beginPath(); ctx.arc(x + ox, y + oy, rad, 0, Math.PI * 2); ctx.fill(); });
  }
  return tex(c);
}

export function porcelainTexture(seed = 5, size = 256): THREE.CanvasTexture {
  const [c, ctx] = canvas(size); const r = rng(seed);
  ctx.fillStyle = '#efe6dc'; ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 10; i++) {
    const x = r() * size, y = r() * size, rad = 40 + r() * 80;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, r() > 0.5 ? 'rgba(200,190,215,0.35)' : 'rgba(250,225,210,0.4)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; wrapped(ctx, size, (ox, oy) => { ctx.beginPath(); ctx.arc(x + ox, y + oy, rad, 0, Math.PI * 2); ctx.fill(); });
  }
  // crackle
  ctx.strokeStyle = 'rgba(110,100,130,0.28)'; ctx.lineWidth = 1;
  for (let i = 0; i < 28; i++) {
    let x = r() * size, y = r() * size; ctx.beginPath(); ctx.moveTo(x, y);
    for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 50; y += (r() - 0.5) * 50; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  return tex(c);
}

export function copperTexture(seed = 3, size = 256): THREE.CanvasTexture {
  const [c, ctx] = canvas(size); const r = rng(seed);
  ctx.fillStyle = '#b4713d'; ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 40; i++) { ctx.fillStyle = r() > 0.5 ? 'rgba(120,60,30,0.35)' : 'rgba(230,150,90,0.3)'; const y = r() * size; ctx.fillRect(0, y, size, 2 + r() * 10); }
  for (let i = 0; i < 60; i++) { const x = r() * size, y = r() * size, rad = 3 + r() * 14; ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fillStyle = 'rgba(80,160,140,0.22)'; ctx.fill(); }
  return tex(c);
}

export function mossTexture(seed = 9, size = 256): THREE.CanvasTexture {
  const [c, ctx] = canvas(size); const r = rng(seed);
  ctx.fillStyle = '#2f6e66'; ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 400; i++) { ctx.strokeStyle = r() > 0.5 ? 'rgba(90,190,170,0.35)' : 'rgba(20,70,80,0.4)'; ctx.lineWidth = 1 + r() * 2; const x = r() * size, y = r() * size; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r() - 0.5) * 16, y - 6 - r() * 14); ctx.stroke(); }
  return tex(c);
}

export function furTexture(base: string, streak: string, seed = 21, size = 256): THREE.CanvasTexture {
  const [c, ctx] = canvas(size); const r = rng(seed);
  ctx.fillStyle = base; ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 700; i++) {
    ctx.strokeStyle = streak; ctx.globalAlpha = 0.25 + r() * 0.4; ctx.lineWidth = 1 + r() * 1.5;
    const x = r() * size, y = r() * size, len = 10 + r() * 26, ang = Math.PI * 0.5 + (r() - 0.5) * 0.7;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(ang) * len * 0.5 + 4, y + Math.sin(ang) * len * 0.5, x + Math.cos(ang) * len, y + Math.sin(ang) * len); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  return tex(c);
}

/** Soft box-shaped contact shadow decal (dark centre fading to the edges). */
export function contactShadowTexture(size = 128): THREE.CanvasTexture {
  const [c, ctx] = canvas(size);
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / (size - 1), v = y / (size - 1);
    const e = Math.min(u, 1 - u, v, 1 - v) / 0.42; const a = Math.min(1, Math.max(0, e));
    const i = (y * size + x) * 4; img.data[i] = 40; img.data[i + 1] = 20; img.data[i + 2] = 60; img.data[i + 3] = Math.round(a * a * 255);
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** Soft radial glow sprite for liquid halos. */
export function glowTexture(size = 128): THREE.CanvasTexture {
  const [c, ctx] = canvas(size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.35, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** Toon gradient: 4 flat steps, slightly lifted shadows so black fur still reads. */
export function toonGradient(): THREE.DataTexture {
  const data = new Uint8Array([96, 142, 200, 255]);
  const t = new THREE.DataTexture(data, 4, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
}

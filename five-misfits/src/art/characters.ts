/**
 * Procedural production art for the cast, painted with Canvas2D into part textures and assembled
 * into articulated rigs. Faithful to the supplied group portrait: scruffy beast master with a
 * heron-like bird and a leathery spined jackal; towering giant woman with a bone-decorated round
 * shield and golden knuckle gauntlet; tiny big-headed fake wizard on a six-legged brass walker with
 * a cannon; slender bat-eared spearman with huge eyes and a snout; handsome duelist in a white shirt
 * with rapier and flintlock. Enemies: skeletal raiders and a skeletal shaman-archer.
 */
import { type Ctx, rr, shade, rgba, shadedPath } from './paint';

export const PPU = 40; // texture pixels per world unit for character parts
export const OUTLINE = '#1c1410';

export interface PartSpec {
  id: string;
  parent?: string;
  /** Size in world units. */
  w: number; h: number;
  /** Pivot (rotation origin) as fractions of the part: x from left, y from bottom. */
  pivot: [number, number];
  /** Pivot position in the parent's local space (world units). Root space: feet at (0,0), facing +x. */
  pos: [number, number];
  z: number;
  paint: (c: Ctx, W: number, H: number) => void;
}
export interface RigSpec { kind: string; parts: PartSpec[]; height: number }

// ---------------------------------------------------------------------------------------------
// shared painters (pixel space, y down, part faces +x / right)
// ---------------------------------------------------------------------------------------------
const outline = (c: Ctx, lw = 3) => { c.lineWidth = lw; c.strokeStyle = OUTLINE; c.lineJoin = 'round'; c.stroke(); };
const grad = (c: Ctx, base: string, y0: number, y1: number, l = 0.2, d = -0.25) => {
  const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, shade(base, l)); g.addColorStop(0.5, base); g.addColorStop(1, shade(base, d)); return g;
};
const hgrad = (c: Ctx, base: string, x0: number, x1: number, l = 0.18, d = -0.25) => {
  const g = c.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, shade(base, d)); g.addColorStop(0.45, base); g.addColorStop(1, shade(base, l)); return g;
};

function paintLeg(col: string, boot: string, opts: { fur?: boolean; bone?: boolean; wraps?: boolean } = {}) {
  return (c: Ctx, W: number, H: number) => {
    const pad = 4;
    if (opts.bone) {
      c.fillStyle = '#e6dcc4'; rr(c, W * 0.3, pad, W * 0.4, H * 0.5, 6); c.fill(); outline(c);
      c.beginPath(); c.arc(W * 0.5, H * 0.52, W * 0.3, 0, Math.PI * 2); c.fill(); outline(c);
      rr(c, W * 0.32, H * 0.55, W * 0.36, H * 0.3, 5); c.fill(); outline(c);
      c.fillStyle = '#d8ccae'; rr(c, W * 0.15, H * 0.84, W * 0.75, H * 0.14, 4); c.fill(); outline(c);
      return;
    }
    c.fillStyle = hgrad(c, col, pad, W - pad); rr(c, pad, pad, W - 2 * pad, H * 0.78, W * 0.3); c.fill(); outline(c);
    if (opts.fur) { c.strokeStyle = shade(col, -0.35); c.lineWidth = 2; for (let i = 0; i < 6; i++) { const y = H * (0.2 + i * 0.1); c.beginPath(); c.moveTo(pad + 2, y); c.lineTo(W * 0.5, y + 6); c.lineTo(W - pad - 2, y); c.stroke(); } }
    if (opts.wraps) { c.strokeStyle = shade(col, 0.3); c.lineWidth = 3; for (let i = 0; i < 4; i++) { const y = H * (0.3 + i * 0.12); c.beginPath(); c.moveTo(pad, y); c.lineTo(W - pad, y + 5); c.stroke(); } }
    // boot
    c.fillStyle = hgrad(c, boot, 0, W); rr(c, 1, H * 0.7, W - 2, H * 0.29, 5); c.fill(); outline(c);
    c.fillStyle = rgba('#ffffff', 0.15); c.fillRect(pad + 1, H * 0.72, W * 0.3, H * 0.12);
  };
}

function paintArm(sleeve: string, skin: string, opts: { bare?: boolean; glove?: string; bone?: boolean } = {}) {
  return (c: Ctx, W: number, H: number) => {
    const pad = 3;
    if (opts.bone) {
      c.fillStyle = '#e6dcc4'; rr(c, W * 0.3, pad, W * 0.4, H * 0.45, 6); c.fill(); outline(c);
      rr(c, W * 0.33, H * 0.48, W * 0.34, H * 0.4, 5); c.fill(); outline(c);
      c.beginPath(); c.arc(W * 0.5, H * 0.9, W * 0.32, 0, Math.PI * 2); c.fill(); outline(c);
      return;
    }
    const col = opts.bare ? skin : sleeve;
    c.fillStyle = hgrad(c, col, pad, W - pad); rr(c, pad, pad, W - 2 * pad, H * 0.6, W * 0.35); c.fill(); outline(c);
    c.fillStyle = hgrad(c, opts.bare || opts.glove ? (opts.glove ?? skin) : skin, pad, W - pad); rr(c, pad + 1, H * 0.55, W - 2 * pad - 2, H * 0.3, W * 0.3); c.fill(); outline(c);
    // hand
    c.fillStyle = opts.glove ?? skin; c.beginPath(); c.arc(W / 2, H * 0.88, W * 0.36, 0, Math.PI * 2); c.fill(); outline(c);
  };
}

function paintHead(skin: string, hair: string, opts: { beard?: string; hairStyle?: 'wild' | 'long' | 'short' | 'bald'; eyes?: number; brow?: boolean; tilt?: number; hat?: 'duelist' } = {}) {
  return (c: Ctx, W: number, H: number) => {
    const cx = W * 0.5, cy = H * 0.55, r = Math.min(W, H) * 0.36;
    if (opts.hairStyle === 'long') { c.fillStyle = hair; rr(c, cx - r * 1.05, cy - r * 0.9, r * 2.1, r * 2.3, r * 0.6); c.fill(); outline(c); }
    // face
    c.fillStyle = grad(c, skin, cy - r, cy + r, 0.15, -0.2); c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill(); outline(c);
    // ear
    c.fillStyle = skin; c.beginPath(); c.arc(cx - r * 0.95, cy, r * 0.25, 0, Math.PI * 2); c.fill(); outline(c, 2);
    // eye (side view: one eye, slightly forward)
    const ex = cx + r * 0.35, ey = cy - r * 0.12, es = (opts.eyes ?? 1) * r * 0.13;
    c.fillStyle = '#fff'; c.beginPath(); c.ellipse(ex, ey, es * 1.2, es, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#1a1a1a'; c.beginPath(); c.arc(ex + es * 0.3, ey, es * 0.6, 0, Math.PI * 2); c.fill();
    if (opts.brow) { c.strokeStyle = shade(hair, -0.3); c.lineWidth = 3; c.beginPath(); c.moveTo(ex - es * 1.4, ey - es * 1.8); c.lineTo(ex + es * 1.4, ey - es * 2.2); c.stroke(); }
    // nose + mouth
    c.strokeStyle = shade(skin, -0.45); c.lineWidth = 2.5; c.beginPath(); c.moveTo(cx + r * 0.7, cy - r * 0.05); c.lineTo(cx + r * 0.95, cy + r * 0.2); c.lineTo(cx + r * 0.72, cy + r * 0.3); c.stroke();
    c.beginPath(); c.moveTo(cx + r * 0.45, cy + r * 0.55); c.lineTo(cx + r * 0.8, cy + r * 0.5); c.stroke();
    // hair
    c.fillStyle = hair;
    if (opts.hairStyle === 'wild') {
      c.beginPath(); c.moveTo(cx - r * 1.1, cy - r * 0.2);
      for (let i = 0; i <= 8; i++) { const a = Math.PI + (i / 8) * Math.PI; const rr2 = r * (1.05 + ((i % 2) ? 0.45 : 0.1)); c.lineTo(cx + Math.cos(a) * rr2, cy + Math.sin(a) * rr2 - r * 0.1); }
      c.lineTo(cx + r * 0.9, cy - r * 0.35); c.closePath(); c.fill(); outline(c);
    } else if (opts.hairStyle === 'short' || opts.hairStyle === 'long') {
      c.beginPath(); c.arc(cx, cy - r * 0.05, r * 1.02, Math.PI * 1.05, Math.PI * 1.95); c.lineTo(cx + r * 0.85, cy - r * 0.45); c.lineTo(cx - r * 0.9, cy - r * 0.2); c.closePath(); c.fill(); outline(c);
    }
    if (opts.beard) { c.fillStyle = opts.beard; c.beginPath(); c.moveTo(cx - r * 0.4, cy + r * 0.35); c.lineTo(cx + r * 0.75, cy + r * 0.55); c.lineTo(cx + r * 0.4, cy + r * 1.35); c.lineTo(cx - r * 0.3, cy + r * 1.2); c.closePath(); c.fill(); outline(c); }
    if (opts.hat === 'duelist') {
      c.fillStyle = '#2a2320'; rr(c, cx - r * 1.35, cy - r * 1.05, r * 2.7, r * 0.22, 4); c.fill(); outline(c, 2);
      rr(c, cx - r * 0.95, cy - r * 1.6, r * 1.9, r * 0.65, 6); c.fill(); outline(c, 2);
      c.strokeStyle = '#c23b4a'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(cx - r * 0.4, cy - r * 1.45); c.quadraticCurveTo(cx - r * 1.4, cy - r * 2.1, cx - r * 1.9, cy - r * 1.6); c.stroke();
    }
  };
}

function paintTorso(col: string, trim: string, opts: { belt?: string; beads?: boolean; bones?: boolean; ragged?: boolean; shirt?: string; vest?: string; ribs?: boolean } = {}) {
  return (c: Ctx, W: number, H: number) => {
    const pad = 4;
    if (opts.ribs) {
      c.fillStyle = '#3a2224'; rr(c, pad, H * 0.55, W - 2 * pad, H * 0.45, 6); c.fill(); outline(c);
      c.fillStyle = '#e6dcc4'; rr(c, W * 0.2, pad, W * 0.6, H * 0.6, W * 0.2); c.fill(); outline(c);
      c.strokeStyle = '#4a3a2a'; c.lineWidth = 3; for (let i = 0; i < 4; i++) { const y = H * (0.15 + i * 0.12); c.beginPath(); c.moveTo(W * 0.22, y); c.quadraticCurveTo(W * 0.5, y + 8, W * 0.78, y); c.stroke(); }
      return;
    }
    // body
    c.fillStyle = hgrad(c, opts.shirt ?? col, pad, W - pad);
    c.beginPath(); c.moveTo(W * 0.15, pad); c.lineTo(W - W * 0.15, pad); c.lineTo(W - pad, H * 0.5); c.lineTo(W - W * 0.2, H - pad); c.lineTo(W * 0.2, H - pad); c.lineTo(pad, H * 0.5); c.closePath(); c.fill(); outline(c);
    if (opts.vest) { c.fillStyle = hgrad(c, opts.vest, pad, W - pad); c.beginPath(); c.moveTo(W * 0.15, pad); c.lineTo(W * 0.4, pad); c.lineTo(W * 0.45, H - pad); c.lineTo(W * 0.2, H - pad); c.lineTo(pad, H * 0.5); c.closePath(); c.fill(); outline(c, 2); c.beginPath(); c.moveTo(W * 0.85, pad); c.lineTo(W * 0.62, pad); c.lineTo(W * 0.6, H - pad); c.lineTo(W * 0.8, H - pad); c.lineTo(W - pad, H * 0.5); c.closePath(); c.fill(); outline(c, 2); }
    if (opts.ragged) { c.fillStyle = shade(col, -0.3); for (let i = 0; i < 5; i++) { const x = pad + i * (W - 2 * pad) / 5; c.beginPath(); c.moveTo(x, H * 0.75); c.lineTo(x + 8, H - 2); c.lineTo(x + 16, H * 0.75); c.closePath(); c.fill(); } }
    if (opts.belt) { c.fillStyle = opts.belt; c.fillRect(W * 0.18, H * 0.72, W * 0.64, H * 0.1); outline(c, 2); c.fillStyle = '#d6b35a'; c.fillRect(W * 0.46, H * 0.7, W * 0.1, H * 0.14); }
    if (opts.beads) { for (let i = 0; i < 7; i++) { const t = i / 6; const x = W * 0.25 + t * W * 0.5, y = H * 0.2 + Math.sin(t * Math.PI) * H * 0.2; c.fillStyle = ['#d9b35a', '#b8503a', '#e6dcc4'][i % 3]; c.beginPath(); c.arc(x, y, 4, 0, Math.PI * 2); c.fill(); } }
    if (opts.bones) { c.fillStyle = '#e6dcc4'; for (let i = 0; i < 5; i++) { const t = i / 4; const x = W * 0.2 + t * W * 0.6, y = H * 0.18 + Math.sin(t * Math.PI) * H * 0.22; rr(c, x - 3, y, 6, 16, 3); c.fill(); outline(c, 1.5); } c.beginPath(); c.arc(W * 0.5, H * 0.55, W * 0.11, 0, Math.PI * 2); c.fill(); outline(c, 2); c.fillStyle = '#2a2020'; c.beginPath(); c.arc(W * 0.46, H * 0.53, 3, 0, Math.PI * 2); c.arc(W * 0.55, H * 0.53, 3, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = trim; c.fillRect(W * 0.2, H - pad - 4, W * 0.6, 4);
  };
}

// ---------------------------------------------------------------------------------------------
// weapons & props
// ---------------------------------------------------------------------------------------------
const paintHatchet = (c: Ctx, W: number, H: number) => {
  c.fillStyle = '#6b4a2a'; rr(c, W * 0.42, H * 0.25, W * 0.16, H * 0.72, 4); c.fill(); outline(c, 2);
  c.fillStyle = hgrad(c, '#b9bcc2', W * 0.3, W); c.beginPath(); c.moveTo(W * 0.45, H * 0.1); c.lineTo(W * 0.95, H * 0.05); c.lineTo(W * 0.98, H * 0.42); c.lineTo(W * 0.45, H * 0.36); c.closePath(); c.fill(); outline(c, 2);
};
const paintRapier = (c: Ctx, W: number, H: number) => {
  c.fillStyle = '#d9dde3'; c.beginPath(); c.moveTo(W * 0.45, H * 0.02); c.lineTo(W * 0.55, H * 0.02); c.lineTo(W * 0.52, H * 0.78); c.lineTo(W * 0.48, H * 0.78); c.closePath(); c.fill(); outline(c, 1.5);
  c.strokeStyle = '#d6b35a'; c.lineWidth = 3; c.beginPath(); c.arc(W * 0.5, H * 0.84, W * 0.3, Math.PI * 0.9, Math.PI * 2.1); c.stroke();
  c.fillStyle = '#4a2f1a'; rr(c, W * 0.42, H * 0.8, W * 0.16, H * 0.18, 3); c.fill(); outline(c, 1.5);
};
const paintPistol = (c: Ctx, W: number, H: number) => {
  c.fillStyle = '#4a2f1a'; rr(c, W * 0.05, H * 0.45, W * 0.35, H * 0.5, 5); c.fill(); outline(c, 2);
  c.fillStyle = '#5a5f66'; rr(c, W * 0.2, H * 0.2, W * 0.78, H * 0.28, 4); c.fill(); outline(c, 2);
  c.fillStyle = '#d6b35a'; c.fillRect(W * 0.3, H * 0.12, W * 0.1, H * 0.16);
};
const paintSpear = (c: Ctx, W: number, H: number) => {
  c.fillStyle = '#7a5a34'; rr(c, W * 0.42, H * 0.1, W * 0.16, H * 0.9, 3); c.fill(); outline(c, 1.5);
  c.fillStyle = hgrad(c, '#c8ccd2', W * 0.3, W * 0.7); c.beginPath(); c.moveTo(W * 0.5, 0); c.lineTo(W * 0.9, H * 0.08); c.lineTo(W * 0.5, H * 0.16); c.lineTo(W * 0.1, H * 0.08); c.closePath(); c.fill(); outline(c, 2);
  c.strokeStyle = '#b8503a'; c.lineWidth = 3; c.beginPath(); c.moveTo(W * 0.3, H * 0.17); c.lineTo(W * 0.7, H * 0.2); c.stroke();
};
const paintSling = (c: Ctx, W: number, H: number) => {
  c.strokeStyle = '#7a5a34'; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(W * 0.5, H); c.lineTo(W * 0.5, H * 0.5); c.lineTo(W * 0.15, H * 0.05); c.moveTo(W * 0.5, H * 0.5); c.lineTo(W * 0.85, H * 0.05); c.stroke();
  c.strokeStyle = '#e6dcc4'; c.lineWidth = 2; c.beginPath(); c.moveTo(W * 0.15, H * 0.05); c.quadraticCurveTo(W * 0.5, H * 0.45, W * 0.85, H * 0.05); c.stroke();
};
const paintShield = (c: Ctx, W: number, H: number) => {
  const cx = W / 2, cy = H / 2, r = Math.min(W, H) / 2 - 3;
  c.fillStyle = grad(c, '#6b4a2a', cy - r, cy + r); c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill(); outline(c, 4);
  c.strokeStyle = '#3a2a1a'; c.lineWidth = 3; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(cx + i * r * 0.38, cy - r); c.lineTo(cx + i * r * 0.38, cy + r); c.stroke(); }
  c.strokeStyle = '#8a8f96'; c.lineWidth = 5; c.beginPath(); c.arc(cx, cy, r * 0.88, 0, Math.PI * 2); c.stroke();
  // bone cross & skulls
  c.fillStyle = '#e6dcc4'; rr(c, cx - 6, cy - r * 0.75, 12, r * 1.5, 6); c.fill(); outline(c, 2); rr(c, cx - r * 0.75, cy - 6, r * 1.5, 12, 6); c.fill(); outline(c, 2);
  for (const [dx, dy] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) { c.beginPath(); c.arc(cx + dx * r, cy + dy * r, r * 0.13, 0, Math.PI * 2); c.fill(); outline(c, 2); c.fillStyle = '#2a2020'; c.beginPath(); c.arc(cx + dx * r - 3, cy + dy * r, 2, 0, Math.PI * 2); c.arc(cx + dx * r + 3, cy + dy * r, 2, 0, Math.PI * 2); c.fill(); c.fillStyle = '#e6dcc4'; }
  c.fillStyle = '#d6b35a'; c.beginPath(); c.arc(cx, cy, r * 0.14, 0, Math.PI * 2); c.fill(); outline(c, 2);
};
const paintGauntlet = (c: Ctx, W: number, H: number) => {
  c.fillStyle = grad(c, '#c9962f', 0, H, 0.3, -0.3); rr(c, 3, H * 0.15, W - 6, H * 0.8, 8); c.fill(); outline(c, 3);
  c.fillStyle = '#e8c66a'; for (let i = 0; i < 4; i++) { rr(c, W * 0.12 + i * W * 0.2, H * 0.05, W * 0.15, H * 0.25, 4); c.fill(); outline(c, 2); }
  c.strokeStyle = '#7a5a1a'; c.lineWidth = 2; c.beginPath(); c.moveTo(W * 0.2, H * 0.5); c.lineTo(W * 0.8, H * 0.5); c.moveTo(W * 0.2, H * 0.7); c.lineTo(W * 0.8, H * 0.7); c.stroke();
};
const paintRoundShieldSmall = (c: Ctx, W: number, H: number) => {
  const cx = W / 2, cy = H / 2, r = Math.min(W, H) / 2 - 3;
  c.fillStyle = grad(c, '#5a4a3a', cy - r, cy + r); c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill(); outline(c, 3);
  c.strokeStyle = '#7a7f86'; c.lineWidth = 4; c.beginPath(); c.arc(cx, cy, r * 0.85, 0, Math.PI * 2); c.stroke();
  c.fillStyle = '#7a7f86'; c.beginPath(); c.arc(cx, cy, r * 0.25, 0, Math.PI * 2); c.fill(); outline(c, 2);
};
const paintAxe = (c: Ctx, W: number, H: number) => {
  c.fillStyle = '#5a3f22'; rr(c, W * 0.44, H * 0.1, W * 0.12, H * 0.9, 3); c.fill(); outline(c, 2);
  c.fillStyle = hgrad(c, '#9aa0a8', W * 0.5, W); c.beginPath(); c.moveTo(W * 0.5, H * 0.05); c.lineTo(W * 0.98, H * 0.02); c.lineTo(W * 0.92, H * 0.4); c.lineTo(W * 0.5, H * 0.33); c.closePath(); c.fill(); outline(c, 2);
};
const paintBow = (c: Ctx, W: number, H: number) => {
  c.strokeStyle = '#6b4a2a'; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(W * 0.3, H * 0.03); c.quadraticCurveTo(W * 1.1, H * 0.5, W * 0.3, H * 0.97); c.stroke();
  c.strokeStyle = OUTLINE; c.lineWidth = 2; c.beginPath(); c.moveTo(W * 0.3, H * 0.03); c.quadraticCurveTo(W * 1.1, H * 0.5, W * 0.3, H * 0.97); c.stroke();
  c.strokeStyle = '#e6dcc4'; c.lineWidth = 2; c.beginPath(); c.moveTo(W * 0.3, H * 0.03); c.lineTo(W * 0.3, H * 0.97); c.stroke();
};

// ---------------------------------------------------------------------------------------------
// hero-specific parts
// ---------------------------------------------------------------------------------------------
const paintBird = (c: Ctx, W: number, H: number) => {
  // heron-like bird: tall body, long neck, crest, orange/white wing patches
  c.fillStyle = '#3a3230'; c.beginPath(); c.ellipse(W * 0.45, H * 0.62, W * 0.3, H * 0.22, -0.3, 0, Math.PI * 2); c.fill(); outline(c, 2.5);
  c.fillStyle = '#e9e2d2'; c.beginPath(); c.ellipse(W * 0.4, H * 0.64, W * 0.17, H * 0.1, -0.3, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#d9773a'; c.beginPath(); c.ellipse(W * 0.55, H * 0.6, W * 0.1, H * 0.07, -0.3, 0, Math.PI * 2); c.fill();
  // tail feathers
  c.fillStyle = '#2a2422'; c.beginPath(); c.moveTo(W * 0.2, H * 0.6); c.lineTo(W * 0.02, H * 0.95); c.lineTo(W * 0.3, H * 0.78); c.closePath(); c.fill(); outline(c, 2);
  // neck + head
  c.strokeStyle = '#3a3230'; c.lineWidth = W * 0.14; c.lineCap = 'round'; c.beginPath(); c.moveTo(W * 0.6, H * 0.5); c.quadraticCurveTo(W * 0.72, H * 0.3, W * 0.65, H * 0.16); c.stroke();
  c.strokeStyle = OUTLINE; c.lineWidth = W * 0.14 + 4; c.globalCompositeOperation = 'destination-over'; c.beginPath(); c.moveTo(W * 0.6, H * 0.5); c.quadraticCurveTo(W * 0.72, H * 0.3, W * 0.65, H * 0.16); c.stroke(); c.globalCompositeOperation = 'source-over';
  c.fillStyle = '#3a3230'; c.beginPath(); c.arc(W * 0.65, H * 0.14, W * 0.12, 0, Math.PI * 2); c.fill(); outline(c, 2.5);
  c.fillStyle = '#f0c040'; c.beginPath(); c.arc(W * 0.7, H * 0.13, 3, 0, Math.PI * 2); c.fill(); c.fillStyle = '#000'; c.beginPath(); c.arc(W * 0.71, H * 0.13, 1.5, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#d9a33a'; c.beginPath(); c.moveTo(W * 0.74, H * 0.1); c.lineTo(W * 0.99, H * 0.17); c.lineTo(W * 0.74, H * 0.19); c.closePath(); c.fill(); outline(c, 2);
  // crest
  c.strokeStyle = '#d9773a'; c.lineWidth = 3; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(W * 0.6, H * 0.08); c.lineTo(W * (0.45 + i * 0.05), H * (0.0 + i * 0.02)); c.stroke(); }
  // legs
  c.strokeStyle = '#d9a33a'; c.lineWidth = 3; c.beginPath(); c.moveTo(W * 0.42, H * 0.82); c.lineTo(W * 0.4, H * 0.98); c.moveTo(W * 0.52, H * 0.82); c.lineTo(W * 0.54, H * 0.98); c.stroke();
};

const paintJackalBody = (c: Ctx, W: number, H: number) => {
  // leathery hide with bony spines along the back; lean, low body
  c.fillStyle = grad(c, '#6a5c52', H * 0.3, H, 0.15, -0.3);
  c.beginPath(); c.moveTo(W * 0.1, H * 0.6); c.quadraticCurveTo(W * 0.2, H * 0.3, W * 0.5, H * 0.32); c.quadraticCurveTo(W * 0.85, H * 0.33, W * 0.95, H * 0.55); c.lineTo(W * 0.9, H * 0.85); c.quadraticCurveTo(W * 0.5, H * 0.95, W * 0.12, H * 0.85); c.closePath(); c.fill(); outline(c, 3);
  // scaly texture
  c.fillStyle = 'rgba(40,36,34,0.25)'; for (let i = 0; i < 24; i++) { c.beginPath(); c.arc(W * (0.2 + (i % 8) * 0.09), H * (0.5 + Math.floor(i / 8) * 0.14), 3, 0, Math.PI * 2); c.fill(); }
  // spines
  c.fillStyle = '#e6dcc4'; for (let i = 0; i < 6; i++) { const x = W * (0.2 + i * 0.12); const y = H * (0.34 - Math.sin((i / 5) * Math.PI) * 0.03); c.beginPath(); c.moveTo(x - 6, y + 4); c.lineTo(x + 2, y - H * 0.3); c.lineTo(x + 8, y + 4); c.closePath(); c.fill(); outline(c, 2); }
  // tail
  c.strokeStyle = '#6a5c52'; c.lineWidth = 7; c.lineCap = 'round'; c.beginPath(); c.moveTo(W * 0.12, H * 0.62); c.quadraticCurveTo(W * -0.02, H * 0.5, W * 0.0, H * 0.25); c.stroke();
};
const paintJackalHead = (c: Ctx, W: number, H: number) => {
  c.fillStyle = grad(c, '#6a5c52', 0, H, 0.15, -0.3);
  c.beginPath(); c.moveTo(W * 0.05, H * 0.35); c.lineTo(W * 0.5, H * 0.2); c.lineTo(W * 0.98, H * 0.55); c.lineTo(W * 0.9, H * 0.72); c.lineTo(W * 0.5, H * 0.85); c.lineTo(W * 0.1, H * 0.8); c.closePath(); c.fill(); outline(c, 3);
  // ear
  c.beginPath(); c.moveTo(W * 0.2, H * 0.32); c.lineTo(W * 0.1, H * 0.02); c.lineTo(W * 0.4, H * 0.25); c.closePath(); c.fill(); outline(c, 2);
  // eye
  c.fillStyle = '#f0c040'; c.beginPath(); c.ellipse(W * 0.5, H * 0.45, 5, 3.5, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = '#000'; c.fillRect(W * 0.5 - 1, H * 0.45 - 3.5, 2, 7);
  // teeth & mouth
  c.strokeStyle = OUTLINE; c.lineWidth = 2; c.beginPath(); c.moveTo(W * 0.55, H * 0.68); c.lineTo(W * 0.93, H * 0.6); c.stroke();
  c.fillStyle = '#fff'; for (let i = 0; i < 4; i++) { const x = W * (0.6 + i * 0.09); c.beginPath(); c.moveTo(x, H * 0.66 - i); c.lineTo(x + 3, H * 0.78); c.lineTo(x + 6, H * 0.65 - i); c.closePath(); c.fill(); }
  c.fillStyle = '#2a1a1a'; c.beginPath(); c.arc(W * 0.95, H * 0.55, 3, 0, Math.PI * 2); c.fill();
};
const paintJackalLeg = (c: Ctx, W: number, H: number) => {
  c.fillStyle = '#5e5047'; rr(c, W * 0.25, 2, W * 0.5, H * 0.6, 5); c.fill(); outline(c, 2.5);
  rr(c, W * 0.3, H * 0.55, W * 0.4, H * 0.43, 4); c.fill(); outline(c, 2.5);
  c.fillStyle = '#e6dcc4'; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(W * (0.3 + i * 0.18), H * 0.95); c.lineTo(W * (0.36 + i * 0.18), H); c.lineTo(W * (0.42 + i * 0.18), H * 0.95); c.fill(); }
};

// Walker (fake wizard) parts
const paintChassis = (c: Ctx, W: number, H: number) => {
  // brass/copper body with rivets, pipes, a funnel horn and glass bulbs; NO wheels
  c.fillStyle = grad(c, '#8a5a2a', 0, H, 0.25, -0.3); rr(c, 4, H * 0.3, W - 8, H * 0.65, 10); c.fill(); outline(c, 3);
  c.fillStyle = grad(c, '#b07a3a', 0, H, 0.3, -0.2); rr(c, W * 0.1, H * 0.18, W * 0.8, H * 0.25, 8); c.fill(); outline(c, 2.5);
  c.fillStyle = '#d6b35a'; for (let i = 0; i < 8; i++) { c.beginPath(); c.arc(W * 0.1 + i * (W * 0.8 / 7), H * 0.85, 3, 0, Math.PI * 2); c.fill(); }
  // pipes
  c.strokeStyle = '#c08a4a'; c.lineWidth = 7; c.lineCap = 'round'; c.beginPath(); c.moveTo(W * 0.2, H * 0.3); c.lineTo(W * 0.2, H * 0.05); c.lineTo(W * 0.35, H * 0.05); c.stroke();
  c.strokeStyle = OUTLINE; c.lineWidth = 2; c.beginPath(); c.moveTo(W * 0.2, H * 0.3); c.lineTo(W * 0.2, H * 0.05); c.lineTo(W * 0.35, H * 0.05); c.stroke();
  // funnel horn
  c.fillStyle = '#d6b35a'; c.beginPath(); c.moveTo(W * 0.08, H * 0.3); c.lineTo(W * 0.0, H * 0.0); c.lineTo(W * 0.22, H * 0.0); c.lineTo(W * 0.16, H * 0.3); c.closePath(); c.fill(); outline(c, 2);
  // glass bulbs
  for (const [bx, col] of [[0.62, '#8fe0ff'], [0.74, '#c9a7ff']] as [number, string][]) { c.fillStyle = rgba(col, 0.85); c.beginPath(); c.arc(W * bx, H * 0.12, W * 0.05, 0, Math.PI * 2); c.fill(); outline(c, 2); c.fillStyle = '#fff'; c.beginPath(); c.arc(W * bx - 2, H * 0.1, 2, 0, Math.PI * 2); c.fill(); }
  // gauge
  c.fillStyle = '#e6dcc4'; c.beginPath(); c.arc(W * 0.5, H * 0.6, W * 0.07, 0, Math.PI * 2); c.fill(); outline(c, 2); c.strokeStyle = '#b8503a'; c.lineWidth = 2; c.beginPath(); c.moveTo(W * 0.5, H * 0.6); c.lineTo(W * 0.54, H * 0.54); c.stroke();
};
const paintCannon = (c: Ctx, W: number, H: number) => {
  c.fillStyle = grad(c, '#3a3d44', 0, H, 0.35, -0.3); rr(c, 0, H * 0.2, W, H * 0.6, H * 0.3); c.fill(); outline(c, 3);
  c.fillStyle = '#5a5f66'; rr(c, W * 0.82, H * 0.1, W * 0.16, H * 0.8, 6); c.fill(); outline(c, 2.5);
  c.fillStyle = '#d6b35a'; rr(c, W * 0.1, H * 0.12, W * 0.1, H * 0.76, 4); c.fill(); outline(c, 2);
  c.fillStyle = '#111'; c.beginPath(); c.ellipse(W * 0.96, H * 0.5, 3, H * 0.22, 0, 0, Math.PI * 2); c.fill();
};
const paintLegSeg = (col: string) => (c: Ctx, W: number, H: number) => {
  c.fillStyle = hgrad(c, col, 0, W, 0.3, -0.3); rr(c, 2, 2, W - 4, H - 4, W * 0.4); c.fill(); outline(c, 2.5);
  c.fillStyle = '#d6b35a'; c.beginPath(); c.arc(W / 2, 6, 3, 0, Math.PI * 2); c.fill();
};
const paintFoot = (c: Ctx, W: number, H: number) => { c.fillStyle = '#4a4036'; rr(c, 1, 1, W - 2, H - 2, 4); c.fill(); outline(c, 2); };
const paintPilot = (c: Ctx, W: number, H: number) => {
  // tiny body in a patched coat with a scarf
  c.fillStyle = grad(c, '#6b4f8a', 0, H); rr(c, W * 0.2, H * 0.2, W * 0.6, H * 0.78, 8); c.fill(); outline(c, 2.5);
  c.fillStyle = '#b8503a'; rr(c, W * 0.15, H * 0.1, W * 0.7, H * 0.22, 6); c.fill(); outline(c, 2);
  c.fillStyle = '#e9cfa8'; rr(c, W * 0.6, H * 0.5, W * 0.3, H * 0.15, 4); c.fill(); outline(c, 2); // arm reaching a lever
};
const paintBigHead = (c: Ctx, W: number, H: number) => {
  const cx = W * 0.5, cy = H * 0.52, r = Math.min(W, H) * 0.44;
  // head-support rig: brass arcs behind/around the cranium
  c.strokeStyle = '#c9962f'; c.lineWidth = 5; c.beginPath(); c.arc(cx, cy, r * 1.08, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
  c.strokeStyle = OUTLINE; c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, r * 1.08 + 3, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); c.beginPath(); c.arc(cx, cy, r * 1.08 - 3, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
  // enormous pale cranium
  c.fillStyle = grad(c, '#e8cdb0', cy - r, cy + r, 0.12, -0.18); c.beginPath(); c.ellipse(cx, cy, r, r * 1.05, 0, 0, Math.PI * 2); c.fill(); outline(c, 3);
  c.fillStyle = 'rgba(255,255,255,0.25)'; c.beginPath(); c.ellipse(cx - r * 0.3, cy - r * 0.5, r * 0.35, r * 0.2, -0.3, 0, Math.PI * 2); c.fill();
  // big ear, brow, sunken eyes, thin mouth
  c.fillStyle = '#e0bfa0'; c.beginPath(); c.ellipse(cx - r * 0.85, cy + r * 0.1, r * 0.22, r * 0.3, 0, 0, Math.PI * 2); c.fill(); outline(c, 2);
  c.fillStyle = '#fff'; c.beginPath(); c.ellipse(cx + r * 0.42, cy + r * 0.12, r * 0.16, r * 0.12, 0, 0, Math.PI * 2); c.fill(); outline(c, 1.5);
  c.fillStyle = '#2a4a6a'; c.beginPath(); c.arc(cx + r * 0.47, cy + r * 0.12, r * 0.07, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#8a6a50'; c.lineWidth = 3; c.beginPath(); c.moveTo(cx + r * 0.2, cy - r * 0.05); c.lineTo(cx + r * 0.65, cy - r * 0.1); c.stroke();
  c.strokeStyle = '#6a4a3a'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(cx + r * 0.75, cy + r * 0.3); c.lineTo(cx + r * 0.9, cy + r * 0.45); c.lineTo(cx + r * 0.72, cy + r * 0.5); c.stroke();
  c.beginPath(); c.moveTo(cx + r * 0.45, cy + r * 0.7); c.lineTo(cx + r * 0.8, cy + r * 0.68); c.stroke();
  // a few wisps of hair
  c.strokeStyle = '#cfc3b0'; c.lineWidth = 2; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(cx - r * 0.6 + i * 6, cy - r * 0.85); c.lineTo(cx - r * 0.7 + i * 7, cy - r * 1.15); c.stroke(); }
};

const paintBatHead = (c: Ctx, W: number, H: number) => {
  const cx = W * 0.5, cy = H * 0.62, r = Math.min(W, H) * 0.26;
  // bat ears
  c.fillStyle = grad(c, '#9a8f84', 0, H * 0.5); for (const s of [-1, 1]) { c.beginPath(); c.moveTo(cx + s * r * 0.2, cy - r * 0.6); c.lineTo(cx + s * r * 0.95, cy - r * 2.8); c.lineTo(cx + s * r * 1.1, cy - r * 0.3); c.closePath(); c.fill(); outline(c, 2.5); c.fillStyle = '#c9a39a'; c.beginPath(); c.moveTo(cx + s * r * 0.45, cy - r * 0.6); c.lineTo(cx + s * r * 0.9, cy - r * 2.2); c.lineTo(cx + s * r * 0.95, cy - r * 0.5); c.closePath(); c.fill(); c.fillStyle = grad(c, '#9a8f84', 0, H * 0.5); }
  // head with armadillo snout
  c.fillStyle = grad(c, '#a89a8c', cy - r, cy + r, 0.15, -0.2); c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill(); outline(c, 3);
  c.fillStyle = '#8a7c70'; rr(c, cx + r * 0.6, cy - r * 0.1, r * 0.9, r * 0.5, r * 0.2); c.fill(); outline(c, 2.5);
  c.strokeStyle = '#6a5c52'; c.lineWidth = 2; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(cx + r * (0.75 + i * 0.22), cy - r * 0.1); c.lineTo(cx + r * (0.75 + i * 0.22), cy + r * 0.4); c.stroke(); }
  c.fillStyle = '#2a1a1a'; c.beginPath(); c.arc(cx + r * 1.45, cy + r * 0.15, 3, 0, Math.PI * 2); c.fill();
  // enormous eyes
  for (const [ex, ey, s] of [[cx + r * 0.3, cy - r * 0.25, 1], [cx - r * 0.25, cy - r * 0.3, 0.85]] as [number, number, number][]) {
    c.fillStyle = '#fff'; c.beginPath(); c.arc(ex, ey, r * 0.42 * s, 0, Math.PI * 2); c.fill(); outline(c, 2);
    c.fillStyle = '#2a3a2a'; c.beginPath(); c.arc(ex + 2, ey, r * 0.26 * s, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#000'; c.beginPath(); c.arc(ex + 3, ey, r * 0.14 * s, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(ex - 2, ey - 4, 2.5, 0, Math.PI * 2); c.fill();
  }
  // hood/collar wisps
  c.fillStyle = '#2f2a2c'; c.beginPath(); c.moveTo(cx - r * 1.2, cy + r * 0.6); c.lineTo(cx + r * 0.6, cy + r * 1.0); c.lineTo(cx + r * 0.2, cy + r * 1.4); c.lineTo(cx - r * 1.2, cy + r * 1.2); c.closePath(); c.fill(); outline(c, 2);
};

const paintSkull = (horns: boolean, antlers: boolean) => (c: Ctx, W: number, H: number) => {
  const cx = W * 0.5, cy = H * 0.6, r = Math.min(W, H) * 0.3;
  if (horns) { c.fillStyle = '#d8ccae'; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(cx + s * r * 0.5, cy - r * 0.5); c.quadraticCurveTo(cx + s * r * 1.6, cy - r * 0.9, cx + s * r * 1.1, cy - r * 2.2); c.lineTo(cx + s * r * 0.8, cy - r * 0.7); c.closePath(); c.fill(); outline(c, 2.5); } }
  if (antlers) { c.strokeStyle = '#6b5a3a'; c.lineWidth = 5; c.lineCap = 'round'; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(cx + s * r * 0.4, cy - r * 0.7); c.lineTo(cx + s * r * 0.9, cy - r * 2.3); c.moveTo(cx + s * r * 0.7, cy - r * 1.6); c.lineTo(cx + s * r * 1.5, cy - r * 2.1); c.stroke(); } }
  c.fillStyle = grad(c, '#e6dcc4', cy - r, cy + r, 0.1, -0.2); c.beginPath(); c.arc(cx, cy - r * 0.1, r, 0, Math.PI * 2); c.fill(); outline(c, 3);
  c.fillStyle = '#d8ccae'; rr(c, cx - r * 0.45, cy + r * 0.5, r * 1.1, r * 0.55, 5); c.fill(); outline(c, 2.5);
  c.fillStyle = '#1a1010'; c.beginPath(); c.ellipse(cx + r * 0.42, cy - r * 0.1, r * 0.26, r * 0.3, 0, 0, Math.PI * 2); c.fill(); c.beginPath(); c.ellipse(cx - r * 0.2, cy - r * 0.15, r * 0.2, r * 0.26, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = antlers ? '#5aff8a' : '#ff6a4a'; c.beginPath(); c.arc(cx + r * 0.45, cy - r * 0.1, r * 0.1, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.moveTo(cx + r * 0.7, cy + r * 0.25); c.lineTo(cx + r * 0.85, cy + r * 0.5); c.lineTo(cx + r * 0.6, cy + r * 0.45); c.closePath(); c.fillStyle = '#1a1010'; c.fill();
  c.strokeStyle = '#1a1010'; c.lineWidth = 1.5; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(cx - r * 0.3 + i * r * 0.25, cy + r * 0.55); c.lineTo(cx - r * 0.3 + i * r * 0.25, cy + r * 1.0); c.stroke(); }
};

const paintGlow = (col: string) => (c: Ctx, W: number, H: number) => {
  const g = c.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2); g.addColorStop(0, rgba(col, 0.9)); g.addColorStop(0.4, rgba(col, 0.35)); g.addColorStop(1, rgba(col, 0));
  c.fillStyle = g; c.fillRect(0, 0, W, H);
};

// ---------------------------------------------------------------------------------------------
// rig specs
// ---------------------------------------------------------------------------------------------
function biped(kind: string, o: {
  height: number; legW: number; legH: number; torsoW: number; torsoH: number; headR: number; armW: number; armH: number;
  leg: PartSpec['paint']; torso: PartSpec['paint']; head: PartSpec['paint']; arm: PartSpec['paint'];
  weaponF?: { w: number; h: number; paint: PartSpec['paint']; pivot?: [number, number]; z?: number };
  weaponB?: { w: number; h: number; paint: PartSpec['paint']; pivot?: [number, number]; z?: number; pos?: [number, number] };
  extras?: PartSpec[];
  shoulderBack?: number;
}): RigSpec {
  const hip = o.legH * 0.95, shoulder = hip + o.torsoH * 0.9;
  const parts: PartSpec[] = [
    { id: 'legB', w: o.legW, h: o.legH, pivot: [0.5, 0.95], pos: [-o.torsoW * 0.18, hip], z: 0, paint: o.leg },
    { id: 'armB', w: o.armW, h: o.armH, pivot: [0.5, 0.92], pos: [-o.torsoW * 0.3, shoulder], z: 1, paint: o.arm },
    { id: 'torso', w: o.torsoW, h: o.torsoH, pivot: [0.5, 0.05], pos: [0, hip - o.torsoH * 0.05], z: 2, paint: o.torso },
    { id: 'legF', w: o.legW, h: o.legH, pivot: [0.5, 0.95], pos: [o.torsoW * 0.18, hip], z: 3, paint: o.leg },
    { id: 'head', w: o.headR * 2.6, h: o.headR * 2.6, pivot: [0.5, 0.3], pos: [o.torsoW * 0.05, shoulder + o.torsoH * 0.08], z: 4, paint: o.head },
    { id: 'armF', w: o.armW, h: o.armH, pivot: [0.5, 0.92], pos: [o.torsoW * 0.3, shoulder], z: 5, paint: o.arm },
  ];
  if (o.weaponB) parts.push({ id: 'weaponB', parent: 'armB', w: o.weaponB.w, h: o.weaponB.h, pivot: o.weaponB.pivot ?? [0.5, 0.5], pos: o.weaponB.pos ?? [0, -o.armH * 0.85], z: o.weaponB.z ?? 1.5, paint: o.weaponB.paint });
  if (o.weaponF) parts.push({ id: 'weaponF', parent: 'armF', w: o.weaponF.w, h: o.weaponF.h, pivot: o.weaponF.pivot ?? [0.5, 0.9], pos: [0, -o.armH * 0.85], z: o.weaponF.z ?? 6, paint: o.weaponF.paint });
  if (o.extras) parts.push(...o.extras);
  return { kind, parts, height: o.height };
}

export const RIGS: Record<string, RigSpec> = {
  beast: biped('beast', {
    height: 3.0, legW: 0.5, legH: 1.3, torsoW: 1.25, torsoH: 1.2, headR: 0.36, armW: 0.34, armH: 1.1,
    leg: paintLeg('#7a5a3a', '#4a3a2a', { fur: true }), torso: paintTorso('#a98a62', '#6b4a2a', { beads: true, belt: '#4a3a2a' }),
    head: paintHead('#d9a57a', '#6b4a2a', { hairStyle: 'wild', beard: '#8a5a3a', brow: true }), arm: paintArm('#a98a62', '#d9a57a', { bare: true }),
    weaponF: { w: 0.7, h: 1.0, paint: paintHatchet },
    extras: [{ id: 'bird', parent: 'armB', w: 1.1, h: 1.3, pivot: [0.45, 0.98], pos: [0.05, -0.95], z: 1.6, paint: paintBird }],
  }),
  giant: biped('giant', {
    height: 5.5, legW: 0.85, legH: 2.3, torsoW: 2.3, torsoH: 2.4, headR: 0.5, armW: 0.6, armH: 2.0,
    leg: paintLeg('#6b4a2a', '#3a2a1a', { fur: true }), torso: paintTorso('#4a3528', '#6b4a2a', { bones: true, belt: '#2a1a10' }),
    head: paintHead('#d8b093', '#2a1f1a', { hairStyle: 'long', brow: true }), arm: paintArm('#4a3528', '#d8b093', { bare: true }),
    weaponF: { w: 1.0, h: 1.0, paint: paintGauntlet, pivot: [0.5, 0.5], z: 6 },
    weaponB: { w: 2.5, h: 2.5, paint: paintShield, pivot: [0.5, 0.5], pos: [0.1, -1.3], z: 1.5 },
  }),
  spear: biped('spear', {
    height: 3.3, legW: 0.32, legH: 1.45, torsoW: 0.85, torsoH: 1.3, headR: 0.42, armW: 0.26, armH: 1.2,
    leg: paintLeg('#4a4044', '#2f2a2c', { wraps: true }), torso: paintTorso('#2f2a2c', '#5a4a3a', { ragged: true, belt: '#6b4a2a' }),
    head: paintBatHead, arm: paintArm('#2f2a2c', '#a89a8c'),
    weaponF: { w: 0.5, h: 3.8, paint: paintSpear, pivot: [0.5, 0.55], z: 6 },
    weaponB: { w: 0.5, h: 0.7, paint: paintSling, pivot: [0.5, 0.95], pos: [0, -1.0], z: 1.5 },
  }),
  duelist: biped('duelist', {
    height: 3.0, legW: 0.4, legH: 1.4, torsoW: 1.0, torsoH: 1.2, headR: 0.34, armW: 0.3, armH: 1.1,
    leg: paintLeg('#2a2a30', '#3a2a1a'), torso: paintTorso('#f1ebdd', '#4a2f1a', { shirt: '#f1ebdd', vest: '#6b4a2a', belt: '#3a2a1a' }),
    head: paintHead('#e3b691', '#2a1f1a', { hairStyle: 'short', brow: true, hat: 'duelist' }), arm: paintArm('#f1ebdd', '#e3b691'),
    weaponF: { w: 0.4, h: 1.9, paint: paintRapier, pivot: [0.5, 0.86], z: 6 },
    weaponB: { w: 0.7, h: 0.5, paint: paintPistol, pivot: [0.2, 0.7], pos: [0.05, -0.95], z: 1.5 },
  }),
  raider: biped('raider', {
    height: 3.0, legW: 0.4, legH: 1.3, torsoW: 1.1, torsoH: 1.25, headR: 0.38, armW: 0.3, armH: 1.1,
    leg: paintLeg('#e6dcc4', '#3a2a1a', { bone: true }), torso: paintTorso('#3a2224', '#5a2a2a', { ribs: true }),
    head: paintSkull(true, false), arm: paintArm('#e6dcc4', '#e6dcc4', { bone: true }),
    weaponF: { w: 0.7, h: 1.4, paint: paintAxe, pivot: [0.5, 0.9], z: 6 },
    weaponB: { w: 1.3, h: 1.3, paint: paintRoundShieldSmall, pivot: [0.5, 0.5], pos: [0.1, -0.7], z: 1.5 },
  }),
  archer: biped('archer', {
    height: 3.0, legW: 0.36, legH: 1.3, torsoW: 1.0, torsoH: 1.3, headR: 0.38, armW: 0.28, armH: 1.1,
    leg: paintLeg('#e6dcc4', '#2a2a2a', { bone: true }), torso: paintTorso('#2a3a2e', '#1a2a1e', { ragged: true }),
    head: paintSkull(false, true), arm: paintArm('#2a3a2e', '#e6dcc4', { bone: true }),
    weaponF: { w: 0.6, h: 1.6, paint: paintBow, pivot: [0.3, 0.5], z: 6 },
    extras: [{ id: 'glow', w: 2.2, h: 2.2, pivot: [0.5, 0.5], pos: [0.3, 1.9], z: -0.5, paint: paintGlow('#5aff8a') }],
  }),
  jackal: {
    kind: 'jackal', height: 0.95, parts: [
      { id: 'legBB', w: 0.26, h: 0.55, pivot: [0.5, 0.05], pos: [-0.5, 0.5], z: 0, paint: paintJackalLeg },
      { id: 'legBF', w: 0.26, h: 0.55, pivot: [0.5, 0.05], pos: [0.45, 0.5], z: 0, paint: paintJackalLeg },
      { id: 'body', w: 1.9, h: 0.9, pivot: [0.45, 0.35], pos: [0, 0.45], z: 1, paint: paintJackalBody },
      { id: 'head', w: 0.8, h: 0.6, pivot: [0.1, 0.5], pos: [0.75, 0.75], z: 2, paint: paintJackalHead },
      { id: 'legFB', w: 0.26, h: 0.55, pivot: [0.5, 0.05], pos: [-0.35, 0.5], z: 3, paint: paintJackalLeg },
      { id: 'legFF', w: 0.26, h: 0.55, pivot: [0.5, 0.05], pos: [0.6, 0.5], z: 3, paint: paintJackalLeg },
    ],
  },
  inventor: {
    kind: 'inventor', height: 3.4, parts: [
      // six legs: 3 far (dark) + 3 near (light), each upper + lower + foot. Positions are driven per frame.
      ...[0, 1, 2].flatMap((i) => [
        { id: `legU_b${i}`, w: 0.16, h: 0.85, pivot: [0.5, 0.95] as [number, number], pos: [0, 0] as [number, number], z: 0, paint: paintLegSeg('#6a4a2a') },
        { id: `legL_b${i}`, w: 0.13, h: 0.95, pivot: [0.5, 0.95] as [number, number], pos: [0, 0] as [number, number], z: 0, paint: paintLegSeg('#5a3f22') },
        { id: `foot_b${i}`, w: 0.3, h: 0.14, pivot: [0.5, 0.5] as [number, number], pos: [0, 0] as [number, number], z: 0, paint: paintFoot },
      ]),
      { id: 'chassis', w: 2.3, h: 1.1, pivot: [0.5, 0.3], pos: [0, 1.15], z: 2, paint: paintChassis },
      { id: 'pilot', w: 0.55, h: 0.7, pivot: [0.5, 0.05], pos: [-0.65, 1.95], z: 2.5, paint: paintPilot },
      { id: 'head', w: 1.5, h: 1.55, pivot: [0.5, 0.2], pos: [-0.6, 2.4], z: 3, paint: paintBigHead },
      { id: 'cannon', w: 1.7, h: 0.45, pivot: [0.15, 0.5], pos: [0.25, 1.95], z: 2.8, paint: paintCannon },
      ...[0, 1, 2].flatMap((i) => [
        { id: `legU_f${i}`, w: 0.16, h: 0.85, pivot: [0.5, 0.95] as [number, number], pos: [0, 0] as [number, number], z: 4, paint: paintLegSeg('#b07a3a') },
        { id: `legL_f${i}`, w: 0.13, h: 0.95, pivot: [0.5, 0.95] as [number, number], pos: [0, 0] as [number, number], z: 4, paint: paintLegSeg('#9a6a30') },
        { id: `foot_f${i}`, w: 0.3, h: 0.14, pivot: [0.5, 0.5] as [number, number], pos: [0, 0] as [number, number], z: 4, paint: paintFoot },
      ]),
    ],
  },
};

/** Count of walking legs on the inventor's machine (upper segments). */
export const INVENTOR_LEG_COUNT = RIGS.inventor.parts.filter((p) => p.id.startsWith('legU_')).length;

export { shadedPath };

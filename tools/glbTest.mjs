// End-to-end check of the GLB pipeline: build a deliberately oddly-scaled, off-centre,
// sideways-facing model in the browser, export it as GLB, load it through the real
// VehicleVisual loader and verify it is fitted to the chassis without distortion.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire(process.env.PLAYWRIGHT_MODULE_DIR ?? '/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto('http://localhost:5173/');
await page.waitForFunction(() => window.game && window.game.stats.frames > 5, null, { timeout: 60000 });
const glb = await page.evaluate(async () => {
  const THREE = await import('/node_modules/.vite/deps/three.js');
  const { GLTFExporter } = await import('/node_modules/.vite/deps/three_examples_jsm_exporters_GLTFExporter__js.js').catch(() => import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js'));
  const scene = new THREE.Scene();
  // 40 units long along X (i.e. facing sideways), offset from origin, sitting below zero.
  const body = new THREE.Mesh(new THREE.BoxGeometry(40, 12, 18), new THREE.MeshStandardMaterial({ color: 0xff00ff }));
  body.position.set(100, -20, 7);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(6, 10, 8), new THREE.MeshStandardMaterial({ color: 0x00ffff }));
  nose.rotation.z = -Math.PI / 2; nose.position.set(125, -20, 7);
  scene.add(body, nose);
  const buf = await new GLTFExporter().parseAsync(scene, { binary: true });
  return Array.from(new Uint8Array(buf));
});
writeFileSync('tools/out/test-model.glb', Buffer.from(glb));
console.log('exported GLB bytes', glb.length);
const result = await page.evaluate(async () => {
  const g = window.game;
  const THREE = await import('/node_modules/.vite/deps/three.js');
  const vis = g.visuals[g.sim.playerIndex];
  vis.cfg.model = { url: '/tools/out/test-model.glb', rotationY: Math.PI / 2, scale: 'fit' };
  const ok = await vis.loadModel();
  vis.root.updateMatrixWorld(true);
  const model = vis.body.children[vis.body.children.length - 1];
  const inv = new THREE.Matrix4().copy(vis.root.matrixWorld).invert();
  const box = new THREE.Box3().setFromObject(model).applyMatrix4(inv);
  const s = box.getSize(new THREE.Vector3());
  return { ok, size: [s.x, s.y, s.z].map((v) => +v.toFixed(2)), min: [box.min.x, box.min.y, box.min.z].map((v) => +v.toFixed(2)), max: [box.max.x, box.max.y, box.max.z].map((v) => +v.toFixed(2)), placeholderVisible: vis.placeholder.visible };
});
console.log('load result', JSON.stringify(result));
g: {
  await page.evaluate(() => { window.game.raceCam.mode = 'near'; });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'tools/out/glb-test.png' });
}
console.log(logs.filter((l) => !l.includes('vite')).join('\n'));
await browser.close();

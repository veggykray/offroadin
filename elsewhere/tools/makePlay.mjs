// Inline the built IIFE bundle + CSS into one self-contained PLAY.html (no server, no install).
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const dist = 'dist';
let html = readFileSync(join(dist, 'index.html'), 'utf8');
const assets = readdirSync(join(dist, 'assets'));
const js = assets.find((f) => f.endsWith('.js')); const css = assets.find((f) => f.endsWith('.css'));
if (!js) throw new Error('no JS bundle in dist/assets');
const jsText = readFileSync(join(dist, 'assets', js), 'utf8').replace(/<\/script/gi, '<\\/script');
html = html.replace(/<script[^>]*src="[^"]*assets\/[^"]*\.js"[^>]*><\/script>/, () => `<script>\n${jsText}\n</script>`);
if (css) { const cssText = readFileSync(join(dist, 'assets', css), 'utf8'); html = html.replace(/<link[^>]*rel="stylesheet"[^>]*href="[^"]*assets\/[^"]*\.css"[^>]*>/, () => `<style>\n${cssText}\n</style>`); }
if (/assets\//.test(html)) console.warn('warning: PLAY.html still references dist/assets');
writeFileSync(join(dist, 'PLAY.html'), html);
console.log(`dist/PLAY.html written (${(html.length / 1024).toFixed(0)} kB, self-contained)`);

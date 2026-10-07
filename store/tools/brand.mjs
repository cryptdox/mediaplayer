// Renders the mumu brand (store/brand/*.svg) into every icon the web app,
// the Android app and the Play Store listing need. Run: npm run store:brand
// Uses the system Chrome (CHROME env to override).
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const brand = (f) => readFileSync(join(root, 'store/brand', f), 'utf8');
const out = (p) => { const f = join(root, p); mkdirSync(dirname(f), { recursive: true }); return f; };

const tile = brand('mumu-icon.svg');                              // rounded tile (web, favicon)
const square = tile.replace('rx="112"', 'rx="0"').replace('rx="112"', 'rx="0"'); // full bleed (stores, maskable, iOS)
// Android adaptive foreground: only the mark, shrunk into the 66% safe zone, on transparent.
const mark = tile.match(/<!-- lowercase m[\s\S]*?<\/svg>/)[0].replace('</svg>', '');
const defs = tile.match(/<defs>[\s\S]*?<\/defs>/)[0];
const foreground = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-81 -81 674 674">${defs}${mark}</svg>`;

// Fredoka: rounded, friendly, echoes the arches of the m.
const FONT = '<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@600&display=block" rel="stylesheet">';
const wordmark = (size, color = '#f4f4f5') => `<span style="font:600 ${size}px Fredoka, Nunito, sans-serif;color:${color};letter-spacing:-0.02em">mumu</span>`;

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome' });
const page = await browser.newPage();

async function shot(html, w, h, file, transparent = false) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<!doctype html><html><head>${FONT}<style>html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden;background:transparent}svg{display:block}</style></head><body>${html}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: out(file), omitBackground: transparent });
}
const svgAt = (svg, s) => svg.replace('<svg', `<svg width="${s}" height="${s}"`);

// Web app (PWA)
writeFileSync(out('public/favicon.svg'), tile);
for (const s of [192, 512, 1024]) await shot(svgAt(tile, s), s, s, `public/icons/icon-${s}.png`, true);
await shot(svgAt(square, 512), 512, 512, 'public/icons/icon-maskable-512.png');
await shot(svgAt(square, 180), 180, 180, 'public/apple-touch-icon.png');

// Play Store: 512 x 512, 32-bit PNG, full square (Play rounds the corners itself).
await shot(svgAt(square, 512), 512, 512, 'store/play/icon-512.png');
// Play asks for a 32-bit PNG (with alpha). Screenshots of opaque art come out 24-bit,
// so re-encode through a canvas, which always writes RGBA.
{
  const f = out('store/play/icon-512.png');
  const b64 = await page.evaluate(async (src) => {
    const img = new Image(); img.src = src; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    return c.toDataURL('image/png').split(',')[1];
  }, 'data:image/png;base64,' + readFileSync(f).toString('base64'));
  writeFileSync(f, Buffer.from(b64, 'base64'));
}

// Android launcher icons
const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, k] of Object.entries(dens)) {
  const res = `android/app/src/main/res/mipmap-${d}`;
  await shot(svgAt(tile, 48 * k), 48 * k, 48 * k, `${res}/ic_launcher.png`, true);
  await shot(`<div style="width:${48 * k}px;height:${48 * k}px;border-radius:50%;overflow:hidden">${svgAt(square, 48 * k)}</div>`, 48 * k, 48 * k, `${res}/ic_launcher_round.png`, true);
  await shot(svgAt(foreground, 108 * k), 108 * k, 108 * k, `${res}/ic_launcher_foreground.png`, true);
}
writeFileSync(out('android/app/src/main/res/values/ic_launcher_background.xml'),
  '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#15101F</color>\n</resources>\n');

// Android splash screens: logo tile + wordmark, centred (Capacitor crops to fit).
const splash = (w, h) => {
  const s = Math.round(Math.min(w, h) * 0.22);
  return `<div style="width:${w}px;height:${h}px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${Math.round(s * 0.18)}px;background:radial-gradient(60% 45% at 50% 45%, #2a1650, #0b0b0f)">${svgAt(tile, s)}${wordmark(Math.round(s * 0.42))}</div>`;
};
const sizes = { mdpi: [320, 480], hdpi: [480, 800], xhdpi: [720, 1280], xxhdpi: [960, 1600], xxxhdpi: [1280, 1920] };
for (const [d, [w, h]] of Object.entries(sizes)) {
  await shot(splash(w, h), w, h, `android/app/src/main/res/drawable-port-${d}/splash.png`);
  await shot(splash(h, w), h, w, `android/app/src/main/res/drawable-land-${d}/splash.png`);
}
await shot(splash(480, 480), 480, 480, 'android/app/src/main/res/drawable/splash.png');

// Brand sheet: logo + wordmark lockups for the README / social use.
await shot(`<div style="width:1200px;height:400px;display:flex;align-items:center;justify-content:center;gap:36px;background:#0b0b0f">${svgAt(tile, 220)}${wordmark(170)}</div>`, 1200, 400, 'store/brand/mumu-lockup-dark.png');
await shot(`<div style="width:1200px;height:400px;display:flex;align-items:center;justify-content:center;gap:36px;background:#ffffff">${svgAt(tile, 220)}${wordmark(170, '#14141b')}</div>`, 1200, 400, 'store/brand/mumu-lockup-light.png');

await browser.close();
console.log('brand assets written');

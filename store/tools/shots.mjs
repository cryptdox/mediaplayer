// Play Store screenshots + feature graphic for mumu, taken from the real app
// running on a fictional demo catalogue (store/tools/demo-catalog.mjs).
// Run: npm run store:shots   (starts its own Vite dev server on :5199)
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AUDIO_URL, COLLECTIONS, COUNTRIES, GENRES, LANGUAGES, SINGERS, SONGS, demoWav } from './demo-catalog.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = (p) => { const f = join(root, 'store/play', p); mkdirSync(dirname(f), { recursive: true }); return f; };
const env = Object.fromEntries(readFileSync(join(root, '.env'), 'utf8').split('\n').filter(l => l.includes('=')).map(l => l.split(/=(.*)/s).slice(0, 2).map(s => s.trim())));
const SUPABASE = env.VITE_SUPABASE_URL;
const PORT = 5199, BASE = `http://localhost:${PORT}`;

// ---------- A tiny PostgREST look-alike over the demo catalogue ----------
const TABLES = {
  mp_songs: SONGS, mp_genres: GENRES, mp_collections: COLLECTIONS, mp_singers: SINGERS,
  mp_countries: COUNTRIES, mp_languages: LANGUAGES, mp_sources: [],
  mp_song_singers: SONGS.flatMap(s => s._singerIds.map(p => ({ song_id: s.id, singer_id: p }))),
  mp_collection_singers: COLLECTIONS.flatMap(c => c._singerIds.map(p => ({ collection_id: c.id, singer_id: p }))),
  mp_collection_songs: COLLECTIONS.flatMap(c => c._songIds.map((id, i) => ({ collection_id: c.id, position: i + 1, song: SONGS.find(s => s.id === id) }))),
};
const ilike = (v, pat) => new RegExp('^' + pat.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$', 'i').test(String(v ?? ''));
const test = (row, key, expr) => {
  const [op, ...rest] = expr.split('.'); const val = rest.join('.');
  if (op === 'eq') return String(row[key]) === val;
  if (op === 'in') return val.replace(/^\(|\)$/g, '').split(',').includes(String(row[key]));
  if (op === 'ilike') return ilike(row[key], val);
  return true;
};
const splitTop = (s) => { const parts = []; let d = 0, cur = ''; for (const ch of s) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && !d) { parts.push(cur); cur = ''; } else cur += ch; } if (cur) parts.push(cur); return parts; };
function query(table, params) {
  let rows = [...(TABLES[table] ?? [])];
  for (const [k, v] of params) {
    if (['select', 'order', 'limit', 'offset'].includes(k)) continue;
    if (k === 'or') { const alts = splitTop(v.replace(/^\(|\)$/g, '')); rows = rows.filter(r => alts.some(a => { const [col, ...e] = a.split('.'); return test(r, col, e.join('.')); })); continue; }
    rows = rows.filter(r => test(r, k, v));
  }
  const order = params.get('order');
  if (order) for (const o of order.split(',').reverse()) {
    const [col, dir = 'asc'] = o.split('.');
    rows.sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (dir === 'desc' ? -1 : 1));
  }
  const total = rows.length, off = Number(params.get('offset') ?? 0), lim = Number(params.get('limit') ?? 1000);
  return { rows: rows.slice(off, off + lim), off, total };
}
const clean = (r) => JSON.parse(JSON.stringify(r, (k, v) => (k.startsWith('_') ? undefined : v)));
const WAV = demoWav();

async function mockBackend(ctx) {
  await ctx.route(`${SUPABASE}/**`, async route => {
    const req = route.request(), url = new URL(req.url());
    const cors = { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { ...cors, 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    const m = url.pathname.match(/\/rest\/v1\/(rpc\/)?([\w]+)/);
    if (!m || m[1]) return route.fulfill({ status: 204, headers: cors }); // rpc (play counts): accepted, not stored
    const { rows, off, total } = query(m[2], url.searchParams);
    const single = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object');
    return route.fulfill({
      status: 200, contentType: 'application/json',
      headers: { ...cors, 'content-range': `${off}-${off + Math.max(rows.length - 1, 0)}/${total}` },
      body: JSON.stringify(single ? (rows[0] ? clean(rows[0]) : null) : rows.map(clean)),
    });
  });
  await ctx.route(`${AUDIO_URL}**`, route => route.fulfill({ status: 200, contentType: 'audio/wav', headers: { 'access-control-allow-origin': '*' }, body: WAV }));
}

// ---------- Drive the app ----------
const vite = spawn(join(root, 'node_modules/.bin/vite'), ['--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'pipe' });
await new Promise((ok, bad) => { vite.stdout.on('data', d => String(d).includes('Local') && ok()); vite.on('exit', bad); setTimeout(ok, 15000); });

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
const wait = (pg, ms) => pg.waitForTimeout(ms);
const LIKED = ['s01', 's04', 's11', 's12', 's03', 's09', 's14'];
const RECENT = ['s01', 's11', 's04', 's09', 's12', 's02', 's05'];

async function appPage(viewport, scale, mobile) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: scale, isMobile: mobile, hasTouch: mobile });
  await mockBackend(ctx);
  await ctx.addInitScript(([liked, recent]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.clear();
    localStorage.setItem('mp-liked', JSON.stringify(liked));
    localStorage.setItem('mp-recent', JSON.stringify(recent));
  }, [LIKED, RECENT]);
  const pg = await ctx.newPage();
  await pg.clock.setFixedTime(new Date('2026-10-08T10:30:00')); // "Good morning"
  await pg.goto(BASE + '/'); await wait(pg, 2500);
  return pg;
}
// Client-side navigation: a full reload would stop the music.
const nav = async (pg, path, ms = 2000) => {
  await pg.evaluate(p => { history.pushState({ idx: (history.state?.idx ?? 0) + 1 }, '', p); dispatchEvent(new PopStateEvent('popstate', { state: history.state })); }, path);
  await wait(pg, ms);
};
// Start "Midnight Monsoon" from its album, 1:12 in.
async function startPlaying(pg) {
  await nav(pg, '/c/c1', 1500);
  await pg.locator('main button[aria-label="Play"]').first().click(); await wait(pg, 1500);
  await pg.evaluate(async () => { /* seek through the (possibly hidden) seek slider, as a user would */
    const r = document.querySelector('input[aria-label="Seek"]'); if (!r) return;
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(r, '72'); r.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await wait(pg, 1500);
}
const shoot = async (pg, name) => { const f = out(`raw/${name}.png`); await pg.screenshot({ path: f }); return f; };

async function phoneScenes() {
  const pg = await appPage({ width: 405, height: 720 }, 8 / 3, true); // 1080 x 1920
  const shots = {};
  await startPlaying(pg);
  await nav(pg, '/', 2500);
  shots.home = await shoot(pg, 'phone-home');
  await pg.locator('.md\\:hidden [role=button]').first().click(); await wait(pg, 2200);
  shots.player = await shoot(pg, 'phone-player');
  await pg.getByRole('button', { name: 'Lyrics', exact: true }).first().click(); await wait(pg, 900);
  shots.lyrics = await shoot(pg, 'phone-lyrics');
  await pg.locator('section button', { hasText: /^Queue$/ }).first().click(); await wait(pg, 900);
  shots.queue = await shoot(pg, 'phone-queue');
  await pg.keyboard.press('Escape'); await pg.keyboard.press('Escape'); await wait(pg, 600);
  await nav(pg, '/search');
  shots.search = await shoot(pg, 'phone-search');
  await nav(pg, '/c/c2');
  shots.album = await shoot(pg, 'phone-album');
  await nav(pg, '/library');
  shots.library = await shoot(pg, 'phone-library');
  await pg.context().close();
  return shots;
}
async function tabletScenes(w, h, scale, tag) {
  const pg = await appPage({ width: w, height: h }, scale, false);
  const shots = {};
  await startPlaying(pg);
  await nav(pg, '/', 2500);
  shots.home = await shoot(pg, `${tag}-home`);
  await pg.getByLabel('Open player').click(); await wait(pg, 2200);
  shots.player = await shoot(pg, `${tag}-player`);
  await pg.getByRole('button', { name: 'Lyrics', exact: true }).first().click(); await wait(pg, 900);
  shots.lyrics = await shoot(pg, `${tag}-lyrics`);
  await pg.keyboard.press('Escape'); await pg.keyboard.press('Escape'); await wait(pg, 600);
  await nav(pg, '/c/c2');
  shots.album = await shoot(pg, `${tag}-album`);
  await nav(pg, '/search');
  shots.search = await shoot(pg, `${tag}-search`);
  await pg.context().close();
  return shots;
}

// ---------- Framing ----------
const FONT = '<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@600&family=Inter:wght@400;500;700&display=block" rel="stylesheet">';
const data = (f) => 'data:image/png;base64,' + readFileSync(f).toString('base64');
const icon = readFileSync(join(root, 'store/brand/mumu-icon.svg'), 'utf8');
const frame = await browser.newPage();
async function render(html, w, h, file) {
  await frame.setViewportSize({ width: w, height: h });
  await frame.setContent(`<!doctype html><html><head>${FONT}<style>
    *{box-sizing:border-box}html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden;background:#0b0b0f;font-family:Inter,sans-serif;color:#f4f4f5}
    .bg{position:absolute;inset:0;background:radial-gradient(70% 50% at 20% 0%, #4c1d95cc, transparent 70%),radial-gradient(60% 40% at 100% 100%, #065f4699, transparent 70%),#0b0b0f}
    h1{font:600 var(--h1) Fredoka,sans-serif;letter-spacing:-.01em;margin:0;line-height:1.05}
    p{margin:0;color:#c4c4cc;font-size:var(--p);line-height:1.35}
    .accent{color:#34d399}
    .device{position:absolute;background:#050507;border:2px solid #2a2a36;box-shadow:0 40px 120px -20px #000,0 0 0 1px #000 inset}
    .device img{display:block;width:100%;height:100%;object-fit:cover;object-position:top}
  </style></head><body><div class="bg"></div>${html}</body></html>`);
  await frame.evaluate(() => document.fonts.ready);
  await frame.waitForTimeout(200);
  await frame.screenshot({ path: out(file) });
}

const phoneCaption = (title, sub, img, n, file) => render(`
  <div style="position:absolute;left:84px;right:84px;top:110px;--h1:84px;--p:36px">
    <h1>${title}</h1><p style="margin-top:24px">${sub}</p>
  </div>
  <div class="device" style="left:${(1080 - 776) / 2}px;top:470px;width:776px;height:${Math.round((776 - 32) * 16 / 9) + 32}px;border-radius:64px;padding:16px">
    <img src="${data(img)}" style="border-radius:50px">
  </div>`, 1080, 1920, file);

const tabletCaption = (title, sub, img, file, W, H) => {
  const k = W / 1920;
  return render(`
  <div style="position:absolute;left:${80 * k}px;top:${120 * k}px;width:${470 * k}px;--h1:${76 * k}px;--p:${30 * k}px">
    <div style="width:${84 * k}px;height:${84 * k}px;margin-bottom:${40 * k}px">${icon.replace('<svg', `<svg width="${84 * k}" height="${84 * k}"`)}</div>
    <h1>${title}</h1><p style="margin-top:${24 * k}px">${sub}</p>
  </div>
  <div class="device" style="left:${590 * k}px;top:${(1080 - (1250 - 28) * 9 / 16 - 28) / 2 * k}px;width:${1250 * k}px;height:${((1250 - 28) * 9 / 16 + 28) * k}px;border-radius:${30 * k}px;padding:${14 * k}px">
    <img src="${data(img)}" style="border-radius:${22 * k}px">
  </div>`, W, H, file);
};

const COPY = {
  player: ['Music that <span class="accent">moves</span> with you', 'A living player: a spinning record and visuals that dance to every beat.'],
  home: ['Fresh picks, <span class="accent">every day</span>', 'New releases, most played and mixes picked for the moment.'],
  lyrics: ['Sing <span class="accent">along</span>', 'Lyrics, queue and song details are one tap away.'],
  search: ['Find your <span class="accent">sound</span>', 'Search songs, singers and moods, or browse by genre.'],
  album: ['Albums &amp; <span class="accent">mixes</span>', 'Play a whole album or shuffle a mix, with no ads in between.'],
  library: ['Your library, <span class="accent">your way</span>', 'Liked songs, recently played and every album. Filter and sort it all.'],
  queue: ['Shuffle, repeat, <span class="accent">you decide</span>', 'Reorder the queue, set the speed, play it again.'],
};

const phone = await phoneScenes();
let i = 1;
for (const k of ['player', 'home', 'search', 'lyrics', 'album', 'library', 'queue']) await phoneCaption(...COPY[k], phone[k], i, `phone/${String(i++).padStart(2, '0')}-${k}.png`);

for (const [tag, W, H, scale] of [['tablet-7', 1920, 1080, 1.5], ['tablet-10', 2560, 1440, 2]]) {
  const t = await tabletScenes(1280, 720, scale, tag); // 16:9 raw: 1920x1080 / 2560x1440
  let j = 1;
  for (const k of ['player', 'home', 'lyrics', 'album', 'search']) await tabletCaption(...COPY[k], t[k], `${tag}/${String(j++).padStart(2, '0')}-${k}.png`, W, H);
}

// Feature graphic 1024 x 500: brand on the left, the player on a phone on the right.
await render(`
  <div style="position:absolute;left:70px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;gap:18px;width:470px">
    <div style="display:flex;align-items:center;gap:22px">${icon.replace('<svg', '<svg width="104" height="104"')}<span style="font:600 104px Fredoka,sans-serif;letter-spacing:-.02em">mumu</span></div>
    <p style="--p:30px;font-size:30px;color:#e4e4e7;font-weight:500">Music that <span class="accent">moves</span> with you.</p>
  </div>
  <div class="device" style="left:650px;top:40px;width:300px;height:${Math.round((300 - 16) * 16 / 9) + 16}px;border-radius:40px;padding:8px;transform:rotate(-8deg);transform-origin:50% 0">
    <img src="${data(phone.player)}" style="border-radius:32px">
  </div>`, 1024, 500, 'feature-graphic-1024x500.png');

await browser.close();
vite.kill();
console.log('store images written to store/play');

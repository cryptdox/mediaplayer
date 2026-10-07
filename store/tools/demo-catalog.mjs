// A fictional catalogue for store screenshots: made-up songs, singers and art,
// so the listing shows no real artists' names or music. Served to the app by
// intercepting its database requests (nothing reaches the live database).

const PALETTES = [
  ['#7c3aed', '#22d3ee'], ['#f97316', '#db2777'], ['#10b981', '#0ea5e9'], ['#facc15', '#f43f5e'],
  ['#6366f1', '#ec4899'], ['#14b8a6', '#84cc16'], ['#0f172a', '#38bdf8'], ['#be123c', '#fb923c'],
  ['#4c1d95', '#f0abfc'], ['#065f46', '#fde68a'], ['#1e3a8a', '#a5b4fc'], ['#9a3412', '#fcd34d'],
];

/** Abstract cover art as an SVG data URL. */
export function coverArt(seed, pattern) {
  const [a, b] = PALETTES[seed % PALETTES.length];
  const shapes = {
    waves: [0, 1, 2, 3, 4].map(i => `<path d="M0 ${330 + i * 50} C150 ${280 + i * 50} 300 ${380 + i * 50} 600 ${310 + i * 50} V600 H0Z" fill="${i % 2 ? b : '#ffffff'}" opacity="${0.12 + i * 0.1}"/>`).join(''),
    sun: `<circle cx="300" cy="300" r="170" fill="${b}"/>${[0, 1, 2, 3, 4, 5].map(i => `<rect x="0" y="${330 + i * 34}" width="600" height="${8 + i * 3}" fill="${a}"/>`).join('')}`,
    rings: [0, 1, 2, 3, 4, 5].map(i => `<circle cx="${380 - i * 14}" cy="${230 + i * 10}" r="${60 + i * 46}" fill="none" stroke="${i % 2 ? '#ffffff' : b}" stroke-width="${10 - i}" opacity="${0.9 - i * 0.12}"/>`).join(''),
    blobs: `<g filter="url(#blur)"><circle cx="190" cy="220" r="170" fill="${b}"/><circle cx="420" cy="380" r="190" fill="#ffffff" opacity=".35"/><circle cx="400" cy="160" r="110" fill="${a}"/></g>`,
    peaks: [0, 1, 2].map(i => `<path d="M${-60 + i * 120} 600 L${170 + i * 140} ${250 + i * 60} L${420 + i * 120} 600Z" fill="${i === 1 ? b : '#ffffff'}" opacity="${0.25 + i * 0.25}"/>`).join('') + `<circle cx="460" cy="150" r="46" fill="#ffffff" opacity=".85"/>`,
    grid: Array.from({ length: 16 }, (_, i) => `<rect x="${60 + (i % 4) * 125}" y="${60 + Math.floor(i / 4) * 125}" width="90" height="90" rx="${i % 3 ? 45 : 14}" fill="${(i * 7) % 3 ? b : '#ffffff'}" opacity="${0.35 + ((i * 5) % 6) / 10}"/>`).join(''),
  };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="#0b0b0f"/></linearGradient><filter id="blur"><feGaussianBlur stdDeviation="40"/></filter></defs><rect width="600" height="600" fill="url(#g)"/>${shapes[pattern] ?? shapes.rings}</svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

export const GENRES = [
  ['g-pop', 'Pop', 'sparks', '#ec4899'], ['g-lofi', 'Lo-fi', 'bubbles', '#8b5cf6'], ['g-folk', 'Folk', 'petals', '#f59e0b'],
  ['g-elec', 'Electronic', 'stars', '#3b82f6'], ['g-rock', 'Rock', 'embers', '#ef4444'], ['g-jazz', 'Jazz', 'notes', '#d97706'],
  ['g-classical', 'Classical', 'waves', '#6366f1'], ['g-hiphop', 'Hip-Hop', 'sparks', '#f97316'], ['g-ambient', 'Ambient', 'snow', '#14b8a6'],
  ['g-devotional', 'Devotional', 'stars', '#eab308'],
].map(([id, name, particle, color]) => ({ id, name, particle, color }));

const LYRICS = `Rain on the window, the city asleep
Streetlights are humming the secrets they keep
I walk through the puddles, the night feels so new
Every slow heartbeat is calling for you

Midnight monsoon, carry me home
Wash every worry, I'm never alone
Midnight monsoon, sing me your tune
I'll dance in the rain till the morning comes soon`;

// id, title, singers, genre, mood, year, seconds, pattern, plays, country, language
const RAW = [
  ['s01', 'Midnight Monsoon', ['Nila Rahman'], 'g-lofi', 'calm', 2025, 214, 'waves', 18240, 'Bangladesh', 'Bangla'],
  ['s02', 'Neon Rickshaw', ['Dhaka Drift'], 'g-elec', 'energetic', 2025, 198, 'grid', 15110, 'Bangladesh', 'English'],
  ['s03', 'River of Lanterns', ['Arko Sen'], 'g-folk', 'romantic', 2024, 251, 'peaks', 12980, 'India', 'Bangla'],
  ['s04', 'Paper Planes at Dawn', ['Mira Kabir'], 'g-pop', 'happy', 2025, 186, 'sun', 22410, 'Bangladesh', 'English'],
  ['s05', 'Slow Tide', ['Blue Hour Trio'], 'g-jazz', 'chill', 2023, 263, 'rings', 8120, 'India', 'English'],
  ['s06', 'Thunder in Teal', ['Static Bloom'], 'g-rock', 'energetic', 2024, 221, 'peaks', 9900, 'Bangladesh', 'English'],
  ['s07', 'Raag of the Rain', ['Ishan Roy'], 'g-classical', 'focus', 2022, 412, 'rings', 6420, 'India', 'Hindi'],
  ['s08', 'Rooftop Cipher', ['Kay Zed', 'Mira Kabir'], 'g-hiphop', 'party', 2025, 175, 'grid', 11300, 'Bangladesh', 'Bangla'],
  ['s09', 'Weightless', ['Aurora Fields'], 'g-ambient', 'calm', 2024, 302, 'blobs', 7350, 'India', 'Instrumental'],
  ['s10', 'Morning Bells', ['Noor Ensemble'], 'g-devotional', 'spiritual', 2023, 289, 'sun', 5210, 'Bangladesh', 'Bangla'],
  ['s11', 'Monsoon Letters', ['Nila Rahman', 'Arko Sen'], 'g-pop', 'romantic', 2025, 233, 'blobs', 16870, 'Bangladesh', 'Bangla'],
  ['s12', 'Satellite Heart', ['Mira Kabir'], 'g-pop', 'happy', 2024, 201, 'rings', 19040, 'Bangladesh', 'English'],
  ['s13', 'Cloud Nine Café', ['Blue Hour Trio'], 'g-jazz', 'happy', 2023, 244, 'blobs', 6890, 'India', 'English'],
  ['s14', 'Afterglow', ['Dhaka Drift'], 'g-elec', 'chill', 2025, 227, 'waves', 13560, 'Bangladesh', 'English'],
  ['s15', 'Village Road Home', ['Arko Sen'], 'g-folk', 'sad', 2024, 268, 'peaks', 8730, 'India', 'Bangla'],
  ['s16', 'Stardust Lullaby', ['Aurora Fields'], 'g-ambient', 'calm', 2025, 318, 'grid', 4980, 'India', 'Instrumental'],
];

const genreById = Object.fromEntries(GENRES.map(g => [g.id, g]));
export const AUDIO_URL = 'https://demo.mumu.invalid/audio/';

export const SINGERS = [...new Set(RAW.flatMap(r => r[2]))].map((name, i) => ({ id: `p${i}`, name }));
const singerId = Object.fromEntries(SINGERS.map(s => [s.name, s.id]));
export const COUNTRIES = [{ id: 'bd', name: 'Bangladesh' }, { id: 'in', name: 'India' }];
export const LANGUAGES = ['Bangla', 'English', 'Hindi', 'Instrumental'].map((name, i) => ({ id: `l${i}`, name, native_name: name }));

export const SONGS = RAW.map(([id, title, singers, genre, mood, year, secs, pattern, plays, country, language], i) => ({
  id, title, genre_id: genre, mood, release_year: year, tags: [], description: null,
  lyrics: id === 's01' ? LYRICS : null, is_free: true, duration_seconds: secs, play_count: plays,
  created_at: new Date(Date.UTC(2026, 8, 30 - i)).toISOString(),
  country_id: COUNTRIES.find(c => c.name === country).id, language_id: LANGUAGES.find(l => l.name === language).id,
  audio: { id: `a-${id}`, url: `${AUDIO_URL}${id}.wav` },
  cover: { id: `c-${id}`, url: coverArt(i, pattern) },
  genre: genreById[genre],
  country: { name: country }, lang: { name: language }, source: null,
  singers: singers.map((n, k) => ({ position: k + 1, singer: { name: n } })),
  _singerIds: singers.map(n => singerId[n]),
}));

// id, kind, title, singers, year, songs, pattern
const RAW_COLLECTIONS = [
  ['c1', 'album', 'Monsoon Letters', ['Nila Rahman'], 2025, ['s01', 's11', 's03', 's15'], 'waves'],
  ['c2', 'mix', 'Late Night Lo-fi', [], 2026, ['s01', 's09', 's14', 's05', 's16', 's13'], 'blobs'],
  ['c3', 'album', 'Satellite Heart', ['Mira Kabir'], 2024, ['s12', 's04', 's08'], 'sun'],
  ['c4', 'mix', 'Workout Energy', [], 2026, ['s02', 's06', 's08', 's04'], 'grid'],
  ['c5', 'album', 'Blue Hour Sessions', ['Blue Hour Trio'], 2023, ['s05', 's13'], 'rings'],
  ['c6', 'mix', 'Morning Calm', [], 2026, ['s10', 's07', 's09', 's16'], 'peaks'],
];
export const COLLECTIONS = RAW_COLLECTIONS.map(([id, kind, title, singers, year, songs, pattern], i) => ({
  id, kind, title, description: kind === 'mix' ? 'Hand-picked for the moment.' : null, release_year: year,
  created_at: new Date(Date.UTC(2026, 8, 20 - i)).toISOString(),
  cover: { id: `cc-${id}`, url: coverArt(i + 5, pattern) },
  songs: [{ count: songs.length }],
  singers: singers.map((n, k) => ({ position: k + 1, singer: { name: n } })),
  source: null, country: { name: 'Bangladesh' }, langs: [{ language: { name: 'Bangla' } }],
  _songIds: songs, _singerIds: singers.map(n => singerId[n]),
}));

/** A short, gentle loop (lo-fi chords + soft kick) so the player and its visuals move. 8-bit WAV. */
export function demoWav(seconds = 214, rate = 11025) {
  const n = seconds * rate;
  const buf = Buffer.alloc(44 + n);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate, 28); buf.writeUInt16LE(1, 32); buf.writeUInt16LE(8, 34); buf.write('data', 36); buf.writeUInt32LE(n, 40);
  const chords = [[220, 277, 330], [196, 247, 294], [175, 220, 262], [196, 247, 330]];
  for (let i = 0; i < n; i++) {
    const t = i / rate, beat = t % 0.5, ch = chords[Math.floor(t / 2) % 4];
    let v = ch.reduce((s, f) => s + Math.sin(2 * Math.PI * f * t), 0) / 3 * 0.35 * (0.6 + 0.4 * Math.exp(-beat * 4));
    v += Math.sin(2 * Math.PI * 55 * t) * Math.exp(-beat * 14) * 0.5;
    v += Math.sin(2 * Math.PI * 880 * t) * Math.exp(-((t + 0.25) % 0.5) * 30) * 0.08;
    buf[44 + i] = Math.max(0, Math.min(255, Math.round(128 + v * 100)));
  }
  return buf;
}

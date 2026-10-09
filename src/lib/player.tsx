import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { canPlay, countPlay, fetchSongs, fetchSongsByIds, type Song } from './music';
import { pushRecent } from './library';
import { toast } from './toast';
import { bindNowPlayingControls, setNowPlayingState, setNowPlayingTrack, updateWidget, type NowPlayingHandlers } from './nowPlaying';

// One <audio> for the whole app: the queue, every control, the lock-screen /
// notification controls (Media Session), and the queue saved for next launch.

export type RepeatMode = 'off' | 'all' | 'one';

type Player = {
  queue: Song[]; index: number; current: Song | null;
  playing: boolean; time: number; duration: number;
  shuffle: boolean; repeat: RepeatMode; rate: number; volume: number; muted: boolean;
  /** finite: an album / mix / genre / mood / playlist. It ends after its last song (unless repeat is on)
   *  instead of continuing with more songs from the library. */
  playList: (songs: Song[], start?: number, opts?: { finite?: boolean }) => void;
  playNow: (song: Song) => void;
  playNext: (song: Song) => void;
  addToQueue: (song: Song) => void;
  removeFromQueue: (i: number) => void;
  jumpTo: (i: number) => void;
  toggle: () => void; next: () => void; prev: () => void;
  /** Stop playback and close the player; the saved queue is forgotten too. */
  stop: () => void;
  seek: (s: number) => void; skip: (d: number) => void;
  setShuffle: (v: boolean) => void; cycleRepeat: () => void;
  setRate: (v: number) => void; setVolume: (v: number) => void; toggleMute: () => void;
  /** Press-and-hold scrubbing: 1 plays at 2×, -1 rewinds at 2×, 0 goes back to normal. */
  hold: (dir: -1 | 0 | 1) => void;
  level: () => number; bands: (n: number) => number[];
};

const Ctx = createContext<Player | null>(null);

const SAVED = 'mp-player';
const SAVED_MAX = 100;
const num = (k: string, d: number) => { try { const v = localStorage.getItem(k); return v === null ? d : Number(v) || d; } catch { return d; } };
const save = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* best effort */ } };

const shuffled = (n: number, first: number) => {
  const rest = Array.from({ length: n }, (_, i) => i).filter(i => i !== first);
  for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
  return first >= 0 ? [first, ...rest] : rest;
};

/** Autoplay when the queue runs out: library songs not queued yet, same genre first. */
async function moreLike(current: Song | null, queued: Song[]): Promise<Song[]> {
  const have = new Set(queued.map(s => s.id));
  const fresh = (rows: Song[]) => rows.filter(s => canPlay(s) && !have.has(s.id));
  const sameGenre = current?.genre?.id ? fresh((await fetchSongs({ genreId: current.genre.id, order: 'popular' }, 0, 30)).rows) : [];
  const rest = fresh((await fetchSongs({ order: 'popular' }, 0, 50)).rows).filter(s => !sameGenre.some(x => x.id === s.id));
  return [...sameGenre, ...rest].slice(0, 10);
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const extending = useRef(false);
  const errors = useRef(0);
  const freq = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const counted = useRef<string | null>(null);
  // Where to resume the restored song, tied to that song only.
  const resumeAt = useRef<{ id: string; time: number } | null>(null);
  const restored = useRef(false);
  const userStarted = useRef(false);

  const [queue, setQueue] = useState<Song[]>([]);
  const [index, setIndex] = useState(-1);
  const [order, setOrder] = useState<number[]>([]);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [finite, setFinite] = useState(false);
  // Shuffle and repeat-all are on until the user turns them off (remembered).
  const [shuffle, setShuffleState] = useState(() => { try { return localStorage.getItem('mp-shuffle') !== '0'; } catch { return true; } });
  const [repeat, setRepeat] = useState<RepeatMode>(() => {
    try { const v = localStorage.getItem('mp-repeat'); return v === 'off' || v === 'one' ? v : 'all'; } catch { return 'all'; }
  });
  // A play / next / prev that arrived before there was a song (widget tap that launched the app).
  const pending = useRef(false);
  const holding = useRef<{ dir: -1 | 1; timer?: number } | null>(null);
  const [rate, setRate] = useState(() => num('mp-rate', 1));
  const [volume, setVolume] = useState(() => num('mp-volume', 1));
  const [muted, setMuted] = useState(false);

  const current = index >= 0 ? queue[index] ?? null : null;

  if (!audio.current && typeof Audio !== 'undefined') {
    audio.current = new Audio();
    audio.current.crossOrigin = 'anonymous';
    audio.current.preload = 'auto';
  }

  // Restore last session's queue (paused, at the saved position).
  useEffect(() => {
    if (restored.current) return; // StrictMode runs effects twice in dev
    restored.current = true;
    let saved: { ids: string[]; index: number; time: number; finite?: boolean } | null = null;
    try { saved = JSON.parse(localStorage.getItem(SAVED) ?? 'null'); } catch { /* ignore */ }
    if (!saved?.ids?.length) return;
    void fetchSongsByIds(saved.ids).then(songs => {
      const playable = songs.filter(canPlay);
      // Never override something the user started while this was loading.
      if (!playable.length || userStarted.current) return;
      const savedId = saved!.ids[saved!.index];
      const at = Math.max(0, playable.findIndex(s => s.id === savedId));
      // Only the song that was playing resumes mid-way; and never override a queue started meanwhile.
      if (playable[at].id === savedId && saved!.time) resumeAt.current = { id: savedId, time: saved!.time };
      setQueue(playable);
      setIndex(at);
      setOrder(shuffled(playable.length, at));
      setFinite(!!saved!.finite);
      // Launched by the widget's play button: start the restored queue right away.
      if (pending.current) { pending.current = false; wake(); setPlaying(true); }
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Save the queue as it changes (position every few seconds via time, and
  // exactly on pause / when the page is closed or reloaded).
  const timeRef = useRef(time);
  timeRef.current = time;
  const saveNow = useCallback(() => {
    if (!queue.length || index < 0) return;
    // Keep at most SAVED_MAX songs around the current one (autoplay can keep growing the queue).
    const from = Math.max(0, Math.min(index - SAVED_MAX / 2, queue.length - SAVED_MAX));
    const ids = queue.slice(from, from + SAVED_MAX).map(s => s.id);
    // Just after a reload the element may still read 0 while the restored position is pending.
    const at = (audio.current?.getAttribute('src') ? audio.current.currentTime : 0) || timeRef.current;
    save(SAVED, JSON.stringify({ ids, index: index - from, time: Math.floor(at), finite }));
  }, [queue, index, finite]);
  useEffect(() => { saveNow(); }, [saveNow, Math.floor(time / 5)]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const a = audio.current;
    window.addEventListener('pagehide', saveNow);
    a?.addEventListener('pause', saveNow);
    return () => { window.removeEventListener('pagehide', saveNow); a?.removeEventListener('pause', saveNow); };
  }, [saveNow]);

  const ensureAnalyser = useCallback(() => {
    if (analyser.current || !audio.current) return;
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      audioCtx.current = ctx;
      const src = ctx.createMediaElementSource(audio.current);
      const node = ctx.createAnalyser();
      node.fftSize = 256;
      src.connect(node);
      node.connect(ctx.destination);
      analyser.current = node;
      freq.current = new Uint8Array(new ArrayBuffer(node.frequencyBinCount));
      void ctx.resume();
    } catch { /* visuals fall back to a gentle pulse */ }
  }, []);

  // The audio is routed through Web Audio (for the visuals), and phones suspend
  // that context when the screen locks or the tab hides: wake it before playing.
  const wake = useCallback(() => {
    ensureAnalyser();
    const c = audioCtx.current;
    if (c && c.state !== 'running') void c.resume().catch(() => {});
  }, [ensureAnalyser]);

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible' && audio.current && !audio.current.paused) wake(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [wake]);

  // Load the current song.
  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    if (!current?.audio?.url) { a.pause(); a.removeAttribute('src'); return; }
    if (a.src !== current.audio.url) {
      a.src = current.audio.url;
      a.playbackRate = rate;
      const resume = resumeAt.current?.id === current.id ? resumeAt.current.time : 0;
      resumeAt.current = null;
      setTime(resume);
      if (resume) a.currentTime = resume;
      setDuration(current.duration_seconds ?? 0);
    }
    if (playing) void a.play().catch(() => setPlaying(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  useEffect(() => { if (audio.current) audio.current.playbackRate = rate; save('mp-rate', String(rate)); }, [rate]);
  useEffect(() => { if (audio.current) audio.current.volume = volume; save('mp-volume', String(volume)); }, [volume]);
  useEffect(() => { if (audio.current) audio.current.muted = muted; }, [muted]);
  useEffect(() => { save('mp-shuffle', shuffle ? '1' : '0'); }, [shuffle]);
  useEffect(() => { save('mp-repeat', repeat); }, [repeat]);

  /** Play queue item i; when it is already the loaded song, restart it. */
  const go = useCallback((i: number) => {
    wake();
    const a = audio.current;
    if (i === index && a) { a.currentTime = 0; setPlaying(true); void a.play().catch(() => setPlaying(false)); return; }
    setIndex(i);
    setPlaying(true);
  }, [index, wake]);

  /** Next song. At the end of the queue: repeat-all wraps. Otherwise an open-ended
   *  queue keeps going with more songs from the library; a finite one (album, mix,
   *  genre, mood, playlist), or a library with nothing new left, stops on its last song. */
  const advance = useCallback(async (manual: boolean) => {
    if (!queue.length) return;
    const pos = (shuffle ? order.indexOf(index) : index) + 1;
    if (pos < queue.length) { go(shuffle ? order[pos] : pos); return; }
    if (repeat === 'all') { go(shuffle ? order[0] : 0); return; }
    const more = finite || extending.current ? [] : await (async () => {
      extending.current = true;
      try { return await moreLike(current, queue); } catch { return [] as Song[]; } finally { extending.current = false; }
    })();
    if (more.length) {
      const added = shuffle ? shuffled(more.length, -1).map(k => more[k]) : more;
      const at = queue.length;
      setQueue(q => [...q, ...added]);
      setOrder(o => [...o, ...added.map((_, k) => at + k)]);
      wake(); setIndex(at); setPlaying(true);
      return;
    }
    // The end: stay on the last song, paused and rewound (Play replays it; Prev goes back).
    if (manual) { toast(finite ? 'End of the list. Turn on repeat to play it again.' : 'No more songs.'); return; }
    const a = audio.current;
    setPlaying(false);
    if (a) { a.pause(); a.currentTime = 0; }
    setTime(0);
  }, [queue, shuffle, order, index, repeat, current, finite, go, wake]);

  const next = useCallback(() => {
    if (!queue.length) { pending.current = true; return; }
    void advance(true);
  }, [advance, queue.length]);

  const prev = useCallback(() => {
    const a = audio.current;
    if (!queue.length) { pending.current = true; return; }
    if (a && a.currentTime > 3) { a.currentTime = 0; return; }
    const pos = (shuffle ? order.indexOf(index) : index) - 1;
    if (pos >= 0) go(shuffle ? order[pos] : pos);
    else if (repeat === 'all' && queue.length) go(shuffle ? order[queue.length - 1] : queue.length - 1);
    else if (a) a.currentTime = 0;
  }, [shuffle, order, index, repeat, queue.length, go]);

  // Before the saved queue has loaded (e.g. the app was just launched by the
  // widget), remember the request and start playing once it is there.
  const play = useCallback(() => {
    const a = audio.current;
    if (!a || !current) { pending.current = true; return; }
    wake();
    setPlaying(true);
    void a.play().catch(() => setPlaying(false));
  }, [current, wake]);
  const pause = useCallback(() => { pending.current = false; audio.current?.pause(); }, []);
  const toggle = useCallback(() => { if (audio.current?.paused) play(); else pause(); }, [play, pause]);
  const stop = useCallback(() => {
    pending.current = false;
    resumeAt.current = null;
    const a = audio.current;
    if (a) { a.pause(); a.removeAttribute('src'); a.load(); }
    setPlaying(false);
    setQueue([]); setIndex(-1); setOrder([]);
    setTime(0); setDuration(0); setFinite(false);
    try { localStorage.removeItem(SAVED); } catch { /* best effort */ }
  }, []);

  const seek = useCallback((s: number) => { if (audio.current) audio.current.currentTime = Math.max(0, Math.min(s, audio.current.duration || s)); }, []);
  const skip = useCallback((d: number) => seek((audio.current?.currentTime ?? 0) + d), [seek]);

  // Hold forward: play at 2× (step ahead when paused). Hold back: step back 2× as fast as it plays.
  const hold = useCallback((dir: -1 | 0 | 1) => {
    const a = audio.current;
    if (holding.current) { window.clearInterval(holding.current.timer); holding.current = null; }
    if (a) a.playbackRate = rate;
    if (!a || !dir || !current) return;
    holding.current = { dir };
    if (dir === 1 && !a.paused) { a.playbackRate = 2; return; }
    const STEP = 0.1; // seconds per tick
    holding.current.timer = window.setInterval(() => {
      const delta = dir === 1 ? 2 * STEP : -(2 * STEP + (a.paused ? 0 : STEP * a.playbackRate));
      a.currentTime = Math.max(0, Math.min(a.currentTime + delta, (a.duration || Infinity) - 0.25));
      setTime(a.currentTime);
    }, STEP * 1000);
  }, [rate, current]);
  useEffect(() => () => { if (holding.current) window.clearInterval(holding.current.timer); }, []);

  // Audio element events.
  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    const onTime = () => setTime(a.currentTime);
    const onMeta = () => setDuration(Number.isFinite(a.duration) ? a.duration : 0);
    const onPlay = () => {
      setPlaying(true);
      errors.current = 0;
      if (current && counted.current !== current.id) {
        counted.current = current.id;
        pushRecent(current.id);
        void countPlay(current.id);
      }
    };
    const onPause = () => setPlaying(false);
    const onEnded = () => { if (repeat === 'one') { a.currentTime = 0; void a.play(); } else void advance(false); };
    // A broken file skips to the next song instead of stopping the queue (but never loops forever).
    const onError = () => {
      if (!current || !a.getAttribute('src')) return;
      toast(`Could not play "${current.title}"`);
      setPlaying(false);
      if (++errors.current < queue.length) void advance(false);
    };
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);
    a.addEventListener('ended', onEnded);
    a.addEventListener('error', onError);
    return () => {
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('play', onPlay);
      a.removeEventListener('pause', onPause);
      a.removeEventListener('ended', onEnded);
      a.removeEventListener('error', onError);
    };
  }, [current, repeat, advance, queue.length]);

  // Lock screen / notification / headset buttons / Android widget (see nowPlaying.ts).
  const controls = useRef<NowPlayingHandlers>({ play, pause, toggle, prev, next, skip, seek });
  controls.current = { play, pause, toggle, prev, next, skip, seek };
  useEffect(() => bindNowPlayingControls(() => controls.current), []);

  useEffect(() => {
    const track = current ? { title: current.title, artist: current.artist ?? '', album: current.genre?.name ?? '', cover: current.cover?.url ?? null } : null;
    setNowPlayingTrack(track);
  }, [current]);

  useEffect(() => {
    updateWidget(current ? { title: current.title, artist: current.artist || 'Unknown artist', cover: current.cover?.url ?? null } : null, playing);
  }, [current, playing]);

  // Position: on play / pause / track change, then every few seconds (the OS interpolates in between).
  useEffect(() => {
    setNowPlayingState(playing ? 'playing' : current ? 'paused' : 'none', current ? { duration, position: time, rate } : undefined);
  }, [playing, current, duration, rate, Math.floor(time / 5)]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = (songs: Song[], at: number) => {
    userStarted.current = true;
    wake();
    errors.current = 0;
    setQueue(songs);
    setIndex(at);
    setOrder(shuffled(songs.length, at));
    setPlaying(true);
    const a = audio.current;
    if (a && songs[at]?.audio?.url && a.src === songs[at].audio!.url) { a.currentTime = 0; void a.play(); }
  };

  const locked = (s: Song) => { if (canPlay(s)) return false; toast(`"${s.title}" is premium and locked for now.`); return true; };

  const value = useMemo<Player>(() => ({
    queue, index, current, playing, time, duration, shuffle, repeat, rate, volume, muted,
    playList: (songs, at = 0, opts) => {
      const ok = songs.filter(canPlay);
      if (!ok.length) { toast('Nothing playable here.'); return; }
      const first = songs[at] && canPlay(songs[at]) ? ok.indexOf(songs[at]) : 0;
      setFinite(!!opts?.finite);
      start(ok, Math.max(0, first));
    },
    playNow: s => {
      if (locked(s)) return;
      if (current?.id === s.id) { toggle(); return; }
      setFinite(false);
      start([s, ...queue.filter((x, i) => i > index && x.id !== s.id)], 0);
    },
    playNext: s => {
      if (locked(s)) return;
      if (!current) { setFinite(false); start([s], 0); return; }
      const q = queue.filter(x => x.id !== s.id);
      const at = q.findIndex(x => x.id === current.id);
      q.splice(at + 1, 0, s);
      // Same order as before (indices re-mapped), with the new song right after the current one.
      const ids = order.map(k => queue[k]?.id).filter(id => id && id !== s.id);
      const o = ids.map(id => q.findIndex(x => x.id === id));
      o.splice(ids.indexOf(current.id) + 1, 0, at + 1);
      setQueue(q); setIndex(at); setOrder(o);
      toast(`"${s.title}" plays next`);
    },
    addToQueue: s => {
      if (locked(s)) return;
      if (!current) { setFinite(false); start([s], 0); return; }
      if (queue.some(x => x.id === s.id)) { toast('Already in the queue'); return; }
      setQueue(q => [...q, s]); setOrder(o => [...o, queue.length]);
      toast(`Added "${s.title}" to the queue`);
    },
    removeFromQueue: i => {
      if (i === index) return;
      setQueue(q => q.filter((_, k) => k !== i));
      setOrder(o => o.filter(k => k !== i).map(k => (k > i ? k - 1 : k)));
      if (i < index) setIndex(x => x - 1);
    },
    jumpTo: i => { if (queue[i]) go(i); },
    toggle, next, prev, stop, seek, skip,
    setShuffle: v => { setShuffleState(v); setOrder(shuffled(queue.length, index)); },
    cycleRepeat: () => setRepeat(r => (r === 'off' ? 'all' : r === 'all' ? 'one' : 'off')),
    setRate, setVolume, toggleMute: () => setMuted(m => !m), hold,
    level: () => {
      const node = analyser.current, buf = freq.current;
      if (!node || !buf) return 0;
      node.getByteFrequencyData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i];
      return sum / (buf.length * 255);
    },
    bands: n => {
      const node = analyser.current, buf = freq.current;
      if (!node || !buf) return [];
      node.getByteFrequencyData(buf);
      const size = Math.floor(buf.length / n);
      return Array.from({ length: n }, (_, b) => { let s = 0; for (let i = b * size; i < (b + 1) * size; i++) s += buf[i]; return s / (size * 255); });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [queue, index, current, playing, time, duration, shuffle, repeat, rate, volume, muted, order, next, prev, toggle, stop, seek, skip, hold, go]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlayer() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}

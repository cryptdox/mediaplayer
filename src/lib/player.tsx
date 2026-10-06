import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { canPlay, countPlay, fetchSongsByIds, type Song } from './music';
import { pushRecent } from './library';
import { toast } from './toast';

// One <audio> for the whole app: the queue, every control, the lock-screen /
// notification controls (Media Session), and the queue saved for next launch.

export type RepeatMode = 'off' | 'all' | 'one';

type Player = {
  queue: Song[]; index: number; current: Song | null;
  playing: boolean; time: number; duration: number;
  shuffle: boolean; repeat: RepeatMode; rate: number; volume: number; muted: boolean;
  playList: (songs: Song[], start?: number) => void;
  playNow: (song: Song) => void;
  playNext: (song: Song) => void;
  addToQueue: (song: Song) => void;
  removeFromQueue: (i: number) => void;
  jumpTo: (i: number) => void;
  toggle: () => void; next: () => void; prev: () => void;
  seek: (s: number) => void; skip: (d: number) => void;
  setShuffle: (v: boolean) => void; cycleRepeat: () => void;
  setRate: (v: number) => void; setVolume: (v: number) => void; toggleMute: () => void;
  level: () => number; bands: (n: number) => number[];
};

const Ctx = createContext<Player | null>(null);

const SAVED = 'mp-player';
const num = (k: string, d: number) => { try { const v = localStorage.getItem(k); return v === null ? d : Number(v) || d; } catch { return d; } };
const save = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* best effort */ } };

const shuffled = (n: number, first: number) => {
  const rest = Array.from({ length: n }, (_, i) => i).filter(i => i !== first);
  for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
  return first >= 0 ? [first, ...rest] : rest;
};

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const freq = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const counted = useRef<string | null>(null);
  const resumeAt = useRef(0);

  const [queue, setQueue] = useState<Song[]>([]);
  const [index, setIndex] = useState(-1);
  const [order, setOrder] = useState<number[]>([]);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [shuffle, setShuffleState] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>('off');
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
    let saved: { ids: string[]; index: number; time: number } | null = null;
    try { saved = JSON.parse(localStorage.getItem(SAVED) ?? 'null'); } catch { /* ignore */ }
    if (!saved?.ids?.length) return;
    void fetchSongsByIds(saved.ids).then(songs => {
      const playable = songs.filter(canPlay);
      if (!playable.length) return;
      const at = Math.max(0, playable.findIndex(s => s.id === saved!.ids[saved!.index]));
      resumeAt.current = saved!.time || 0;
      setQueue(playable);
      setIndex(at);
      setOrder(shuffled(playable.length, at));
    }).catch(() => {});
  }, []);

  // Save the queue as it changes (position every few seconds via time).
  useEffect(() => {
    if (!queue.length) return;
    save(SAVED, JSON.stringify({ ids: queue.map(s => s.id), index, time: Math.floor(time) }));
  }, [queue, index, Math.floor(time / 5)]); // eslint-disable-line react-hooks/exhaustive-deps

  const ensureAnalyser = useCallback(() => {
    if (analyser.current || !audio.current) return;
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
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

  // Load the current song.
  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    if (!current?.audio?.url) { a.pause(); a.removeAttribute('src'); return; }
    if (a.src !== current.audio.url) {
      a.src = current.audio.url;
      a.playbackRate = rate;
      setTime(resumeAt.current);
      if (resumeAt.current) { a.currentTime = resumeAt.current; resumeAt.current = 0; }
      setDuration(current.duration_seconds ?? 0);
    }
    if (playing) void a.play().catch(() => setPlaying(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  useEffect(() => { if (audio.current) audio.current.playbackRate = rate; save('mp-rate', String(rate)); }, [rate]);
  useEffect(() => { if (audio.current) audio.current.volume = volume; save('mp-volume', String(volume)); }, [volume]);
  useEffect(() => { if (audio.current) audio.current.muted = muted; }, [muted]);

  const next = useCallback(() => {
    if (!queue.length) return;
    const pos = (shuffle ? order.indexOf(index) : index) + 1;
    if (pos < queue.length) { setIndex(shuffle ? order[pos] : pos); setPlaying(true); return; }
    if (repeat === 'all') { setIndex(shuffle ? order[0] : 0); setPlaying(true); return; }
    setPlaying(false);
    audio.current?.pause();
  }, [queue.length, shuffle, order, index, repeat]);

  const prev = useCallback(() => {
    const a = audio.current;
    if (a && a.currentTime > 3) { a.currentTime = 0; return; }
    const pos = (shuffle ? order.indexOf(index) : index) - 1;
    if (pos >= 0) { setIndex(shuffle ? order[pos] : pos); setPlaying(true); }
    else if (repeat === 'all' && queue.length) { setIndex(shuffle ? order[queue.length - 1] : queue.length - 1); setPlaying(true); }
    else if (a) a.currentTime = 0;
  }, [shuffle, order, index, repeat, queue.length]);

  const toggle = useCallback(() => {
    const a = audio.current;
    if (!a || !current) return;
    ensureAnalyser();
    if (a.paused) { setPlaying(true); void a.play().catch(() => setPlaying(false)); } else a.pause();
  }, [current, ensureAnalyser]);

  const seek = useCallback((s: number) => { if (audio.current) audio.current.currentTime = Math.max(0, Math.min(s, audio.current.duration || s)); }, []);
  const skip = useCallback((d: number) => seek((audio.current?.currentTime ?? 0) + d), [seek]);

  // Audio element events.
  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    const onTime = () => setTime(a.currentTime);
    const onMeta = () => setDuration(Number.isFinite(a.duration) ? a.duration : 0);
    const onPlay = () => {
      setPlaying(true);
      if (current && counted.current !== current.id) {
        counted.current = current.id;
        pushRecent(current.id);
        void countPlay(current.id);
      }
    };
    const onPause = () => setPlaying(false);
    const onEnded = () => { if (repeat === 'one') { a.currentTime = 0; void a.play(); } else next(); };
    const onError = () => { if (current) toast(`Could not play "${current.title}"`); setPlaying(false); };
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
  }, [current, repeat, next]);

  // Lock screen / notification / headset controls.
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    if (!current) { ms.metadata = null; return; }
    ms.metadata = new MediaMetadata({
      title: current.title,
      artist: current.artist ?? '',
      album: current.genre?.name ?? '',
      artwork: current.cover?.url
        ? [{ src: current.cover.url, sizes: '512x512' }]
        : [{ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }],
    });
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => toggle()], ['pause', () => toggle()],
      ['previoustrack', () => prev()], ['nexttrack', () => next()],
      ['seekbackward', d => skip(-(d.seekOffset ?? 10))], ['seekforward', d => skip(d.seekOffset ?? 10)],
      ['seekto', d => { if (d.seekTime !== undefined) seek(d.seekTime); }],
    ];
    for (const [action, fn] of handlers) { try { ms.setActionHandler(action, fn); } catch { /* unsupported action */ } }
  }, [current, toggle, prev, next, skip, seek]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = playing ? 'playing' : current ? 'paused' : 'none';
    if (current && duration && navigator.mediaSession.setPositionState) {
      try { navigator.mediaSession.setPositionState({ duration, playbackRate: rate, position: Math.min(time, duration) }); } catch { /* ignore */ }
    }
  }, [playing, current, duration, rate, Math.floor(time)]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = (songs: Song[], at: number) => {
    ensureAnalyser();
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
    playList: (songs, at = 0) => {
      const ok = songs.filter(canPlay);
      if (!ok.length) { toast('Nothing playable here.'); return; }
      const first = songs[at] && canPlay(songs[at]) ? ok.indexOf(songs[at]) : 0;
      start(ok, Math.max(0, first));
    },
    playNow: s => {
      if (locked(s)) return;
      if (current?.id === s.id) { toggle(); return; }
      start([s, ...queue.filter((x, i) => i > index && x.id !== s.id)], 0);
    },
    playNext: s => {
      if (locked(s)) return;
      if (!current) { start([s], 0); return; }
      const q = queue.filter(x => x.id !== s.id);
      const at = q.findIndex(x => x.id === current.id);
      q.splice(at + 1, 0, s);
      setQueue(q); setIndex(at); setOrder(shuffled(q.length, at));
      toast(`"${s.title}" plays next`);
    },
    addToQueue: s => {
      if (locked(s)) return;
      if (!current) { start([s], 0); return; }
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
    jumpTo: i => { if (queue[i]) { ensureAnalyser(); setIndex(i); setPlaying(true); } },
    toggle, next, prev, seek, skip,
    setShuffle: v => { setShuffleState(v); if (v) setOrder(shuffled(queue.length, index)); },
    cycleRepeat: () => setRepeat(r => (r === 'off' ? 'all' : r === 'all' ? 'one' : 'off')),
    setRate, setVolume, toggleMute: () => setMuted(m => !m),
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
  }), [queue, index, current, playing, time, duration, shuffle, repeat, rate, volume, muted, order, next, prev, toggle, seek, skip]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlayer() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Shuffle, SkipBack, SkipForward, Play, Pause, Repeat, Repeat1, RotateCcw, RotateCw, Volume2, VolumeX, ChevronDown, ListMusic, Gauge, X, Rewind, FastForward,
} from 'lucide-react';
import clsx from 'clsx';
import { usePlayer } from '../lib/player';
import { formatDuration } from '../lib/music';
import { Cover, LikeButton, PlayingBars } from './ui';
import { Particles } from './Particles';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const ib = (on = false) => clsx('inline-flex items-center justify-center rounded-full p-2 transition disabled:opacity-30', on ? 'text-accent' : 'text-dim hover:text-ink');

/** The full player is open while ?np=1 is in the URL, so Back (incl. Android) closes it. */
export function useFullPlayer() {
  const [params, setParams] = useSearchParams();
  const open = params.get('np') === '1';
  return {
    open,
    show: () => { const p = new URLSearchParams(params); p.set('np', '1'); setParams(p); },
    // Opened straight at ?np=1 (cold start, shared link) there is nothing to go back to.
    hide: () => {
      if ((window.history.state?.idx ?? 0) > 0) window.history.back();
      else { const p = new URLSearchParams(params); p.delete('np'); setParams(p, { replace: true }); }
    },
  };
}

export const Transport = ({ big = false }: { big?: boolean }) => {
  const p = usePlayer();
  const s = big ? 22 : 18;
  return (
    <div className={clsx('flex items-center', big ? 'w-full justify-between' : 'justify-center gap-1 sm:gap-3')}>
      <button className={ib(p.shuffle)} onClick={() => p.setShuffle(!p.shuffle)} aria-label="Shuffle" aria-pressed={p.shuffle}><Shuffle size={s - 2} /></button>
      <button className={ib()} onClick={p.prev} disabled={!p.current} aria-label="Previous"><SkipBack size={s} fill="currentColor" /></button>
      {big && <button className={ib()} onClick={() => p.skip(-10)} disabled={!p.current} aria-label="Back 10 seconds"><RotateCcw size={s - 4} /></button>}
      <button onClick={p.toggle} disabled={!p.current} aria-label={p.playing ? 'Pause' : 'Play'}
        className={clsx('inline-flex items-center justify-center rounded-full bg-white text-black hover:scale-105 active:scale-95 transition disabled:opacity-40', big ? 'w-16 h-16 shrink-0' : 'w-9 h-9')}>
        {p.playing ? <Pause size={big ? 30 : 18} fill="currentColor" /> : <Play size={big ? 30 : 18} fill="currentColor" className="ml-0.5" />}
      </button>
      {big && <button className={ib()} onClick={() => p.skip(10)} disabled={!p.current} aria-label="Forward 10 seconds"><RotateCw size={s - 4} /></button>}
      <button className={ib()} onClick={p.next} disabled={!p.current} aria-label="Next"><SkipForward size={s} fill="currentColor" /></button>
      <button className={ib(p.repeat !== 'off')} onClick={p.cycleRepeat} aria-label={`Repeat: ${p.repeat}`}>
        {p.repeat === 'one' ? <Repeat1 size={s - 2} /> : <Repeat size={s - 2} />}
      </button>
    </div>
  );
};

export const SeekBar = ({ stacked = false }: { stacked?: boolean }) => {
  const { time, duration, seek, current } = usePlayer();
  const pct = duration ? (time / duration) * 100 : 0;
  const bar = (
    <input type="range" className="seek flex-1 w-full" min={0} max={duration || 0} step={0.1} value={time} disabled={!current}
      onChange={e => seek(Number(e.target.value))} aria-label="Seek"
      style={{ background: `linear-gradient(to right, #fff ${pct}%, #4b4b57 ${pct}%)` }} />
  );
  if (stacked) return (
    <div className="w-full">
      {bar}
      <div className="flex justify-between mt-1 text-[11px] tabular-nums text-dim"><span>{formatDuration(time)}</span><span>{formatDuration(duration)}</span></div>
    </div>
  );
  return (
    <div className="flex items-center gap-2 text-[11px] tabular-nums text-dim">
      <span className="w-10 text-right">{formatDuration(time)}</span>
      {bar}
      <span className="w-10">{formatDuration(duration)}</span>
    </div>
  );
};

export const SpeedVolume = ({ speedOnlyOnPhone = false, speedFromLg = false }: { speedOnlyOnPhone?: boolean; speedFromLg?: boolean }) => {
  const p = usePlayer();
  return (
    <div className="flex items-center gap-2">
      <label className={clsx('items-center gap-1 text-xs text-dim', speedFromLg ? 'hidden lg:inline-flex' : 'inline-flex')} title="Playback speed">
        <Gauge size={15} />
        <select value={p.rate} onChange={e => p.setRate(Number(e.target.value))} aria-label="Playback speed"
          className="bg-transparent text-xs rounded border border-line px-1 py-0.5 text-ink">
          {SPEEDS.map(r => <option key={r} value={r} className="bg-elevated">{r}×</option>)}
        </select>
      </label>
      <span className={clsx('items-center gap-2', speedOnlyOnPhone ? 'hidden md:flex' : 'flex')}>
      <button className={ib()} onClick={p.toggleMute} aria-label={p.muted ? 'Unmute' : 'Mute'}>{p.muted || p.volume === 0 ? <VolumeX size={17} /> : <Volume2 size={17} />}</button>
      <input type="range" className="seek w-20 lg:w-24" min={0} max={1} step={0.01} value={p.muted ? 0 : p.volume} onChange={e => p.setVolume(Number(e.target.value))} aria-label="Volume"
        style={{ background: `linear-gradient(to right, #fff ${(p.muted ? 0 : p.volume) * 100}%, #4b4b57 0)` }} />
      </span>
    </div>
  );
};

/** Desktop: full-width bar at the bottom. */
export const PlayerBar = () => {
  const p = usePlayer();
  const fp = useFullPlayer();
  const s = p.current;
  return (
    <div className="hidden md:grid grid-cols-[minmax(0,1fr)_minmax(17rem,2fr)_minmax(0,1fr)] items-center gap-4 lg:gap-6 h-20 px-4 bg-bg border-t border-line">
      <div className="flex items-center gap-3 min-w-0">
        {s && (
          <>
            <button onClick={fp.show} aria-label="Open player" className="shrink-0"><Cover url={s.cover?.url} color={s.genre?.color} className="w-14 h-14" /></button>
            <div className="flex-1 min-w-0">
              {/* w-full: a button otherwise sizes to its text and a long title spills over the controls. */}
              <button onClick={fp.show} className="block w-full text-sm font-semibold truncate hover:underline text-left" title={s.title}>{s.title}</button>
              <div className="text-xs text-dim truncate">{s.artist || 'Unknown artist'}</div>
            </div>
            <LikeButton songId={s.id} />
          </>
        )}
      </div>
      <div className="min-w-0 max-w-2xl w-full mx-auto space-y-1"><Transport /><SeekBar /></div>
      <div className="min-w-0 flex items-center justify-end gap-1">
        <button className={ib()} onClick={fp.show} disabled={!s} aria-label="Queue"><ListMusic size={18} /></button>
        <SpeedVolume speedFromLg />
      </div>
    </div>
  );
};

/** Phone: compact bar above the tab bar; tap opens the full player. */
export const MiniPlayer = () => {
  const p = usePlayer();
  const fp = useFullPlayer();
  const s = p.current;
  if (!s) return null;
  const pct = p.duration ? (p.time / p.duration) * 100 : 0;
  return (
    <div className="md:hidden mx-2 mb-1 rounded-lg overflow-hidden shadow-xl shadow-black/50" style={{ background: `linear-gradient(90deg, ${s.genre?.color ?? '#7c3aed'}55, #1d1d27 70%)` }}>
      <div className="flex items-center gap-3 p-2" role="button" tabIndex={0} onClick={fp.show}>
        <Cover url={s.cover?.url} color={s.genre?.color} className="w-10 h-10" round="rounded" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{s.title}</div>
          <div className="text-xs text-dim truncate">{s.artist || 'Unknown artist'}</div>
        </div>
        <LikeButton songId={s.id} size={20} />
        <button onClick={e => { e.stopPropagation(); p.toggle(); }} className="p-2" aria-label={p.playing ? 'Pause' : 'Play'}>
          {p.playing ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
        </button>
      </div>
      <div className="h-[2px] bg-white/15"><div className="h-full bg-white" style={{ width: `${pct}%` }} /></div>
    </div>
  );
};

/** Glow + frequency bars under the vinyl, driven by the analyser. */
const Pulse = ({ color }: { color: string }) => {
  const { level, bands, playing } = usePlayer();
  const ring = useRef<HTMLDivElement>(null);
  const bars = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0, smooth = 0;
    const tick = () => {
      const l = playing ? level() : 0;
      smooth += (l - smooth) * 0.2;
      if (ring.current) { ring.current.style.transform = `scale(${1 + smooth * 0.35})`; ring.current.style.opacity = String(0.3 + smooth * 0.9); }
      const b = bands(28);
      const kids = bars.current?.children;
      if (kids) for (let i = 0; i < kids.length; i++) {
        const v = b.length ? b[i] : playing ? 0.15 + 0.1 * Math.abs(Math.sin(Date.now() / 300 + i)) : 0.05;
        (kids[i] as HTMLElement).style.transform = `scaleY(${Math.max(0.05, v)})`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [level, bands, playing]);
  return (
    <>
      <div ref={ring} className="absolute inset-[-16px] rounded-full blur-2xl pointer-events-none" style={{ background: color }} />
      <div ref={bars} className="absolute top-full mt-3 left-[10%] right-[10%] flex items-end gap-[3px] h-6" aria-hidden="true">
        {Array.from({ length: 28 }, (_, i) => <span key={i} className="flex-1 h-full rounded-t-sm origin-bottom" style={{ background: color }} />)}
      </div>
    </>
  );
};

/** Press and hold the left half to rewind at 2×, the right half to play at 2×; let go for normal speed. */
const HoldToSeek = ({ className, children }: { className?: string; children: ReactNode }) => {
  const { hold } = usePlayer();
  const [dir, setDir] = useState<-1 | 0 | 1>(0);
  const timer = useRef(0);
  const active = useRef(false);
  const holdRef = useRef(hold);
  useEffect(() => { holdRef.current = hold; }, [hold]);
  const release = () => {
    window.clearTimeout(timer.current);
    if (active.current) { active.current = false; holdRef.current(0); setDir(0); }
  };
  useEffect(() => release, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={clsx('relative select-none touch-none [-webkit-touch-callout:none]', className)}
      onContextMenu={e => e.preventDefault()}
      onPointerDown={e => {
        if (e.button !== 0) return;
        const r = e.currentTarget.getBoundingClientRect();
        const d = e.clientX < r.left + r.width / 2 ? -1 : 1;
        release();
        timer.current = window.setTimeout(() => { active.current = true; holdRef.current(d); setDir(d); }, 350);
      }}
      onPointerUp={release} onPointerCancel={release} onPointerLeave={release}>
      {children}
      {dir !== 0 && (
        <div className={clsx('absolute top-2 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 text-sm font-semibold pointer-events-none', dir < 0 ? 'left-2' : 'right-2')} aria-live="polite">
          {dir < 0 ? <><Rewind size={16} fill="currentColor" /> 2×</> : <>2× <FastForward size={16} fill="currentColor" /></>}
        </div>
      )}
    </div>
  );
};

type Tab = 'queue' | 'lyrics' | 'about';

/** Full-screen Now Playing. Phones: one screen, no scrolling; Queue / Lyrics / About open as a sheet. Desktop: the panel sits beside the player. */
export const FullPlayer = () => {
  const p = usePlayer();
  const fp = useFullPlayer();
  const [tab, setTab] = useState<Tab | null>(null);
  const s = p.current;
  useEffect(() => {
    if (!fp.open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (tab) setTab(null); else fp.hide(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fp, tab]);
  if (!fp.open || !s) return null;
  const color = s.genre?.color ?? '#7c3aed';
  const toggleTab = (k: Tab) => setTab(t => (t === k ? null : k));
  const tabBtn = (k: Tab, label: string) => (
    <button key={k} onClick={() => toggleTab(k)} aria-pressed={tab === k}
      className={clsx('px-3 py-1.5 rounded-full text-sm font-semibold transition', tab === k ? 'bg-white text-black' : 'bg-white/10 text-ink hover:bg-white/20')}>{label}</button>
  );

  return (
    <div className="fixed inset-0 z-40 flex flex-col pt-safe pb-safe overflow-hidden animate-[sheet-up_.25s_ease-out] motion"
      style={{ background: `radial-gradient(120% 70% at 50% 0%, ${color}77, transparent 65%), #0b0b0f` }}>
      <Particles kind={s.genre?.particle ?? 'sparks'} color={color} playing={p.playing} level={p.level} className="absolute inset-0 w-full h-full" />

      <header className="relative shrink-0 grid grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center px-3 h-14">
        <button onClick={fp.hide} className="p-2 rounded-full hover:bg-white/10" aria-label="Close player"><ChevronDown size={26} /></button>
        <div className="text-center min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-dim">Now playing</div>
          <div className="text-xs font-semibold truncate">{s.genre?.name ?? 'Music'}</div>
        </div>
        <button onClick={() => toggleTab('queue')} className={clsx('p-2 rounded-full hover:bg-white/10', tab === 'queue' && 'text-accent')} aria-label="Queue"><ListMusic size={22} /></button>
      </header>

      {/* Phones: one column (artwork grows, controls below). lg: artwork left, controls right;
          an open Queue / Lyrics / About panel takes the artwork's place. */}
      <div className="relative flex-1 min-h-0 w-full max-w-6xl mx-auto px-6 lg:px-12 flex flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-16 lg:items-center lg:pb-10">
        <div className="flex-1 min-h-0 w-full max-w-md mx-auto flex flex-col pb-4 lg:contents">
          <HoldToSeek className={clsx('flex-1 min-h-0 flex items-center justify-center py-4', tab && 'lg:hidden')}>
            <div className="relative mb-9 w-[min(80vw,40dvh,22rem)] md:w-[min(64vw,46dvh,28rem)] lg:w-[min(36vw,56dvh,30rem)]">
              <Pulse color={color} />
              <div className="relative aspect-square rounded-full p-[4%] shadow-2xl motion"
                style={{ background: 'repeating-radial-gradient(circle, #111 0 2px, #1c1c1c 2px 4px)', animation: 'spin 18s linear infinite', animationPlayState: p.playing ? 'running' : 'paused' }}>
                <Cover url={s.cover?.url} color={color} className="w-full h-full" round="rounded-full" alt={s.title} />
                <span className="absolute inset-0 m-auto w-[8%] h-[8%] rounded-full bg-bg border-2 border-white/30" />
              </div>
            </div>
          </HoldToSeek>

          <div className="shrink-0 w-full space-y-4 lg:space-y-6 lg:col-start-2 lg:row-start-1">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold truncate lg:whitespace-normal lg:line-clamp-2 lg:leading-tight" title={s.title}>{s.title}</h2>
                <p className="text-dim truncate lg:text-lg lg:mt-1">{s.artist || 'Unknown artist'}</p>
              </div>
              <span className="pt-1"><LikeButton songId={s.id} size={26} /></span>
            </div>
            <SeekBar stacked />
            <Transport big />
            <div className="flex items-center justify-between gap-2">
              <div className="flex gap-2">{tabBtn('lyrics', 'Lyrics')}{tabBtn('about', 'About')}</div>
              <SpeedVolume speedOnlyOnPhone />
            </div>
          </div>
        </div>

        {tab && (
          <>
            <button className="lg:hidden fixed inset-0 z-10 bg-black/50" onClick={() => setTab(null)} aria-label="Close panel" />
            <section className="fixed lg:static inset-x-0 bottom-0 z-20 max-h-[75dvh] lg:max-h-none lg:h-[min(64dvh,36rem)] lg:col-start-1 lg:row-start-1 flex flex-col rounded-t-2xl lg:rounded-2xl bg-[#16161e] lg:bg-black/40 backdrop-blur pb-safe lg:pb-0 shadow-2xl animate-[sheet-up_.2s_ease-out] lg:animate-none motion">
              <div className="lg:hidden mx-auto mt-2 h-1 w-10 rounded-full bg-white/25" />
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
                <div className="flex gap-2 flex-1">{tabBtn('queue', 'Queue')}{tabBtn('lyrics', 'Lyrics')}{tabBtn('about', 'About')}</div>
                <button onClick={() => setTab(null)} className="p-1.5 rounded-full text-dim hover:text-ink hover:bg-white/10" aria-label="Close panel"><X size={18} /></button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-3">
                {tab === 'queue' && (
                  <ul className="space-y-1">
                    {p.queue.map((q, i) => (
                      <li key={`${q.id}-${i}`} className={clsx('flex items-center gap-3 rounded-md px-2 py-1.5', i === p.index ? 'bg-white/10' : 'hover:bg-white/5')}>
                        <button className="flex items-center gap-3 flex-1 min-w-0 text-left" onClick={() => p.jumpTo(i)}>
                          <Cover url={q.cover?.url} color={q.genre?.color} className="w-10 h-10 shrink-0" round="rounded" />
                          <span className="min-w-0">
                            <span className={clsx('block text-sm truncate', i === p.index ? 'text-accent font-semibold' : 'text-ink')}>{q.title}</span>
                            <span className="block text-xs text-dim truncate">{q.artist || 'Unknown artist'}</span>
                          </span>
                        </button>
                        {i === p.index ? <PlayingBars active={p.playing} /> : (
                          <button className="p-1 text-dim hover:text-ink" onClick={() => p.removeFromQueue(i)} aria-label="Remove from queue"><X size={15} /></button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {tab === 'lyrics' && (s.lyrics ? <p className="px-1 whitespace-pre-line text-lg leading-9 font-semibold text-white/90">{s.lyrics}</p> : <p className="px-1 py-6 text-center text-dim">No lyrics for this song yet.</p>)}
                {tab === 'about' && (
                  <dl className="px-1 grid grid-cols-[6.5rem_minmax(0,1fr)] gap-y-2 text-sm">
                    {[['Artist', s.artist], ['Genre', s.genre?.name], ['From', s.source && `${s.source.name} (${s.source.kind.replace('_', ' ')})`], ['Country', s.origin], ['Language', s.language], ['Mood', s.mood], ['Year', s.release_year], ['Length', formatDuration(s.duration_seconds)], ['Plays', s.play_count.toLocaleString()]]
                      .filter(([, v]) => v !== null && v !== undefined && v !== '')
                      .map(([k, v]) => <div key={String(k)} className="contents"><dt className="text-dim">{k}</dt><dd className="capitalize break-words">{String(v)}</dd></div>)}
                    {s.tags.length > 0 && <div className="contents"><dt className="text-dim">Tags</dt><dd className="flex flex-wrap gap-1">{s.tags.map(x => <span key={x} className="px-2 py-0.5 rounded-full bg-white/10 text-xs">{x}</span>)}</dd></div>}
                    {s.description && <p className="col-span-2 mt-2 text-white/80 whitespace-pre-line">{s.description}</p>}
                  </dl>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
};

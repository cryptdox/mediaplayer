import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Lock, MoreHorizontal, Music2, Pause, Play, ListPlus, ListEnd, ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { canPlay, formatDuration, type Collection, type Genre, type Song } from '../lib/music';
import { usePlayer } from '../lib/player';
import { toggleLike, useLiked } from '../lib/library';

/** Square cover that always fills its box; a gradient + note when there is none. */
export const Cover = ({ url, color = '#7c3aed', className = '', round = 'rounded-md', alt = '' }: {
  url?: string | null; color?: string; className?: string; round?: string; alt?: string;
}) => (
  <div className={clsx('relative overflow-hidden shrink-0 bg-elevated', round, className)}
    style={url ? undefined : { background: `linear-gradient(135deg, ${color}, #14141b)` }}>
    {url
      ? <img src={url} alt={alt} loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover" />
      : <Music2 className="absolute inset-0 m-auto w-1/3 h-1/3 text-white/60" />}
  </div>
);

export const PlayingBars = ({ active }: { active: boolean }) => (
  <span className="inline-flex items-end gap-[2px] h-3.5" aria-hidden="true">
    {[0, 1, 2].map(i => (
      <span key={i} className="w-[3px] h-full rounded-sm bg-accent origin-bottom motion"
        style={{ animation: active ? `bar .9s ${i * 0.15}s ease-in-out infinite` : 'none', transform: active ? undefined : 'scaleY(.35)' }} />
    ))}
  </span>
);

/** Big round accent play button (play this list / song). */
export const PlayButton = ({ onClick, playing, size = 48, label }: { onClick: () => void; playing?: boolean; size?: number; label?: string }) => (
  <button type="button" onClick={e => { e.stopPropagation(); e.preventDefault(); onClick(); }}
    aria-label={label ?? (playing ? 'Pause' : 'Play')}
    className="inline-flex items-center justify-center rounded-full bg-accent text-black shadow-lg shadow-black/40 hover:scale-105 hover:bg-accent-strong active:scale-95 transition"
    style={{ width: size, height: size }}>
    {playing ? <Pause size={size * 0.42} fill="currentColor" /> : <Play size={size * 0.42} fill="currentColor" className="ml-0.5" />}
  </button>
);

export const LikeButton = ({ songId, size = 18 }: { songId: string; size?: number }) => {
  const liked = useLiked().includes(songId);
  return (
    <button type="button" onClick={e => { e.stopPropagation(); toggleLike(songId); }}
      aria-label={liked ? 'Remove from Liked Songs' : 'Save to Liked Songs'} aria-pressed={liked}
      className={clsx('p-1.5 rounded-full transition', liked ? 'text-accent' : 'text-dim hover:text-ink')}>
      <Heart size={size} fill={liked ? 'currentColor' : 'none'} />
    </button>
  );
};

/** ⋯ menu: play next / add to queue. */
const SongMenu = ({ song }: { song: Song }) => {
  const { playNext, addToQueue } = usePlayer();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  if (!canPlay(song)) return null;
  const item = 'w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-hover rounded-md';
  return (
    <div ref={box} className="relative">
      <button type="button" onClick={e => { e.stopPropagation(); setOpen(o => !o); }} aria-label="More options" aria-expanded={open}
        className="p-1.5 rounded-full text-dim hover:text-ink"><MoreHorizontal size={18} /></button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-44 rounded-lg bg-elevated border border-line p-1 shadow-2xl" onClick={e => e.stopPropagation()}>
          <button className={item} onClick={() => { playNext(song); setOpen(false); }}><ListPlus size={16} />Play next</button>
          <button className={item} onClick={() => { addToQueue(song); setOpen(false); }}><ListEnd size={16} />Add to queue</button>
        </div>
      )}
    </div>
  );
};

/** One track: tap to play (within `list`), like, ⋯ menu. Premium tracks show a lock. */
export const SongRow = ({ song, list, n, showCover = true }: { song: Song; list: Song[]; n?: number; showCover?: boolean }) => {
  const { current, playing, playList, toggle } = usePlayer();
  const isCurrent = current?.id === song.id;
  const locked = !canPlay(song);
  const play = () => { if (locked) return; if (isCurrent) toggle(); else playList(list, list.indexOf(song)); };
  return (
    <div role="button" tabIndex={0} onClick={play} onKeyDown={e => { if (e.key === 'Enter') play(); }}
      className={clsx('group flex items-center gap-3 px-2 py-2 rounded-md select-none', locked ? 'opacity-60' : 'cursor-pointer hover:bg-hover/70 active:bg-hover')}>
      {n !== undefined && (
        <span className="w-6 text-center text-sm tabular-nums text-dim shrink-0">
          {isCurrent ? <PlayingBars active={playing} /> : <><span className="group-hover:hidden">{n}</span><Play size={14} className="hidden group-hover:inline" fill="currentColor" /></>}
        </span>
      )}
      {showCover && <Cover url={song.cover?.url} color={song.genre?.color} className="w-11 h-11" round="rounded" />}
      <div className="flex-1 min-w-0">
        <div className={clsx('text-[15px] truncate', isCurrent ? 'text-accent font-semibold' : 'text-ink')}>{song.title}</div>
        <div className="text-[13px] text-dim truncate flex items-center gap-1.5">
          {locked && <span className="inline-flex items-center gap-0.5 text-premium text-[11px] font-semibold"><Lock size={11} />PREMIUM</span>}
          {song.artist || 'Unknown artist'}
        </div>
      </div>
      <span className="hidden sm:block text-sm tabular-nums text-dim">{formatDuration(song.duration_seconds)}</span>
      <LikeButton songId={song.id} />
      <SongMenu song={song} />
    </div>
  );
};

/** Section with a title and a horizontally scrolling row (arrows on desktop). */
export const Shelf = ({ title, to, children }: { title: string; to?: string; children: ReactNode }) => {
  const row = useRef<HTMLDivElement>(null);
  const scroll = (d: number) => row.current?.scrollBy({ left: d * row.current.clientWidth * 0.8, behavior: 'smooth' });
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-2 px-4 md:px-0">
        <h2 className="text-xl md:text-2xl font-bold tracking-tight">{title}</h2>
        <div className="flex items-center gap-1">
          {to && <Link to={to} className="text-sm font-semibold text-dim hover:text-ink hover:underline mr-2">Show all</Link>}
          <button onClick={() => scroll(-1)} className="hidden md:inline-flex p-1.5 rounded-full bg-elevated text-dim hover:text-ink" aria-label="Scroll left"><ChevronLeft size={16} /></button>
          <button onClick={() => scroll(1)} className="hidden md:inline-flex p-1.5 rounded-full bg-elevated text-dim hover:text-ink" aria-label="Scroll right"><ChevronRight size={16} /></button>
        </div>
      </div>
      <div ref={row} className="flex gap-3 md:gap-4 overflow-x-auto no-scrollbar px-4 md:px-0 snap-x snap-mandatory scroll-px-4">{children}</div>
    </section>
  );
};

/** Album / mix card: cover with a hover play button. */
export const CollectionCard = ({ c, onPlay }: { c: Collection; onPlay?: () => void }) => (
  <Link to={`/c/${c.id}`} className="group snap-start shrink-0 w-36 md:w-44 p-2 md:p-3 rounded-lg hover:bg-hover/60 transition">
    <div className="relative">
      <Cover url={c.cover?.url} className="w-full aspect-square shadow-lg shadow-black/40" />
      {onPlay && (
        <span className="absolute right-2 bottom-2 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition">
          <PlayButton onClick={onPlay} size={42} />
        </span>
      )}
    </div>
    <div className="mt-2 text-sm font-semibold truncate">{c.title}</div>
    <div className="text-xs text-dim truncate">{c.kind === 'album' ? 'Album' : 'Mix'}{c.artist ? ` · ${c.artist}` : ''}</div>
  </Link>
);

/** Genre tile: coloured block with the name (Search › Browse all). */
export const GenreCard = ({ g, wide = false }: { g: Genre; wide?: boolean }) => (
  <Link to={`/genre/${g.id}`} className={clsx('relative overflow-hidden rounded-lg p-3 font-bold text-lg text-white shadow-md hover:scale-[1.02] transition', wide ? 'h-28' : 'h-24')}
    style={{ background: `linear-gradient(135deg, ${g.color}, ${g.color}99 60%, #14141b)` }}>
    {g.name}
    <Music2 className="absolute -right-3 -bottom-3 w-16 h-16 rotate-[25deg] text-white/25" />
  </Link>
);

export const Skeleton = ({ className = '' }: { className?: string }) => <div className={clsx('animate-pulse bg-elevated rounded-md', className)} />;

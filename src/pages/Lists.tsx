import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Heart, History, LayoutGrid, List, Search as SearchIcon, Shuffle, X } from 'lucide-react';
import clsx from 'clsx';
import { TOP, canPlay, fetchCollection, fetchCollections, fetchGenres, fetchSongs, fetchSongsByIds, formatDuration, type Collection, type CollectionOrder, type Genre, type Song } from '../lib/music';
import { useLiked, useRecent } from '../lib/library';
import { usePlayer } from '../lib/player';
import { CollectionCard, Cover, PlayButton, Skeleton, SongRow } from '../components/ui';

/** Big header (art, title, meta) + play / shuffle, then the numbered tracks. */
const TrackList = ({ art, kind, title, meta, color, songs, footer, empty }: {
  art: ReactNode; kind: string; title: string; meta: string; color: string;
  songs: Song[] | null; footer?: ReactNode; empty: string;
}) => {
  const { current, playing, playList, toggle, setShuffle } = usePlayer();
  const playable = (songs ?? []).filter(canPlay);
  const isThis = !!current && (songs ?? []).some(s => s.id === current.id);
  return (
    <div>
      <div className="px-4 md:px-6 pt-10 pb-6 flex flex-col sm:flex-row sm:items-end gap-5" style={{ background: `linear-gradient(to bottom, ${color}cc, ${color}33 70%, transparent)` }}>
        <div className="mx-auto sm:mx-0 shadow-2xl shadow-black/50">{art}</div>
        <div className="min-w-0 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider">{kind}</div>
          <h1 className="text-3xl md:text-6xl font-extrabold tracking-tight break-words">{title}</h1>
          <div className="text-sm text-white/80">{meta}</div>
        </div>
      </div>
      <div className="px-4 md:px-6 py-4 flex items-center gap-4">
        <PlayButton size={56} playing={isThis && playing} onClick={() => (isThis ? toggle() : playList(playable, 0, { finite: true }))} />
        <button onClick={() => { setShuffle(true); playList(playable, Math.floor(Math.random() * playable.length), { finite: true }); }} disabled={!playable.length}
          className="p-2 text-dim hover:text-ink disabled:opacity-30" aria-label="Shuffle play"><Shuffle size={26} /></button>
      </div>
      <div className="px-2 md:px-4">
        {songs === null
          ? <div className="space-y-2 px-2">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-14" />)}</div>
          : songs.length === 0 ? <p className="px-2 py-8 text-dim">{empty}</p>
          : songs.map((s, i) => <SongRow key={s.id} song={s} list={songs} n={i + 1} finite />)}
        {footer}
      </div>
    </div>
  );
};

const total = (songs: Song[]) => formatDuration(songs.reduce((a, s) => a + (s.duration_seconds ?? 0), 0));

export const CollectionPage = () => {
  const { id = '' } = useParams();
  const [c, setC] = useState<Collection | null | undefined>(undefined);
  const [songs, setSongs] = useState<Song[] | null>(null);
  useEffect(() => {
    setC(undefined); setSongs(null);
    void fetchCollection(id).then(r => { setC(r.collection); setSongs(r.songs); }).catch(() => { setC(null); setSongs([]); });
  }, [id]);
  if (c === null) return <p className="p-8 text-dim">This album or mix does not exist.</p>;
  return (
    <TrackList
      art={<Cover url={c?.cover?.url} className="w-48 h-48 md:w-56 md:h-56" />}
      kind={c ? (c.kind === 'album' ? 'Album' : 'Mix') : ''}
      title={c?.title ?? ''}
      meta={[c?.artist, c?.source?.name, c?.release_year, c?.languages.join(', '), songs && `${songs.length} ${songs.length === 1 ? 'song' : 'songs'}, ${total(songs)}`].filter(Boolean).join(' • ')}
      color="#6d28d9"
      songs={songs}
      empty="No songs in this list yet."
      footer={c?.description && <p className="px-2 pt-6 text-sm text-dim whitespace-pre-line">{c.description}</p>}
    />
  );
};

/** A genre's top songs (most played), like a Spotify genre page: never the whole catalogue. */
export const GenrePage = () => {
  const { id = '' } = useParams();
  const [genre, setGenre] = useState<Genre | null>(null);
  const [songs, setSongs] = useState<Song[] | null>(null);
  useEffect(() => {
    setSongs(null);
    void fetchGenres().then(gs => setGenre(gs.find(g => g.id === id) ?? null)).catch(() => {});
    void fetchSongs({ genreId: id, order: 'popular' }).then(r => setSongs(r.rows)).catch(() => setSongs([]));
  }, [id]);
  const color = genre?.color ?? '#7c3aed';
  return (
    <TrackList
      art={<div className="w-48 h-48 md:w-56 md:h-56 rounded-md flex items-end p-4 text-3xl font-extrabold" style={{ background: `linear-gradient(135deg, ${color}, #14141b)` }}>{genre?.name}</div>}
      kind="Genre" title={genre?.name ?? ''} meta={songs ? `Top ${songs.length} ${songs.length === 1 ? 'song' : 'songs'} · most played` : ''} color={color} songs={songs} empty="No songs in this genre yet." />
  );
};

/** Songs from local id lists (liked / recent), in that order. */
const useSongsByIds = (ids: string[]) => {
  const [songs, setSongs] = useState<Song[] | null>(null);
  const key = ids.join();
  useEffect(() => { void fetchSongsByIds(ids).then(setSongs).catch(() => setSongs([])); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return songs;
};

export const LikedPage = () => {
  const songs = useSongsByIds(useLiked());
  return (
    <TrackList
      art={<span className="w-48 h-48 md:w-56 md:h-56 rounded-md flex items-center justify-center bg-gradient-to-br from-violet-600 to-emerald-400"><Heart size={72} fill="white" /></span>}
      kind="Playlist" title="Liked Songs" meta={songs ? `${songs.length} songs · saved on this device` : ''} color="#5b21b6" songs={songs}
      empty="Songs you like appear here. Tap the heart on any song." />
  );
};

export const RecentPage = () => {
  const songs = useSongsByIds(useRecent());
  return (
    <TrackList
      art={<span className="w-48 h-48 md:w-56 md:h-56 rounded-md flex items-center justify-center bg-elevated"><History size={72} /></span>}
      kind="Playlist" title="Recently played" meta={songs ? `${songs.length} songs` : ''} color="#0f766e" songs={songs}
      empty="Nothing played yet." />
  );
};

type Filter = 'all' | 'album' | 'mix';
type View = 'list' | 'grid';

const readView = (): View => { try { return localStorage.getItem('mp-library-view') === 'grid' ? 'grid' : 'list'; } catch { return 'list'; } };

/** One album / mix as a library row. */
const CollectionRowItem = ({ c }: { c: Collection }) => (
  <Link to={`/c/${c.id}`} className="flex items-center gap-3 p-2 rounded-md hover:bg-hover">
    <Cover url={c.cover?.url} className="w-14 h-14 shrink-0" />
    <span className="min-w-0 flex-1">
      <span className="block font-semibold truncate">{c.title}</span>
      <span className="block text-sm text-dim truncate">
        {[c.kind === 'album' ? 'Album' : 'Mix', c.artist, c.source?.name, c.release_year].filter(Boolean).join(' · ')}
      </span>
    </span>
    <span className="shrink-0 text-xs text-dim tabular-nums">{c.songs[0]?.count ?? 0} {(c.songs[0]?.count ?? 0) === 1 ? 'song' : 'songs'}</span>
  </Link>
);

/** Your Library: liked / recent tiles, then albums & mixes (search, kind, sort, list or grid). */
export const LibraryPage = () => {
  const liked = useLiked();
  const recent = useRecent();
  const { playList } = usePlayer();
  const [filter, setFilter] = useState<Filter>('all');
  const [order, setOrder] = useState<CollectionOrder>('recent');
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<View>(readView);
  const [lists, setLists] = useState<Collection[] | null>(null);
  useEffect(() => { const id = setTimeout(() => setSearch(text.trim()), 300); return () => clearTimeout(id); }, [text]);
  useEffect(() => {
    let live = true;
    setLists(null);
    void fetchCollections(filter === 'all' ? undefined : filter, search, TOP, order)
      .then(r => { if (live) setLists(r); }).catch(() => { if (live) setLists([]); });
    return () => { live = false; };
  }, [filter, search, order]);
  const pickView = (v: View) => { setView(v); try { localStorage.setItem('mp-library-view', v); } catch { /* best effort */ } };
  const chip = (f: Filter, label: string) => (
    <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f} className={clsx('px-3 py-1.5 rounded-full text-sm font-medium', filter === f ? 'bg-ink text-black' : 'bg-elevated text-ink hover:bg-hover')}>{label}</button>
  );
  const kindLabel = filter === 'album' ? 'albums' : filter === 'mix' ? 'mixes' : 'albums or mixes';
  return (
    <div className="px-4 md:px-6 pt-6 pb-4 space-y-5">
      <h1 className="flex items-center gap-3 text-2xl md:text-3xl font-extrabold">
        <img src="/favicon.svg" alt="mumu" className="md:hidden w-8 h-8" />Your Library
      </h1>
      {!search && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Link to="/library/liked" className="flex items-center gap-4 p-3 rounded-lg bg-gradient-to-br from-violet-700 to-emerald-600 hover:brightness-110">
            <Heart size={36} fill="white" />
            <span><span className="block text-xl font-bold">Liked Songs</span><span className="text-sm text-white/80">{liked.length} songs</span></span>
          </Link>
          <Link to="/library/recent" className="flex items-center gap-4 p-3 rounded-lg bg-elevated hover:bg-hover">
            <History size={36} />
            <span><span className="block text-xl font-bold">Recently played</span><span className="text-sm text-dim">{recent.length} songs</span></span>
          </Link>
        </div>
      )}

      <div className="space-y-3">
        <div className="relative max-w-md">
          <SearchIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
          <input value={text} onChange={e => setText(e.target.value)} placeholder="Search albums & mixes, singers, bands, movies"
            className="w-full h-10 rounded-full bg-elevated pl-10 pr-9 text-sm outline-none focus:ring-2 focus:ring-accent placeholder:text-dim" />
          {text && <button onClick={() => setText('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-dim hover:text-ink" aria-label="Clear search"><X size={16} /></button>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {chip('all', 'All')}{chip('album', 'Albums')}{chip('mix', 'Mixes')}
          <div className="ml-auto flex items-center gap-1">
            <select value={order} onChange={e => setOrder(e.target.value as CollectionOrder)} aria-label="Sort"
              className="bg-transparent text-sm text-dim hover:text-ink rounded-md px-1 py-1 outline-none">
              <option value="recent" className="bg-elevated">Recently added</option>
              <option value="title" className="bg-elevated">Title A–Z</option>
              <option value="year" className="bg-elevated">Release year</option>
            </select>
            <button onClick={() => pickView('list')} aria-pressed={view === 'list'} aria-label="List view" className={clsx('p-1.5 rounded-md', view === 'list' ? 'text-ink bg-elevated' : 'text-dim hover:text-ink')}><List size={18} /></button>
            <button onClick={() => pickView('grid')} aria-pressed={view === 'grid'} aria-label="Grid view" className={clsx('p-1.5 rounded-md', view === 'grid' ? 'text-ink bg-elevated' : 'text-dim hover:text-ink')}><LayoutGrid size={18} /></button>
          </div>
        </div>
      </div>

      {lists === null ? (
        view === 'list'
          ? <div className="space-y-2">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-16" />)}</div>
          : <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="aspect-square" />)}</div>
      ) : lists.length === 0 ? (
        <p className="text-dim py-6">{search ? `No ${kindLabel} match "${search}".` : `No ${kindLabel} yet.`}</p>
      ) : (
        <>
        {view === 'list' ? (
        <div className="-mx-2">{lists.map(c => <CollectionRowItem key={c.id} c={c} />)}</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1 -mx-2">
          {lists.map(c => <div key={c.id} className="[&>a]:w-full"><CollectionCard c={c} onPlay={() => void fetchCollection(c.id).then(r => playList(r.songs, 0, { finite: true }))} /></div>)}
        </div>
        )}
        {lists.length >= TOP && <p className="text-sm text-dim text-center pt-2">Showing the top {TOP}. Search to find others.</p>}
        </>
      )}
    </div>
  );
};

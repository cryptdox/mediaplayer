import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Heart, History, Shuffle } from 'lucide-react';
import clsx from 'clsx';
import { canPlay, fetchCollection, fetchCollections, fetchGenres, fetchSongs, fetchSongsByIds, formatDuration, type Collection, type Genre, type Song } from '../lib/music';
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
        <PlayButton size={56} playing={isThis && playing} onClick={() => (isThis ? toggle() : playList(playable))} />
        <button onClick={() => { setShuffle(true); playList(playable, Math.floor(Math.random() * playable.length)); }} disabled={!playable.length}
          className="p-2 text-dim hover:text-ink disabled:opacity-30" aria-label="Shuffle play"><Shuffle size={26} /></button>
      </div>
      <div className="px-2 md:px-4">
        {songs === null
          ? <div className="space-y-2 px-2">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-14" />)}</div>
          : songs.length === 0 ? <p className="px-2 py-8 text-dim">{empty}</p>
          : songs.map((s, i) => <SongRow key={s.id} song={s} list={songs} n={i + 1} />)}
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
      meta={[c?.artist, c?.release_year, songs && `${songs.length} songs, ${total(songs)}`].filter(Boolean).join(' • ')}
      color="#6d28d9"
      songs={songs}
      empty="No songs in this list yet."
      footer={c?.description && <p className="px-2 pt-6 text-sm text-dim whitespace-pre-line">{c.description}</p>}
    />
  );
};

const PAGE = 40;

export const GenrePage = () => {
  const { id = '' } = useParams();
  const [genre, setGenre] = useState<Genre | null>(null);
  const [songs, setSongs] = useState<Song[] | null>(null);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setSongs(null);
    void fetchGenres().then(gs => setGenre(gs.find(g => g.id === id) ?? null)).catch(() => {});
    void fetchSongs({ genreId: id, order: 'popular' }, 0, PAGE).then(r => { setSongs(r.rows); setCount(r.total); }).catch(() => setSongs([]));
  }, [id]);
  const more = async () => {
    if (!songs) return;
    setBusy(true);
    const r = await fetchSongs({ genreId: id, order: 'popular' }, songs.length, PAGE).catch(() => null);
    if (r) setSongs([...songs, ...r.rows]);
    setBusy(false);
  };
  const color = genre?.color ?? '#7c3aed';
  return (
    <TrackList
      art={<div className="w-48 h-48 md:w-56 md:h-56 rounded-md flex items-end p-4 text-3xl font-extrabold" style={{ background: `linear-gradient(135deg, ${color}, #14141b)` }}>{genre?.name}</div>}
      kind="Genre" title={genre?.name ?? ''} meta={`${count} songs`} color={color} songs={songs} empty="No songs in this genre yet."
      footer={songs && songs.length < count && (
        <button onClick={() => void more()} disabled={busy} className="mx-auto my-4 block px-5 py-2 rounded-full border border-line text-sm font-semibold hover:border-ink disabled:opacity-50">{busy ? 'Loading…' : 'Show more'}</button>
      )}
    />
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

/** Your Library: liked / recent tiles, then albums & mixes. */
export const LibraryPage = () => {
  const liked = useLiked();
  const recent = useRecent();
  const { playList } = usePlayer();
  const [filter, setFilter] = useState<Filter>('all');
  const [lists, setLists] = useState<Collection[] | null>(null);
  useEffect(() => { setLists(null); void fetchCollections(filter === 'all' ? undefined : filter, undefined, 60).then(setLists).catch(() => setLists([])); }, [filter]);
  const chip = (f: Filter, label: string) => (
    <button key={f} onClick={() => setFilter(f)} className={clsx('px-3 py-1.5 rounded-full text-sm font-medium', filter === f ? 'bg-ink text-black' : 'bg-elevated text-ink hover:bg-hover')}>{label}</button>
  );
  return (
    <div className="px-4 md:px-6 pt-6 space-y-5">
      <h1 className="text-2xl md:text-3xl font-extrabold">Your Library</h1>
      <div className="flex gap-2">{chip('all', 'All')}{chip('album', 'Albums')}{chip('mix', 'Mixes')}</div>
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
      {lists === null ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="aspect-square" />)}</div>
      ) : lists.length === 0 ? (
        <p className="text-dim">No albums or mixes yet.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1 -mx-2">
          {lists.map(c => <div key={c.id} className="[&>a]:w-full"><CollectionCard c={c} onPlay={() => void fetchCollection(c.id).then(r => playList(r.songs))} /></div>)}
        </div>
      )}
    </div>
  );
};

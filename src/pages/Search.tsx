import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search as SearchIcon, X } from 'lucide-react';
import clsx from 'clsx';
import { fetchCollection, fetchCollections, fetchGenres, fetchSongs, type Collection, type Genre, type Song } from '../lib/music';
import { usePlayer } from '../lib/player';
import { CollectionCard, GenreCard, Shelf, Skeleton, SongRow } from '../components/ui';

const MOODS = ['calm', 'happy', 'energetic', 'sad', 'romantic', 'focus', 'party', 'chill', 'spiritual'];
const PAGE = 30;

/** Search songs (title / artist / origin / language, mood) and albums & mixes; genres to browse when empty. */
export const SearchPage = () => {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const mood = params.get('mood') ?? '';
  const [text, setText] = useState(q);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [songs, setSongs] = useState<Song[] | null>(null);
  const [total, setTotal] = useState(0);
  const [lists, setLists] = useState<Collection[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const { playList } = usePlayer();

  useEffect(() => { void fetchGenres().then(setGenres).catch(() => {}); }, []);

  // Debounced: typing updates ?q= (keeps Back / share working).
  useEffect(() => {
    const id = setTimeout(() => {
      if (text === q) return;
      const p = new URLSearchParams(params);
      if (text.trim()) p.set('q', text.trim()); else p.delete('q');
      setParams(p, { replace: true });
    }, 350);
    return () => clearTimeout(id);
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = !!(q || mood);
  useEffect(() => {
    if (!active) { setSongs(null); setLists([]); return; }
    setSongs(null);
    void fetchSongs({ search: q, mood }, 0, PAGE).then(r => { setSongs(r.rows); setTotal(r.total); }).catch(() => setSongs([]));
    if (q) void fetchCollections(undefined, q, 20).then(setLists).catch(() => setLists([])); else setLists([]);
  }, [q, mood, active]);

  const more = async () => {
    if (!songs) return;
    setLoadingMore(true);
    const r = await fetchSongs({ search: q, mood }, songs.length, PAGE).catch(() => null);
    if (r) setSongs([...songs, ...r.rows]);
    setLoadingMore(false);
  };

  const setMood = (m: string) => {
    const p = new URLSearchParams(params);
    if (m && m !== mood) p.set('mood', m); else p.delete('mood');
    setParams(p, { replace: true });
  };

  return (
    <div className="px-4 md:px-6 pt-4 space-y-6">
      <div className="sticky top-0 z-10 -mx-4 md:-mx-6 px-4 md:px-6 py-3 bg-surface/95 backdrop-blur">
        <div className="relative max-w-xl">
          <SearchIcon size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/70" />
          <input value={text} onChange={e => setText(e.target.value)} placeholder="What do you want to listen to?" autoFocus={!q}
            className="w-full h-12 rounded-full bg-white text-black placeholder:text-black/50 pl-11 pr-10 text-[15px] font-medium outline-none focus:ring-2 focus:ring-accent" />
          {text && <button onClick={() => setText('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-black/60" aria-label="Clear search"><X size={18} /></button>}
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar mt-3">
          {MOODS.map(m => (
            <button key={m} onClick={() => setMood(m)} aria-pressed={mood === m}
              className={clsx('shrink-0 px-3 py-1.5 rounded-full text-sm font-medium capitalize transition', mood === m ? 'bg-accent text-black' : 'bg-elevated text-ink hover:bg-hover')}>{m}</button>
          ))}
        </div>
      </div>

      {!active ? (
        <section className="space-y-3">
          <h2 className="text-xl md:text-2xl font-bold">Browse all</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
            {genres.map(g => <GenreCard key={g.id} g={g} wide />)}
          </div>
        </section>
      ) : (
        <>
          {lists.length > 0 && (
            <div className="-mx-4 md:mx-0">
              <Shelf title="Albums & mixes">{lists.map(c => <CollectionCard key={c.id} c={c} onPlay={() => void fetchCollection(c.id).then(r => playList(r.songs))} />)}</Shelf>
            </div>
          )}
          <section className="space-y-2">
            <h2 className="text-xl md:text-2xl font-bold">Songs {songs && <span className="text-base font-medium text-dim">· {total}</span>}</h2>
            {songs === null ? (
              <div className="space-y-2">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-14" />)}</div>
            ) : songs.length === 0 ? (
              <p className="text-dim py-6">No songs found. Try another word or mood.</p>
            ) : (
              <>
                <div>{songs.map(s => <SongRow key={s.id} song={s} list={songs} />)}</div>
                {songs.length < total && (
                  <button onClick={() => void more()} disabled={loadingMore} className="mx-auto block px-5 py-2 rounded-full border border-line text-sm font-semibold hover:border-ink disabled:opacity-50">
                    {loadingMore ? 'Loading…' : 'Show more'}
                  </button>
                )}
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
};

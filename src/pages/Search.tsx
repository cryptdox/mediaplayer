import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search as SearchIcon, X } from 'lucide-react';
import clsx from 'clsx';
import {
  UNKNOWN, fetchCollection, fetchCollections, fetchCollectionsByIds, fetchGenres, fetchSongs, fetchSongsByIds, hasUnknownMood,
  type Collection, type Genre, type Song,
} from '../lib/music';
import { clearSearchHistory, pushSearchPick, removeSearchPicks, useSearchHistory, type SearchPick } from '../lib/library';
import { usePlayer } from '../lib/player';
import { CollectionCard, Cover, GenreCard, Shelf, Skeleton, SongRow } from '../components/ui';

const MOODS = ['calm', 'happy', 'energetic', 'sad', 'romantic', 'focus', 'party', 'chill', 'spiritual'];

type Recent =
  | { pick: SearchPick; kind: 'song'; song: Song }
  | { pick: SearchPick; kind: 'collection'; c: Collection }
  | { pick: SearchPick; kind: 'genre'; g: Genre };

/** What was opened or played from Search lately (songs, albums / mixes, genres), newest first.
 *  Items that no longer exist are dropped from the list on the device. */
const RecentSearches = ({ picks, genres }: { picks: SearchPick[]; genres: Genre[] }) => {
  const navigate = useNavigate();
  const { playList } = usePlayer();
  const [items, setItems] = useState<Recent[] | null>(null);
  const key = picks.map(p => `${p.kind}:${p.id}`).join() + '|' + genres.length;
  useEffect(() => {
    let live = true;
    const ids = (k: SearchPick['kind']) => picks.filter(p => p.kind === k).map(p => p.id);
    void Promise.all([fetchSongsByIds(ids('song')), fetchCollectionsByIds(ids('collection'))]).then(([songs, cols]) => {
      if (!live) return;
      const out: Recent[] = [], gone: SearchPick[] = [];
      for (const pick of picks) {
        const song = pick.kind === 'song' ? songs.find(x => x.id === pick.id) : undefined;
        const c = pick.kind === 'collection' ? cols.find(x => x.id === pick.id) : undefined;
        const g = pick.kind === 'genre' ? genres.find(x => x.id === pick.id) : undefined;
        if (song) out.push({ pick, kind: 'song', song });
        else if (c) out.push({ pick, kind: 'collection', c });
        else if (g) out.push({ pick, kind: 'genre', g });
        else if (pick.kind !== 'genre' || genres.length) gone.push(pick); // genres not loaded yet: wait
      }
      setItems(out);
      if (gone.length) removeSearchPicks(gone);
    }).catch(() => { if (live) setItems([]); });
    return () => { live = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = (r: Recent) => {
    pushSearchPick(r.pick.kind, r.pick.id); // back to the top
    if (r.kind === 'song') playList([r.song]);
    else if (r.kind === 'collection') navigate(`/c/${r.c.id}`);
    else navigate(`/genre/${r.g.id}`);
  };
  const meta = (r: Recent) =>
    r.kind === 'song' ? `Song · ${r.song.artist || 'Unknown artist'}`
    : r.kind === 'collection' ? [r.c.kind === 'album' ? 'Album' : 'Mix', r.c.artist].filter(Boolean).join(' · ')
    : 'Genre';

  return (
    // preventDefault on pointer down keeps the search box focused while tapping here.
    <section className="space-y-2" onPointerDown={e => e.preventDefault()}>
      <div className="flex items-center justify-between">
        <h2 className="text-xl md:text-2xl font-bold">Recent searches</h2>
        <button onClick={clearSearchHistory} className="text-sm font-semibold text-dim hover:text-ink">Clear all</button>
      </div>
      {items === null ? (
        <div className="space-y-2">{Array.from({ length: Math.min(picks.length, 5) }, (_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : (
        <ul className="-mx-2">
          {items.map(r => (
            <li key={`${r.pick.kind}:${r.pick.id}`} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-hover">
              <button className="flex items-center gap-3 flex-1 min-w-0 text-left" onClick={() => open(r)}>
                {r.kind === 'genre'
                  ? <span className="w-12 h-12 shrink-0 rounded-md" style={{ background: `linear-gradient(135deg, ${r.g.color}, #14141b)` }} />
                  : <Cover url={r.kind === 'song' ? r.song.cover?.url : r.c.cover?.url} color={r.kind === 'song' ? r.song.genre?.color : undefined}
                      className="w-12 h-12" round={r.kind === 'song' ? 'rounded' : 'rounded-md'} />}
                <span className="min-w-0">
                  <span className="block font-medium truncate">{r.kind === 'song' ? r.song.title : r.kind === 'collection' ? r.c.title : r.g.name}</span>
                  <span className="block text-sm text-dim truncate">{meta(r)}</span>
                </span>
              </button>
              <button onClick={() => removeSearchPicks([r.pick])} className="p-2 text-dim hover:text-ink" aria-label="Remove from recent searches"><X size={18} /></button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

/** Search songs (title / artist / origin / language, mood) and albums & mixes; genres to browse when empty. */
export const SearchPage = () => {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const mood = params.get('mood') ?? '';
  const [text, setText] = useState(q);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [songs, setSongs] = useState<Song[] | null>(null);
  const [lists, setLists] = useState<Collection[]>([]);
  const { playList } = usePlayer();
  const history = useSearchHistory();
  const [focused, setFocused] = useState(false);

  const [unknownMood, setUnknownMood] = useState(false);
  useEffect(() => { void fetchGenres().then(setGenres).catch(() => {}); void hasUnknownMood().then(setUnknownMood); }, []);

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
    void fetchSongs({ search: q, mood }).then(r => setSongs(r.rows)).catch(() => setSongs([]));
    if (q) void fetchCollections(undefined, q).then(setLists).catch(() => setLists([])); else setLists([]);
  }, [q, mood, active]);


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
          <input value={text} onChange={e => setText(e.target.value)} placeholder="Search mumu: songs, singers, moods"
            onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onKeyDown={e => { if (e.key === 'Escape') e.currentTarget.blur(); }}
            className="w-full h-12 rounded-full bg-white text-black placeholder:text-black/50 pl-11 pr-10 text-[15px] font-medium outline-none focus:ring-2 focus:ring-accent" />
          {text && <button onClick={() => setText('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-black/60" aria-label="Clear search"><X size={18} /></button>}
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar mt-3">
          {[...MOODS, ...(unknownMood ? [UNKNOWN] : [])].map(m => (
            <button key={m} onClick={() => setMood(m)} aria-pressed={mood === m}
              className={clsx('shrink-0 px-3 py-1.5 rounded-full text-sm font-medium capitalize transition', mood === m ? 'bg-accent text-black' : 'bg-elevated text-ink hover:bg-hover')}>{m}</button>
          ))}
        </div>
      </div>

      {focused && !text.trim() && !mood && history.length > 0 ? (
        <RecentSearches picks={history} genres={genres} />
      ) : !active ? (
        <section className="space-y-3">
          <h2 className="text-xl md:text-2xl font-bold">Browse all</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
            {genres.map(g => <div key={g.id} className="grid" onClickCapture={() => pushSearchPick('genre', g.id)}><GenreCard g={g} wide /></div>)}
          </div>
        </section>
      ) : (
        <>
          {lists.length > 0 && (
            <div className="-mx-4 md:mx-0">
              <Shelf title="Albums & mixes">{lists.map(c => (
                <div key={c.id} className="contents" onClickCapture={() => pushSearchPick('collection', c.id)}>
                  <CollectionCard c={c} onPlay={() => void fetchCollection(c.id).then(r => playList(r.songs, 0, { finite: true }))} />
                </div>
              ))}</Shelf>
            </div>
          )}
          <section className="space-y-2">
            <h2 className="text-xl md:text-2xl font-bold">Top songs</h2>
            {songs === null ? (
              <div className="space-y-2">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-14" />)}</div>
            ) : songs.length === 0 ? (
              <p className="text-dim py-6">No songs found. Try another word or mood.</p>
            ) : (
              <div>{songs.map(s => <SongRow key={s.id} song={s} list={songs} finite={!!mood && !q} onPick={() => pushSearchPick('song', s.id)} />)}</div>
            )}
          </section>
        </>
      )}
    </div>
  );
};

import { useEffect, useState } from 'react';
import { fetchCollection, fetchCollections, fetchGenres, fetchSongs, fetchSongsByIds, canPlay, type Collection, type Genre, type Song } from '../lib/music';
import { useRecent } from '../lib/library';
import { usePlayer } from '../lib/player';
import { toast } from '../lib/toast';
import { Lock } from 'lucide-react';
import { Cover, CollectionCard, GenreCard, PlayButton, PlayingBars, Shelf, Skeleton } from '../components/ui';

const greeting = () => {
  const h = new Date().getHours();
  return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

/** Song as a card in a shelf. */
/** Premium songs can't be played here (yet): say so instead of starting another song. */
const lockedMsg = (s: Song) => toast(`"${s.title}" is premium and locked for now.`);

const PremiumBadge = () => (
  <span className="absolute left-2 top-2 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-black/70 text-premium text-[10px] font-bold"><Lock size={10} />PREMIUM</span>
);

const SongCard = ({ song, list }: { song: Song; list: Song[] }) => {
  const { current, playing, playList, toggle } = usePlayer();
  const isCurrent = current?.id === song.id;
  const play = () => (!canPlay(song) ? lockedMsg(song) : isCurrent ? toggle() : playList(list, list.indexOf(song)));
  return (
    <div role="button" tabIndex={0} onClick={play} className="group snap-start shrink-0 w-36 md:w-44 p-2 md:p-3 rounded-lg hover:bg-hover/60 transition cursor-pointer">
      <div className="relative">
        <Cover url={song.cover?.url} color={song.genre?.color} className="w-full aspect-square shadow-lg shadow-black/40" />
        {!canPlay(song) && <PremiumBadge />}
        {canPlay(song) && (
          <span className={`absolute right-2 bottom-2 transition ${isCurrent ? 'opacity-100' : 'opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0'}`}>
            <PlayButton onClick={play} playing={isCurrent && playing} size={42} />
          </span>
        )}
      </div>
      <div className={`mt-2 text-sm font-semibold truncate ${isCurrent ? 'text-accent' : ''}`}>{song.title}</div>
      <div className="text-xs text-dim truncate">{song.artist || 'Unknown artist'}</div>
    </div>
  );
};

/** Compact tile for the quick-pick grid at the top. */
const QuickTile = ({ song, list }: { song: Song; list: Song[] }) => {
  const { current, playing, playList, toggle } = usePlayer();
  const isCurrent = current?.id === song.id;
  return (
    <button onClick={() => (!canPlay(song) ? lockedMsg(song) : isCurrent ? toggle() : playList(list, list.indexOf(song)))}
      className="group flex items-center gap-3 rounded-md bg-white/10 hover:bg-white/20 overflow-hidden text-left transition h-14">
      <Cover url={song.cover?.url} color={song.genre?.color} className="w-14 h-14" round="rounded-none" />
      <span className="flex-1 min-w-0 text-sm font-semibold truncate pr-2">{song.title}</span>
      {!canPlay(song) && <Lock size={14} className="text-premium mr-3 shrink-0" aria-label="Premium" />}
      {isCurrent && <span className="pr-3"><PlayingBars active={playing} /></span>}
    </button>
  );
};

export const HomePage = () => {
  const recentIds = useRecent();
  const { playList } = usePlayer();
  const [newest, setNewest] = useState<Song[] | null>(null);
  const [popular, setPopular] = useState<Song[]>([]);
  const [recent, setRecent] = useState<Song[]>([]);
  const [albums, setAlbums] = useState<Collection[]>([]);
  const [mixes, setMixes] = useState<Collection[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);

  useEffect(() => {
    void fetchSongs({ order: 'new' }, 0, 20).then(r => setNewest(r.rows)).catch(() => setNewest([]));
    void fetchSongs({ order: 'popular' }, 0, 20).then(r => setPopular(r.rows)).catch(() => {});
    void fetchCollections('album').then(setAlbums).catch(() => {});
    void fetchCollections('mix').then(setMixes).catch(() => {});
    void fetchGenres().then(setGenres).catch(() => {});
  }, []);
  useEffect(() => { void fetchSongsByIds(recentIds.slice(0, 20)).then(setRecent).catch(() => {}); }, [recentIds]);

  const playCollection = async (c: Collection) => { const { songs } = await fetchCollection(c.id); playList(songs, 0, { finite: true }); };
  const quick = (recent.length ? recent : newest ?? []).slice(0, 6);

  return (
    <div className="space-y-8 pb-4">
      <div className="px-4 md:px-6 pt-6 pb-2 bg-gradient-to-b from-violet-700/40 to-transparent space-y-4">
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">{greeting()}</h1>
        {newest === null ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : quick.length > 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">{quick.map(s => <QuickTile key={s.id} song={s} list={quick} />)}</div>
        ) : (
          <p className="text-dim">No music yet. Songs uploaded from batools appear here.</p>
        )}
      </div>

      <div className="space-y-8 md:px-6">
        {recent.length > 0 && <Shelf title="Recently played" to="/library/recent">{recent.map(s => <SongCard key={s.id} song={s} list={recent} />)}</Shelf>}
        {newest && newest.length > 0 && <Shelf title="New releases" to="/search">{newest.map(s => <SongCard key={s.id} song={s} list={newest} />)}</Shelf>}
        {popular.length > 0 && <Shelf title="Most played">{popular.map(s => <SongCard key={s.id} song={s} list={popular} />)}</Shelf>}
        {albums.length > 0 && <Shelf title="Albums">{albums.map(c => <CollectionCard key={c.id} c={c} onPlay={() => void playCollection(c)} />)}</Shelf>}
        {mixes.length > 0 && <Shelf title="Mixes for you">{mixes.map(c => <CollectionCard key={c.id} c={c} onPlay={() => void playCollection(c)} />)}</Shelf>}
        {genres.length > 0 && (
          <Shelf title="Genres" to="/search">
            {genres.map(g => <div key={g.id} className="snap-start shrink-0 w-36 md:w-44 p-2 md:p-3"><GenreCard g={g} /></div>)}
          </Shelf>
        )}
      </div>
    </div>
  );
};

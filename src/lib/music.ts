import { supabase } from './supabase';

// The music catalogue (mp_ tables, managed in the batools Music panel).

export type Particle = 'sparks' | 'bubbles' | 'embers' | 'snow' | 'stars' | 'waves' | 'petals' | 'notes';

export type MediaFile = { id: string; url: string };
export type Genre = { id: string; name: string; particle: Particle; color: string };

export type Source = { kind: 'band' | 'movie' | 'concert' | 'tv_show' | 'drama' | 'other'; name: string };

/** A song as the UI uses it. artist / origin / language are flattened from the
 *  singers, country and language tables (see toSong). */
export type Song = {
  id: string; title: string; artist: string | null; genre_id: string | null;
  origin: string | null; language: string | null; source: Source | null; mood: string | null; release_year: number | null;
  tags: string[]; description: string | null; lyrics: string | null; is_free: boolean;
  duration_seconds: number | null; play_count: number; created_at: string;
  audio: MediaFile | null; cover: MediaFile | null; genre: Genre | null;
};

export type Collection = {
  id: string; kind: 'album' | 'mix'; title: string; artist: string | null; description: string | null;
  release_year: number | null; created_at: string; cover: MediaFile | null; songs: { count: number }[];
  source: Source | null; origin: string | null; languages: string[];
};

export const SONG_SELECT =
  'id, title, genre_id, mood, release_year, tags, description, lyrics, is_free, duration_seconds, play_count, created_at, ' +
  'audio:mp_files!mp_songs_audio_fkey(id, url), cover:mp_files!mp_songs_cover_fkey(id, url), genre:mp_genres!mp_songs_genre_fkey(id, name, particle, color), ' +
  'country:mp_countries!mp_songs_country_fkey(name), lang:mp_languages!mp_songs_language_fkey(name), source:mp_sources!mp_songs_source_fkey(kind, name), ' +
  'singers:mp_song_singers(position, singer:mp_singers!mp_song_singers_singer_fkey(name))';

const COLLECTION_SELECT =
  'id, kind, title, description, release_year, created_at, cover:mp_files!mp_collections_cover_fkey(id, url), songs:mp_collection_songs(count), ' +
  'singers:mp_collection_singers(position, singer:mp_singers!mp_collection_singers_singer_fkey(name)), ' +
  'source:mp_sources!mp_collections_source_fkey(kind, name), country:mp_countries!mp_collections_country_fkey(name), ' +
  'langs:mp_collection_languages(language:mp_languages!mp_collection_languages_language_fkey(name))';

type SongRow = Omit<Song, 'artist' | 'origin' | 'language'> & {
  country: { name: string } | null; lang: { name: string } | null;
  singers: { position: number; singer: { name: string } | null }[] | null;
};

type SingerLinks = { position: number; singer: { name: string } | null }[] | null;
const names = (singers: SingerLinks) => [...(singers ?? [])].sort((a, b) => a.position - b.position).map(x => x.singer?.name).filter(Boolean).join(', ') || null;

const toSong = ({ country, lang, singers, ...r }: SongRow): Song => ({
  ...r,
  artist: names(singers),
  origin: country?.name ?? null,
  language: lang?.name ?? null,
});

type CollectionRow = Omit<Collection, 'artist' | 'origin' | 'languages'> & {
  singers: SingerLinks; country: { name: string } | null; langs: { language: { name: string } | null }[] | null;
};
const toCollection = ({ singers, country, langs, ...c }: CollectionRow): Collection => ({
  ...c,
  artist: names(singers),
  origin: country?.name ?? null,
  languages: (langs ?? []).map(l => l.language?.name).filter((n): n is string => !!n),
});

/** Paid songs are locked in the public app (for now). */
export const canPlay = (s: Song) => s.is_free;

export const formatDuration = (seconds: number | null | undefined) => {
  if (!seconds || !Number.isFinite(seconds)) return '0:00';
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const asSongs = (data: unknown) => ((data ?? []) as SongRow[]).map(toSong);

/** Like Spotify, lists show the top songs / albums only, never "everything". */
export const TOP = 20;

/** Stands for "not set" in genre / mood filters (songs whose info is still incomplete). */
export const UNKNOWN = 'unknown';
const UNKNOWN_GENRE: Genre = { id: UNKNOWN, name: 'Unknown', particle: 'stars', color: '#71717a' };

export type SongQuery = { search?: string; genreId?: string; mood?: string; order?: 'new' | 'popular' };

export async function fetchSongs(q: SongQuery, from = 0, size = TOP): Promise<{ rows: Song[]; total: number }> {
  let query = supabase.from('mp_songs').select(SONG_SELECT, { count: 'exact' });
  const s = q.search?.trim().replace(/[,()]/g, ' ');
  if (s) {
    // Singer / country / language names live in their own tables: find matching ids first.
    const like = `%${s}%`;
    const [singers, countries, languages] = await Promise.all([
      supabase.from('mp_singers').select('id').ilike('name', like).limit(50),
      supabase.from('mp_countries').select('id').ilike('name', like).limit(20),
      supabase.from('mp_languages').select('id').or(`name.ilike.${like},native_name.ilike.${like}`).limit(20),
    ]);
    const ids = (r: { data: { id: string }[] | null }) => (r.data ?? []).map(x => x.id);
    const singerIds = ids(singers);
    const bySinger = singerIds.length
      ? ((await supabase.from('mp_song_singers').select('song_id').in('singer_id', singerIds).limit(500)).data ?? []).map(x => x.song_id as string)
      : [];
    const ors = [`title.ilike.${like}`];
    if (bySinger.length) ors.push(`id.in.(${[...new Set(bySinger)].join(',')})`);
    if (ids(countries).length) ors.push(`country_id.in.(${ids(countries).join(',')})`);
    if (ids(languages).length) ors.push(`language_id.in.(${ids(languages).join(',')})`);
    query = query.or(ors.join(','));
  }
  if (q.genreId === UNKNOWN) query = query.is('genre_id', null);
  else if (q.genreId) query = query.eq('genre_id', q.genreId);
  if (q.mood === UNKNOWN) query = query.is('mood', null);
  else if (q.mood) query = query.eq('mood', q.mood);
  query = q.order === 'popular'
    ? query.order('play_count', { ascending: false }).order('created_at', { ascending: false })
    : query.order('created_at', { ascending: false });
  const { data, count, error } = await query.range(from, from + size - 1);
  if (error) throw error;
  return { rows: asSongs(data), total: count ?? 0 };
}

/** Songs by id, in the order given (for liked / recent / a restored queue). */
export async function fetchSongsByIds(ids: string[]): Promise<Song[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase.from('mp_songs').select(SONG_SELECT).in('id', ids);
  if (error) throw error;
  const byId = new Map(asSongs(data).map(s => [s.id, s]));
  return ids.map(id => byId.get(id)).filter((s): s is Song => !!s);
}

export type CollectionOrder = 'recent' | 'title' | 'year';

/** Albums / mixes; search matches the title, a singer or the source (band, movie…). */
export async function fetchCollections(kind?: 'album' | 'mix', search?: string, limit = TOP, order: CollectionOrder = 'recent'): Promise<Collection[]> {
  let q = supabase.from('mp_collections').select(COLLECTION_SELECT).limit(limit);
  q = order === 'title' ? q.order('title')
    : order === 'year' ? q.order('release_year', { ascending: false, nullsFirst: false }).order('title')
    : q.order('created_at', { ascending: false });
  if (kind) q = q.eq('kind', kind);
  const s = search?.trim().replace(/[,()]/g, ' ');
  if (s) {
    const like = `%${s}%`;
    const [singers, sources] = await Promise.all([
      supabase.from('mp_singers').select('id').ilike('name', like).limit(50),
      supabase.from('mp_sources').select('id').ilike('name', like).limit(20),
    ]);
    const singerIds = (singers.data ?? []).map(x => x.id as string);
    const sourceIds = (sources.data ?? []).map(x => x.id as string);
    const bySinger = singerIds.length
      ? ((await supabase.from('mp_collection_singers').select('collection_id').in('singer_id', singerIds).limit(500)).data ?? []).map(x => x.collection_id as string)
      : [];
    const ors = [`title.ilike.${like}`];
    if (bySinger.length) ors.push(`id.in.(${[...new Set(bySinger)].join(',')})`);
    if (sourceIds.length) ors.push(`source_id.in.(${sourceIds.join(',')})`);
    q = q.or(ors.join(','));
  }
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as unknown as CollectionRow[]).map(toCollection);
}

/** Albums / mixes by id, in the order given (recent searches). */
export async function fetchCollectionsByIds(ids: string[]): Promise<Collection[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase.from('mp_collections').select(COLLECTION_SELECT).in('id', ids);
  if (error) throw error;
  const byId = new Map(((data ?? []) as unknown as CollectionRow[]).map(toCollection).map(c => [c.id, c]));
  return ids.map(id => byId.get(id)).filter((c): c is Collection => !!c);
}

export async function fetchCollection(id: string): Promise<{ collection: Collection | null; songs: Song[] }> {
  const [c, l] = await Promise.all([
    supabase.from('mp_collections').select(COLLECTION_SELECT).eq('id', id).maybeSingle(),
    supabase.from('mp_collection_songs').select(`position, song:mp_songs!mp_collection_songs_song_fkey(${SONG_SELECT})`).eq('collection_id', id).order('position'),
  ]);
  if (c.error) throw c.error;
  if (l.error) throw l.error;
  const songs = ((l.data ?? []) as unknown as { song: SongRow | null }[]).map(x => x.song).filter((s): s is SongRow => !!s).map(toSong);
  return { collection: c.data ? toCollection(c.data as unknown as CollectionRow) : null, songs };
}

/** Is there any song without this field? (head-only count, no rows fetched) */
const anyMissing = async (column: 'genre_id' | 'mood') => {
  const { count } = await supabase.from('mp_songs').select('id', { count: 'exact', head: true }).is(column, null);
  return (count ?? 0) > 0;
};

/** Genres A–Z, plus "Unknown" at the end while some songs have no genre yet. */
export async function fetchGenres(): Promise<Genre[]> {
  const [{ data, error }, missing] = await Promise.all([
    supabase.from('mp_genres').select('id, name, particle, color').order('name'),
    anyMissing('genre_id').catch(() => false),
  ]);
  if (error) throw error;
  return [...((data ?? []) as Genre[]), ...(missing ? [UNKNOWN_GENRE] : [])];
}

/** Show an "Unknown" mood chip only while some songs have no mood. */
export const hasUnknownMood = () => anyMissing('mood').catch(() => false);

export async function countPlay(songId: string) {
  await supabase.rpc('mp_count_play', { p_song_id: songId });
}

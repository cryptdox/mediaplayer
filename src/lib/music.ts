import { supabase } from './supabase';

// The music catalogue (mp_ tables, managed in the batools Music panel).

export type Particle = 'sparks' | 'bubbles' | 'embers' | 'snow' | 'stars' | 'waves' | 'petals' | 'notes';

export type MediaFile = { id: string; url: string };
export type Genre = { id: string; name: string; particle: Particle; color: string };

export type Song = {
  id: string; title: string; artist: string | null; genre_id: string | null;
  origin: string | null; language: string | null; mood: string | null; release_year: number | null;
  tags: string[]; description: string | null; lyrics: string | null; is_free: boolean;
  duration_seconds: number | null; play_count: number; created_at: string;
  audio: MediaFile | null; cover: MediaFile | null; genre: Genre | null;
};

export type Collection = {
  id: string; kind: 'album' | 'mix'; title: string; artist: string | null; description: string | null;
  release_year: number | null; created_at: string; cover: MediaFile | null; songs: { count: number }[];
};

export const SONG_SELECT =
  'id, title, artist, genre_id, origin, language, mood, release_year, tags, description, lyrics, is_free, duration_seconds, play_count, created_at, ' +
  'audio:mp_files!mp_songs_audio_fkey(id, url), cover:mp_files!mp_songs_cover_fkey(id, url), genre:mp_genres!mp_songs_genre_fkey(id, name, particle, color)';

const COLLECTION_SELECT =
  'id, kind, title, artist, description, release_year, created_at, cover:mp_files!mp_collections_cover_fkey(id, url), songs:mp_collection_songs(count)';

/** Paid songs are locked in the public app (for now). */
export const canPlay = (s: Song) => s.is_free;

export const formatDuration = (seconds: number | null | undefined) => {
  if (!seconds || !Number.isFinite(seconds)) return '0:00';
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const asSongs = (data: unknown) => (data ?? []) as Song[];

export type SongQuery = { search?: string; genreId?: string; mood?: string; order?: 'new' | 'popular' };

export async function fetchSongs(q: SongQuery, from = 0, size = 30): Promise<{ rows: Song[]; total: number }> {
  let query = supabase.from('mp_songs').select(SONG_SELECT, { count: 'exact' });
  const s = q.search?.trim().replace(/[,()]/g, ' ');
  if (s) query = query.or(`title.ilike.%${s}%,artist.ilike.%${s}%,origin.ilike.%${s}%,language.ilike.%${s}%`);
  if (q.genreId) query = query.eq('genre_id', q.genreId);
  if (q.mood) query = query.eq('mood', q.mood);
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

export async function fetchCollections(kind?: 'album' | 'mix', search?: string, limit = 30): Promise<Collection[]> {
  let q = supabase.from('mp_collections').select(COLLECTION_SELECT).order('created_at', { ascending: false }).limit(limit);
  if (kind) q = q.eq('kind', kind);
  if (search?.trim()) q = q.ilike('title', `%${search.trim()}%`);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as Collection[];
}

export async function fetchCollection(id: string): Promise<{ collection: Collection | null; songs: Song[] }> {
  const [c, l] = await Promise.all([
    supabase.from('mp_collections').select(COLLECTION_SELECT).eq('id', id).maybeSingle(),
    supabase.from('mp_collection_songs').select(`position, song:mp_songs!mp_collection_songs_song_fkey(${SONG_SELECT})`).eq('collection_id', id).order('position'),
  ]);
  if (c.error) throw c.error;
  if (l.error) throw l.error;
  const songs = ((l.data ?? []) as unknown as { song: Song | null }[]).map(x => x.song).filter((s): s is Song => !!s);
  return { collection: (c.data ?? null) as unknown as Collection | null, songs };
}

export async function fetchGenres(): Promise<Genre[]> {
  const { data, error } = await supabase.from('mp_genres').select('id, name, particle, color').order('name');
  if (error) throw error;
  return (data ?? []) as Genre[];
}

export async function countPlay(songId: string) {
  await supabase.rpc('mp_count_play', { p_song_id: songId });
}

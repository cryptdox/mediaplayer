import { useEffect, useState } from 'react';

// "Your Library" without an account: liked songs and recently played live on
// this device (localStorage), synced between components and tabs.

// Everything kept on the device is capped: when a list is full, the oldest
// entries drop off (newest first, whatever their type).
const LIKED = 'mp-liked';
const RECENT = 'mp-recent';
const SEARCHES = 'mp-search-history';
const EVENT = 'mp-library-change';
const LIKED_MAX = 500;
const RECENT_MAX = 50;
export const SEARCHES_MAX = 20;

const read = (key: string): string[] => {
  try { const v = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
};
const write = (key: string, ids: string[]) => {
  try { localStorage.setItem(key, JSON.stringify(ids)); } catch { /* storage full or blocked: best effort */ }
  window.dispatchEvent(new Event(EVENT));
};

function useIds(key: string) {
  const [ids, setIds] = useState(() => read(key));
  useEffect(() => {
    const sync = () => setIds(read(key));
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener('storage', sync); };
  }, [key]);
  return ids;
}

export const useLiked = () => useIds(LIKED);
export const useRecent = () => useIds(RECENT);

/** Put id first (moving it if present) and keep only the newest `max`. */
const pushFirst = (key: string, id: string, max: number) => write(key, [id, ...read(key).filter(x => x !== id)].slice(0, max));

export const toggleLike = (id: string) => {
  const ids = read(LIKED);
  if (ids.includes(id)) write(LIKED, ids.filter(x => x !== id));
  else pushFirst(LIKED, id, LIKED_MAX);
};

export const pushRecent = (id: string) => pushFirst(RECENT, id, RECENT_MAX);

// Recent searches: what was opened or played from Search, as "kind:id", one mixed list.
export type SearchPickKind = 'song' | 'collection' | 'genre';
export type SearchPick = { kind: SearchPickKind; id: string };
const KINDS: SearchPickKind[] = ['song', 'collection', 'genre'];
const parsePick = (s: string): SearchPick | null => {
  const i = s.indexOf(':');
  const kind = s.slice(0, i) as SearchPickKind;
  return i > 0 && KINDS.includes(kind) ? { kind, id: s.slice(i + 1) } : null;
};

export const useSearchHistory = (): SearchPick[] => useIds(SEARCHES).map(parsePick).filter((p): p is SearchPick => !!p);
export const pushSearchPick = (kind: SearchPickKind, id: string) => pushFirst(SEARCHES, `${kind}:${id}`, SEARCHES_MAX);
export const removeSearchPicks = (picks: SearchPick[]) => {
  const drop = new Set(picks.map(p => `${p.kind}:${p.id}`));
  write(SEARCHES, read(SEARCHES).filter(x => !drop.has(x)));
};
export const clearSearchHistory = () => write(SEARCHES, []);

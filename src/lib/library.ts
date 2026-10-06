import { useEffect, useState } from 'react';

// "Your Library" without an account: liked songs and recently played live on
// this device (localStorage), synced between components and tabs.

const LIKED = 'mp-liked';
const RECENT = 'mp-recent';
const EVENT = 'mp-library-change';
const RECENT_MAX = 50;

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

export const toggleLike = (id: string) => {
  const ids = read(LIKED);
  write(LIKED, ids.includes(id) ? ids.filter(x => x !== id) : [id, ...ids]);
};

export const pushRecent = (id: string) => {
  write(RECENT, [id, ...read(RECENT).filter(x => x !== id)].slice(0, RECENT_MAX));
};

import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Home, Search, Library, Heart, History } from 'lucide-react';
import clsx from 'clsx';
import { fetchCollections, type Collection } from '../lib/music';
import { useLiked } from '../lib/library';
import { Cover } from './ui';
import { FullPlayer, MiniPlayer, PlayerBar, useFullPlayer } from './PlayerUi';
import { Toaster } from './Toaster';

const navItem = ({ isActive }: { isActive: boolean }) =>
  clsx('flex items-center gap-4 px-3 py-2 rounded-md font-semibold transition', isActive ? 'text-ink' : 'text-dim hover:text-ink');

/** Desktop sidebar: navigation + "Your Library". */
const Sidebar = () => {
  const liked = useLiked();
  const [lists, setLists] = useState<Collection[]>([]);
  useEffect(() => { void fetchCollections(undefined, undefined, 50).then(setLists).catch(() => {}); }, []);
  return (
    <aside className="hidden md:flex flex-col gap-2 w-72 shrink-0 p-2">
      <div className="rounded-lg bg-surface p-3 space-y-1">
        <Link to="/" className="flex items-center gap-2 px-3 pb-3 pt-1">
          <img src="/favicon.svg" alt="" className="w-8 h-8" />
          <span className="font-extrabold tracking-tight text-lg">Media Player</span>
        </Link>
        <NavLink to="/" end className={navItem}><Home size={22} />Home</NavLink>
        <NavLink to="/search" className={navItem}><Search size={22} />Search</NavLink>
      </div>
      <div className="rounded-lg bg-surface flex-1 min-h-0 flex flex-col">
        <NavLink to="/library" className={p => clsx(navItem(p), 'm-2')}><Library size={22} />Your Library</NavLink>
        <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
          <Link to="/library/liked" className="flex items-center gap-3 p-2 rounded-md hover:bg-hover">
            <span className="w-12 h-12 rounded-md flex items-center justify-center bg-gradient-to-br from-violet-600 to-emerald-400"><Heart size={20} fill="white" /></span>
            <span className="min-w-0"><span className="block text-sm font-semibold">Liked Songs</span><span className="block text-xs text-dim">{liked.length} songs</span></span>
          </Link>
          <Link to="/library/recent" className="flex items-center gap-3 p-2 rounded-md hover:bg-hover">
            <span className="w-12 h-12 rounded-md flex items-center justify-center bg-elevated"><History size={20} /></span>
            <span className="text-sm font-semibold">Recently played</span>
          </Link>
          {lists.map(c => (
            <Link key={c.id} to={`/c/${c.id}`} className="flex items-center gap-3 p-2 rounded-md hover:bg-hover">
              <Cover url={c.cover?.url} className="w-12 h-12" />
              <span className="min-w-0"><span className="block text-sm font-semibold truncate">{c.title}</span><span className="block text-xs text-dim truncate">{c.kind === 'album' ? 'Album' : 'Mix'}{c.artist ? ` · ${c.artist}` : ''}</span></span>
            </Link>
          ))}
        </div>
      </div>
    </aside>
  );
};

/** Phone tab bar. */
const BottomNav = () => {
  const tab = ({ isActive }: { isActive: boolean }) => clsx('flex-1 flex flex-col items-center gap-1 py-2 text-[11px] font-medium', isActive ? 'text-ink' : 'text-dim');
  return (
    <nav className="md:hidden flex bg-gradient-to-t from-bg via-bg/95 to-bg/70 pb-safe">
      <NavLink to="/" end className={tab}><Home size={24} />Home</NavLink>
      <NavLink to="/search" className={tab}><Search size={24} />Search</NavLink>
      <NavLink to="/library" className={tab}><Library size={24} />Your Library</NavLink>
    </nav>
  );
};

export const Layout = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  // Each page starts at the top.
  useEffect(() => { document.getElementById('main')?.scrollTo({ top: 0 }); }, [pathname]);
  // Android Back: close the full player, then go back, and at the root just
  // background the app so the music keeps playing.
  const fp = useFullPlayer();
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const sub = App.addListener('backButton', ({ canGoBack }) => {
      if (fp.open) fp.hide();
      else if (canGoBack && (window.history.state?.idx ?? 0) > 0) window.history.back();
      else void App.minimizeApp();
    });
    return () => { void sub.then(h => h.remove()); };
  }, [fp]);
  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0 flex md:gap-0">
        <Sidebar />
        <main id="main" className="flex-1 min-w-0 overflow-y-auto md:my-2 md:mr-2 md:rounded-lg bg-surface pt-safe md:pt-0 pb-36 md:pb-6">
          {children}
        </main>
      </div>
      <div className="fixed md:static inset-x-0 bottom-0 z-30">
        <MiniPlayer />
        <BottomNav />
        <PlayerBar />
      </div>
      <FullPlayer />
      <Toaster />
    </div>
  );
};

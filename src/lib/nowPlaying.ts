import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { MediaSession } from '@capgo/capacitor-media-session';

// "Now playing" outside the app: lock screen, notification, headset buttons and
// (Android) the home-screen widget. On the web this is the browser's Media
// Session API; in the Android app it is a native media session with a
// foreground service, so playback keeps going with the screen off.

export const isNative = Capacitor.isNativePlatform();

export type NowPlayingAction = 'play' | 'pause' | 'previoustrack' | 'nexttrack' | 'seekbackward' | 'seekforward' | 'seekto';
export type NowPlayingHandlers = {
  play: () => void; pause: () => void; toggle: () => void; prev: () => void; next: () => void;
  skip: (seconds: number) => void; seek: (seconds: number) => void;
};
export type NowPlayingTrack = { title: string; artist: string; album: string; cover: string | null };

type WidgetPlugin = {
  update(state: { title: string; artist: string; playing: boolean; cover: string | null }): Promise<void>;
  addListener(event: 'action', fn: (e: { action: 'toggle' | 'prev' | 'next' }) => void): Promise<PluginListenerHandle>;
};
const Widget = registerPlugin<WidgetPlugin>('MumuWidget');

const quiet = (p: Promise<unknown> | undefined) => { void p?.catch(() => {}); };

/** Wire the controls once; handlers are read through `get` so they are always current. */
export function bindNowPlayingControls(get: () => NowPlayingHandlers): () => void {
  const map: [NowPlayingAction, (d: { seekOffset?: number; seekTime?: number | null }) => void][] = [
    ['play', () => get().play()], ['pause', () => get().pause()],
    ['previoustrack', () => get().prev()], ['nexttrack', () => get().next()],
    ['seekbackward', d => get().skip(-(d.seekOffset ?? 10))], ['seekforward', d => get().skip(d.seekOffset ?? 10)],
    ['seekto', d => { if (d.seekTime != null) get().seek(d.seekTime); }],
  ];
  if (isNative) {
    for (const [action, fn] of map) quiet(MediaSession.setActionHandler({ action }, d => fn(d)));
    const sub = Widget.addListener('action', ({ action }) => {
      const h = get();
      if (action === 'toggle') h.toggle(); else if (action === 'prev') h.prev(); else h.next();
    });
    return () => { void sub.then(s => s.remove()); };
  }
  if (!('mediaSession' in navigator)) return () => {};
  for (const [action, fn] of map) {
    try { navigator.mediaSession.setActionHandler(action, d => fn(d)); } catch { /* unsupported action */ }
  }
  return () => {};
}

export function setNowPlayingTrack(t: NowPlayingTrack | null) {
  if (isNative) {
    quiet(MediaSession.setMetadata(t
      ? { title: t.title, artist: t.artist, album: t.album, artwork: t.cover ? [{ src: t.cover, sizes: '512x512' }] : [] }
      : { title: '', artist: '', album: '', artwork: [] }));
    return;
  }
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = t ? new MediaMetadata({
    title: t.title, artist: t.artist, album: t.album,
    artwork: [t.cover ? { src: t.cover, sizes: '512x512' } : { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }],
  }) : null;
}

export function setNowPlayingState(state: 'playing' | 'paused' | 'none', pos?: { duration: number; position: number; rate: number }) {
  if (isNative) {
    quiet(MediaSession.setPlaybackState({ playbackState: state }));
    if (pos && pos.duration) quiet(MediaSession.setPositionState({ duration: pos.duration, position: Math.min(pos.position, pos.duration), playbackRate: pos.rate }));
    return;
  }
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.playbackState = state;
  if (pos && pos.duration && navigator.mediaSession.setPositionState) {
    try { navigator.mediaSession.setPositionState({ duration: pos.duration, playbackRate: pos.rate, position: Math.min(pos.position, pos.duration) }); } catch { /* ignore */ }
  }
}

/** Home-screen widget (Android only). */
export function updateWidget(t: { title: string; artist: string; cover: string | null } | null, playing: boolean) {
  if (!isNative) return;
  quiet(Widget.update({ title: t?.title ?? 'mumu', artist: t?.artist ?? 'Tap to start listening', playing, cover: t?.cover ?? null }));
}

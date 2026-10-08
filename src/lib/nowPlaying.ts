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
  addListener(event: 'action', fn: (e: { action: 'toggle' | 'prev' | 'next' | 'pause'; launch?: boolean }) => void): Promise<PluginListenerHandle>;
  minimize(): Promise<void>;
};
const Widget = registerPlugin<WidgetPlugin>('MumuWidget');

const quiet = (p: Promise<unknown> | undefined) => { void p?.catch(() => {}); };

// The app was launched by a widget button: once the music plays, go back to the home screen.
let launchedByWidget = false;

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
    // Widget buttons, and 'pause' when headphones / Bluetooth are plugged in or out.
    const sub = Widget.addListener('action', ({ action, launch }) => {
      const h = get();
      // Nothing saved to play (first run)? Then the app stays open for the user to pick something.
      if (launch) { launchedByWidget = true; setTimeout(() => { launchedByWidget = false; }, 15000); }
      if (action === 'pause') h.pause();
      else if (action === 'toggle') { if (launch) h.play(); else h.toggle(); }
      else if (action === 'prev') h.prev(); else h.next();
    });
    return () => { void sub.then(s => s.remove()); };
  }
  const off = onAudioOutputChange(() => get().pause());
  if (!('mediaSession' in navigator)) return off;
  for (const [action, fn] of map) {
    try { navigator.mediaSession.setActionHandler(action, d => fn(d)); } catch { /* unsupported action */ }
  }
  return off;
}

/** Web: headphones / speakers plugged in or out. Without device permission the browser may
 *  hide which device changed, so then any audio device change counts. */
function onAudioOutputChange(fn: () => void): () => void {
  const md = navigator.mediaDevices;
  if (!md?.enumerateDevices || !md.addEventListener) return () => {};
  const audioDevices = async () => {
    try {
      const all = (await md.enumerateDevices()).filter(d => d.kind === 'audiooutput' || d.kind === 'audioinput');
      return all.some(d => d.deviceId) ? all.map(d => `${d.kind}:${d.deviceId}`).sort().join('|') : null;
    } catch { return null; }
  };
  let last: Promise<string | null> = audioDevices();
  const onChange = () => {
    const before = last;
    last = audioDevices();
    void Promise.all([before, last]).then(([a, b]) => { if (a === null || b === null || a !== b) fn(); });
  };
  md.addEventListener('devicechange', onChange);
  return () => md.removeEventListener('devicechange', onChange);
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
    if (state === 'playing' && launchedByWidget) {
      launchedByWidget = false;
      // Give the media-session service a moment to start in the foreground first.
      setTimeout(() => quiet(Widget.minimize()), 1000);
    }
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

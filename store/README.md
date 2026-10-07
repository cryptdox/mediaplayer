# mumu: brand and Play Store assets

Everything here is generated. Edit the sources, then re-run:

```bash
npm run store:brand   # logo -> web icons, Android launcher icons + splash, Play icon
npm run store:shots   # app screenshots (phone, 7" and 10" tablet) + feature graphic
```

Both scripts use the system Chrome (`CHROME=/path/to/chrome` to override). `store:shots` starts its own Vite server on port 5199. It answers the app's database requests from a **fictional demo catalogue** (`tools/demo-catalog.mjs`), so the images never show real artists or songs, and nothing reaches the live database.

## The logo

| | |
|---|---|
| Mark | A lowercase **m** drawn as two rounded arches, like a sound wave. It is stroked with a mint → emerald → lavender gradient (`#6ee7b7 → #34d399 → #a78bfa`). |
| Beat dot | A small emerald dot at the top right: the beat, or a note head. It also turns the mark into a face ("m" + eye), which makes it friendly and easy to remember. |
| Tile | A dark violet-to-black rounded square (`#1a1426 → #0b0b0f`) with a soft violet glow. Three faint record grooves echo the spinning record in the player. |
| Wordmark | `mumu` in **Fredoka SemiBold**, lowercase: rounded, like the arches of the mark. |
| Colours | Background `#0B0B0F` · surface `#14141B` · accent emerald `#34D399` · violet `#7C3AED` / `#A78BFA` · text `#F4F4F5` |

Source: `brand/mumu-icon.svg`. Lockups: `brand/mumu-lockup-dark.png`, `brand/mumu-lockup-light.png`.

## Play Console: what to upload

| Play Console field | File | Size | Play's rule |
|---|---|---|---|
| App icon | `play/icon-512.png` | 512 × 512 | 32-bit PNG, full square (Play rounds the corners), ≤ 1 MB |
| Feature graphic | `play/feature-graphic-1024x500.png` | 1024 × 500 | JPEG or 24-bit PNG, no alpha |
| Phone screenshots | `play/phone/01…07-*.png` | 1080 × 1920 | 2–8 images, 9:16, each side 320–3840 px, longest ≤ 2× shortest |
| 7-inch tablet screenshots | `play/tablet-7/01…05-*.png` | 1920 × 1080 | up to 8, 16:9 |
| 10-inch tablet screenshots | `play/tablet-10/01…05-*.png` | 2560 × 1440 | up to 8, 16:9 |

`play/raw/` holds the same screens without captions or frames. They also meet Play's rules, if you'd rather upload plain screenshots.

Recommended phone order: 01 player → 02 home → 03 search → 04 lyrics → 05 album → 06 library → 07 queue. The first 3 are the ones most people see.

## Suggested listing text

- **App name** (≤ 30): `mumu: Music Player`
- **Short description** (≤ 80): `Stream albums, mixes and moods with a player that dances to every beat.`
- **Full description** (≤ 4000):

  > mumu is a music player that feels alive. A spinning record, glowing visuals and particles move with every beat while you listen.
  >
  > • Fresh picks every day: new releases, most played, albums and mixes
  > • Find your sound: search songs, singers and moods, or browse by genre
  > • Sing along: lyrics, the queue and song details are one tap away
  > • You decide: shuffle, repeat one or all, playback speed, skip ±10 s
  > • Your library: liked songs and recently played, saved on your device
  > • Keeps playing in the background, with lock-screen and notification controls
  > • Home-screen widget: see what's playing, play / pause and skip without opening the app
  >
  > No account needed. Just open mumu and press play.

- **Category:** Music & Audio · **Tags:** Music player, Streaming, Lyrics

## Android release

- Package: `com.cryptdox.mumu` (permanent once uploaded) · version 1.0 (versionCode 1) · min Android 7.0 (API 24) · target API 36.
- Signed files: `release/mumu-1.0-release.aab` (upload this to Play) and `release/mumu-1.0-release.apk` (install directly on phones for testing).
  Rebuild with `npm run build && npx cap sync android && cd android && ./gradlew assembleRelease bundleRelease`.
- Upload key: `android/mumu-upload.jks` + its passwords in `android/keystore.properties` (both git-ignored). **Back both up somewhere safe.** If you lose them, you can't publish updates (unless Play App Signing resets the upload key). Enrol in Play App Signing on the first upload.
  Upload certificate SHA-256: `D4:44:98:D4:41:3D:D9:CB:30:F5:35:67:33:EA:C1:20:EB:DB:89:6D:B0:5E:AC:38:04:09:77:62:41:C5:A4:3C`.
- Play Console declarations this build needs:
  - **Foreground service: media playback** (`FOREGROUND_SERVICE_MEDIA_PLAYBACK`). Describe it as "plays music the user started, with the screen off or the app in the background". Play asks for a short video showing it.
  - **Notifications:** the now-playing notification only (no marketing notifications).

### Test on a phone before submitting

The emulator on the build machine was too slow to run these, so check them on a real device with the APK:
1. Play a song, press Home, then lock the screen. Music keeps playing.
2. The notification and lock screen show the cover, title and play / pause / next / previous, and they work.
3. Headphone / Bluetooth buttons play, pause and skip.
4. Long-press the home screen → Widgets → mumu. The widget shows the song and its buttons work. With the app closed, a tap opens mumu.
5. The splash is dark, the Back button closes the player, then goes back, then sends the app to the background.

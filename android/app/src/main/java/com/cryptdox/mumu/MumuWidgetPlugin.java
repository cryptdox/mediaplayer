package com.cryptdox.mumu;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.AudioDeviceCallback;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Bridge between the player (JS) and the home-screen widget. Also tells the player to
 * pause when the audio output changes (headphones / Bluetooth plugged in or out).
 */
@CapacitorPlugin(name = "MumuWidget")
public class MumuWidgetPlugin extends Plugin {

    private static MumuWidgetPlugin instance;
    private static String coverUrl;
    private static Bitmap cover;
    /** A widget button that launched the app; sent to the player once it is listening. */
    private static String launchAction;

    private final BroadcastReceiver noisy = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (AudioManager.ACTION_AUDIO_BECOMING_NOISY.equals(intent.getAction())) send("pause", false);
        }
    };
    private AudioDeviceCallback outputs;

    @Override
    public void load() {
        instance = this;
        Context context = getContext();
        ContextCompat.registerReceiver(context, noisy, new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY), ContextCompat.RECEIVER_NOT_EXPORTED);
        AudioManager am = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
        if (am != null) {
            outputs = new AudioDeviceCallback() {
                // Called once on registration with the devices already there: not a change.
                private boolean initial = true;

                @Override
                public void onAudioDevicesAdded(AudioDeviceInfo[] added) {
                    if (initial) { initial = false; return; }
                    if (hasOutput(added)) send("pause", false);
                }

                @Override
                public void onAudioDevicesRemoved(AudioDeviceInfo[] removed) {
                    if (hasOutput(removed)) send("pause", false);
                }
            };
            am.registerAudioDeviceCallback(outputs, new Handler(Looper.getMainLooper()));
        }
        if (launchAction != null) {
            send(launchAction, true);
            launchAction = null;
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (instance == this) instance = null;
        Context context = getContext();
        try { context.unregisterReceiver(noisy); } catch (IllegalArgumentException ignored) { }
        AudioManager am = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
        if (am != null && outputs != null) am.unregisterAudioDeviceCallback(outputs);
    }

    private static boolean hasOutput(AudioDeviceInfo[] devices) {
        for (AudioDeviceInfo d : devices) {
            if (d.isSink() && d.getType() != AudioDeviceInfo.TYPE_BUILTIN_EARPIECE && d.getType() != AudioDeviceInfo.TYPE_BUILTIN_SPEAKER) return true;
        }
        return false;
    }

    /** launch: the action opened the app (kept until the player listens). */
    private void send(String action, boolean launch) {
        JSObject data = new JSObject();
        data.put("action", action);
        data.put("launch", launch);
        notifyListeners("action", data, launch);
    }

    /** The app was opened by a widget button (MainActivity): play once the player is ready. */
    static void launchedBy(String action) {
        MumuWidgetPlugin p = instance;
        if (p != null && p.getBridge() != null) p.send(action, true);
        else launchAction = action;
    }

    static Bitmap cachedCover() {
        return cover;
    }

    /** A widget button: hand it to the running player. False when the app isn't running. */
    static boolean dispatch(String action) {
        MumuWidgetPlugin p = instance;
        if (p == null || p.getBridge() == null) return false;
        p.send(action, false);
        return true;
    }

    /** Once playback has started from a widget launch: step aside and leave the music playing. */
    @PluginMethod
    public void minimize(PluginCall call) {
        getActivity().runOnUiThread(() -> getActivity().moveTaskToBack(true));
        call.resolve();
    }

    @PluginMethod
    public void update(PluginCall call) {
        Context context = getContext();
        context.getSharedPreferences(MumuWidgetProvider.PREFS, Context.MODE_PRIVATE).edit()
            .putString("title", call.getString("title", "mumu"))
            .putString("artist", call.getString("artist", ""))
            .putBoolean("playing", Boolean.TRUE.equals(call.getBoolean("playing", false)))
            .apply();
        String url = call.getString("cover");
        if (url == null || url.isEmpty()) {
            coverUrl = null;
            cover = null;
        } else if (!url.equals(coverUrl)) {
            // Plugin calls run off the main thread, so the cover can be fetched here.
            coverUrl = url;
            cover = loadBitmap(url);
        }
        MumuWidgetProvider.render(context, cover);
        call.resolve();
    }

    private static Bitmap loadBitmap(String url) {
        try {
            byte[] bytes;
            if (url.startsWith("http")) {
                HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
                c.setConnectTimeout(5000);
                c.setReadTimeout(8000);
                try (InputStream in = c.getInputStream(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                    byte[] buf = new byte[16384];
                    for (int n; (n = in.read(buf)) != -1; ) out.write(buf, 0, n);
                    bytes = out.toByteArray();
                }
            } else if (url.contains(";base64,")) {
                bytes = Base64.decode(url.substring(url.indexOf(";base64,") + 8), Base64.DEFAULT);
            } else {
                return null;
            }
            // Keep it small: widget bitmaps travel through a size-limited IPC buffer.
            BitmapFactory.Options bounds = new BitmapFactory.Options();
            bounds.inJustDecodeBounds = true;
            BitmapFactory.decodeByteArray(bytes, 0, bytes.length, bounds);
            BitmapFactory.Options opts = new BitmapFactory.Options();
            opts.inSampleSize = Math.max(1, Math.min(bounds.outWidth, bounds.outHeight) / 256);
            Bitmap b = BitmapFactory.decodeByteArray(bytes, 0, bytes.length, opts);
            if (b == null) return null;
            int side = Math.min(b.getWidth(), b.getHeight()); // centre-crop to a square, like the app's covers
            Bitmap square = Bitmap.createBitmap(b, (b.getWidth() - side) / 2, (b.getHeight() - side) / 2, side, side);
            return Bitmap.createScaledBitmap(square, 256, 256, true);
        } catch (Exception e) {
            return null;
        }
    }
}

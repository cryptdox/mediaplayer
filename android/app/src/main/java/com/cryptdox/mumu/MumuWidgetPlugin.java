package com.cryptdox.mumu;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/** Bridge between the player (JS) and the home-screen widget. */
@CapacitorPlugin(name = "MumuWidget")
public class MumuWidgetPlugin extends Plugin {

    private static MumuWidgetPlugin instance;
    private static String coverUrl;
    private static Bitmap cover;

    @Override
    public void load() {
        instance = this;
    }

    @Override
    protected void handleOnDestroy() {
        if (instance == this) instance = null;
    }

    static Bitmap cachedCover() {
        return cover;
    }

    /** A widget button: hand it to the running player. False when the app isn't running. */
    static boolean dispatch(String action) {
        MumuWidgetPlugin p = instance;
        if (p == null || p.getBridge() == null) return false;
        JSObject data = new JSObject();
        data.put("action", action);
        p.notifyListeners("action", data);
        return true;
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

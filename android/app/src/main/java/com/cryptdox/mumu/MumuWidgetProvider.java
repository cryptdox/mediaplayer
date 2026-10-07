package com.cryptdox.mumu;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.widget.RemoteViews;

/**
 * Home-screen player widget (like Spotify's): cover, title / artist and
 * previous · play-pause · next. The app pushes its state through MumuWidgetPlugin;
 * the buttons are sent back to the running player, or open the app when it isn't running.
 */
public class MumuWidgetProvider extends AppWidgetProvider {

    static final String PREFS = "mumu_widget";
    static final String ACTION_TOGGLE = "com.cryptdox.mumu.widget.TOGGLE";
    static final String ACTION_PREV = "com.cryptdox.mumu.widget.PREV";
    static final String ACTION_NEXT = "com.cryptdox.mumu.widget.NEXT";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        render(context, MumuWidgetPlugin.cachedCover());
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        String js = ACTION_TOGGLE.equals(action) ? "toggle" : ACTION_PREV.equals(action) ? "prev" : ACTION_NEXT.equals(action) ? "next" : null;
        if (js != null) {
            if (!MumuWidgetPlugin.dispatch(js)) openApp(context);
            return;
        }
        super.onReceive(context, intent);
    }

    /** Redraw every placed widget from the saved state. */
    static void render(Context context, Bitmap cover) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.mumu_widget);
        views.setTextViewText(R.id.widget_title, prefs.getString("title", context.getString(R.string.app_name)));
        views.setTextViewText(R.id.widget_artist, prefs.getString("artist", context.getString(R.string.widget_idle)));
        views.setImageViewResource(R.id.widget_play, prefs.getBoolean("playing", false) ? R.drawable.ic_widget_pause : R.drawable.ic_widget_play);
        if (cover != null) views.setImageViewBitmap(R.id.widget_cover, cover);
        else views.setImageViewResource(R.id.widget_cover, R.drawable.ic_widget_note);

        PendingIntent open = PendingIntent.getActivity(context, 0,
            new Intent(context, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_cover, open);
        views.setOnClickPendingIntent(R.id.widget_text, open);
        views.setOnClickPendingIntent(R.id.widget_play, button(context, ACTION_TOGGLE, 1));
        views.setOnClickPendingIntent(R.id.widget_prev, button(context, ACTION_PREV, 2));
        views.setOnClickPendingIntent(R.id.widget_next, button(context, ACTION_NEXT, 3));

        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        manager.updateAppWidget(new ComponentName(context, MumuWidgetProvider.class), views);
    }

    private static PendingIntent button(Context context, String action, int code) {
        Intent intent = new Intent(context, MumuWidgetProvider.class).setAction(action);
        return PendingIntent.getBroadcast(context, code, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static void openApp(Context context) {
        context.startActivity(new Intent(context, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP));
    }
}

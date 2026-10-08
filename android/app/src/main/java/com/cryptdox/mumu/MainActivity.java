package com.cryptdox.mumu;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /** Set by the widget when one of its buttons opens the app: the action to run once it is up. */
    static final String EXTRA_WIDGET_ACTION = "com.cryptdox.mumu.WIDGET_ACTION";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MumuWidgetPlugin.class); // home-screen widget bridge (app-local plugin)
        super.onCreate(savedInstanceState);
        if (savedInstanceState == null) fromWidget(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        fromWidget(intent);
    }

    private void fromWidget(Intent intent) {
        String action = intent == null ? null : intent.getStringExtra(EXTRA_WIDGET_ACTION);
        if (action == null) return;
        intent.removeExtra(EXTRA_WIDGET_ACTION);
        MumuWidgetPlugin.launchedBy(action);
    }
}

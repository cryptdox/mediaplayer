package com.cryptdox.mumu;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MumuWidgetPlugin.class); // home-screen widget bridge (app-local plugin)
        super.onCreate(savedInstanceState);
    }
}

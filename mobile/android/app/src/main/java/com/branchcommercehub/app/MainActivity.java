package com.branchcommercehub.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String MOBILE_AUTH_HOST = "mobile-auth";
    private static final String MOBILE_AUTH_PATH = "/callback";
    private static final String WEB_CALLBACK_URL = "https://branchcommercehub.com/mobile-auth/callback";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(ExternalBrowserPlugin.class);
        registerPlugin(NativeClerkAuthPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        openMobileAuthCallback(intent);
    }

    private void openMobileAuthCallback(Intent intent) {
        if (bridge == null || intent == null) return;

        Uri uri = intent.getData();
        if (
            uri == null ||
            !"branchcommerce".equals(uri.getScheme()) ||
            !MOBILE_AUTH_HOST.equals(uri.getHost()) ||
            !MOBILE_AUTH_PATH.equals(uri.getPath())
        ) {
            return;
        }

        String ticket = uri.getQueryParameter("ticket");
        if (ticket == null || ticket.isEmpty()) return;

        String callbackUrl = WEB_CALLBACK_URL + "?ticket=" + Uri.encode(ticket);
        bridge.getWebView().post(() -> bridge.getWebView().loadUrl(callbackUrl));
    }
}

package com.branchcommercehub.app;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ExternalBrowser")
public class ExternalBrowserPlugin extends Plugin {
    private static final String ALLOWED_HOST = "branchcommercehub.com";
    private static final Uri BROWSER_PROBE_URL = Uri.parse("https://example.com/");

    @PluginMethod
    public void open(PluginCall call) {
        String url = call.getString("url");
        if (url == null) {
            call.reject("A URL is required.");
            return;
        }

        Uri uri = Uri.parse(url);
        if (!"https".equalsIgnoreCase(uri.getScheme()) || !ALLOWED_HOST.equalsIgnoreCase(uri.getHost())) {
            call.reject("This URL is not allowed.");
            return;
        }

        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            intent.addCategory(Intent.CATEGORY_BROWSABLE);
            String browserPackage = findBrowserPackage();
            if (browserPackage == null) {
                call.reject("No browser is available.");
                return;
            }

            // Target a real browser so Android App Links cannot reopen this app.
            intent.setPackage(browserPackage);
            getActivity().startActivity(intent);
            call.resolve();
        } catch (ActivityNotFoundException exception) {
            call.reject("No browser is available.", exception);
        }
    }

    private String findBrowserPackage() {
        PackageManager packageManager = getContext().getPackageManager();
        Intent probe = new Intent(Intent.ACTION_VIEW, BROWSER_PROBE_URL);
        probe.addCategory(Intent.CATEGORY_BROWSABLE);

        ResolveInfo defaultBrowser = packageManager.resolveActivity(probe, PackageManager.MATCH_DEFAULT_ONLY);
        String ownPackage = getContext().getPackageName();
        if (defaultBrowser != null && defaultBrowser.activityInfo != null) {
            String packageName = defaultBrowser.activityInfo.packageName;
            if (!ownPackage.equals(packageName) && !"android".equals(packageName)) {
                return packageName;
            }
        }

        for (ResolveInfo candidate : packageManager.queryIntentActivities(probe, PackageManager.MATCH_ALL)) {
            if (candidate.activityInfo != null && !ownPackage.equals(candidate.activityInfo.packageName)) {
                return candidate.activityInfo.packageName;
            }
        }

        return null;
    }
}

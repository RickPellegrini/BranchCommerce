package com.branchcommercehub.app;

import android.app.Activity;
import android.content.Intent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NativeClerkAuth")
public class NativeClerkAuthPlugin extends Plugin {
    @PluginMethod
    public void signIn(PluginCall call) {
        Intent intent = new Intent(getContext(), NativeAuthActivity.class);
        startActivityForResult(call, intent, "handleAuthResult");
    }

    @ActivityCallback
    private void handleAuthResult(PluginCall call, ActivityResult result) {
        if (call == null) return;

        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null) {
            call.reject("Login cancelado.");
            return;
        }

        String sessionToken = data.getStringExtra(NativeAuthActivity.EXTRA_SESSION_TOKEN);
        if (sessionToken == null || sessionToken.isEmpty()) {
            call.reject("Token de sessao indisponivel.");
            return;
        }

        JSObject response = new JSObject();
        response.put("sessionToken", sessionToken);
        call.resolve(response);
    }
}

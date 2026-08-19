package com.branchcommercehub.app

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.lifecycleScope
import com.clerk.api.Clerk
import com.clerk.api.network.serialization.ClerkResult
import com.clerk.api.session.Session
import com.clerk.api.ui.ClerkColors
import com.clerk.api.ui.ClerkTheme
import com.clerk.ui.auth.AuthView
import kotlinx.coroutines.launch

class NativeAuthActivity : ComponentActivity() {
  private var isReturningToken = false

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    enableEdgeToEdge()

    setContent {
      val isInitialized by Clerk.isInitialized.collectAsStateWithLifecycle()
      val initializationError by Clerk.initializationError.collectAsStateWithLifecycle()
      val session by Clerk.sessionFlow.collectAsStateWithLifecycle()
      var error by rememberSaveable { mutableStateOf<String?>(null) }
      var attemptedInitializationRecovery by rememberSaveable { mutableStateOf(false) }

      LaunchedEffect(isInitialized, initializationError) {
        if (isInitialized || initializationError == null) return@LaunchedEffect

        if (!attemptedInitializationRecovery) {
          attemptedInitializationRecovery = true
          error = null
          resetClerk()
        } else {
          error = "Nao foi possivel iniciar o login seguro. Feche e abra o aplicativo."
        }
      }

      LaunchedEffect(isInitialized, session?.id, session?.status) {
        if (!isInitialized) return@LaunchedEffect

        when (session?.status) {
          Session.SessionStatus.ACTIVE -> returnSessionToken { message -> error = message }
          null -> Unit
          else -> resetStaleClerkSession { message -> error = message }
        }
      }

      MaterialTheme {
        Surface(modifier = Modifier.fillMaxSize(), color = Color(0xFFF3F1E9)) {
          when {
            !isInitialized && error != null ->
              Box(
                modifier = Modifier.fillMaxSize().padding(24.dp),
                contentAlignment = Alignment.Center,
              ) {
                Text(
                  text = error.orEmpty(),
                  color = MaterialTheme.colorScheme.error,
                  style = MaterialTheme.typography.bodyMedium,
                )
              }
            !isInitialized || session != null ->
              Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Color(0xFF17352A))
              }
            else ->
              Box(modifier = Modifier.fillMaxSize()) {
                AuthView(
                  modifier = Modifier.fillMaxSize(),
                  clerkTheme =
                    ClerkTheme(colors = ClerkColors(primary = Color(0xFF17352A))),
                  preferGoogleOneTap = true,
                  isDismissible = true,
                  onDismiss = {
                    setResult(Activity.RESULT_CANCELED)
                    finish()
                  },
                  onAuthComplete = { returnSessionToken { message -> error = message } },
                )

                if (error != null) {
                  Text(
                    text = error.orEmpty(),
                    modifier = Modifier.align(Alignment.BottomCenter).padding(20.dp),
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall,
                  )
                }
              }
          }
        }
      }
    }
  }

  private fun returnSessionToken(onError: (String) -> Unit) {
    if (isReturningToken) return
    isReturningToken = true

    lifecycleScope.launch {
      when (val result = Clerk.auth.getToken()) {
        is ClerkResult.Success -> {
          val data = Intent().putExtra(EXTRA_SESSION_TOKEN, result.value)
          setResult(Activity.RESULT_OK, data)
          finish()
        }
        is ClerkResult.Failure -> {
          resetStaleClerkSession(onError)
        }
      }
    }
  }

  private fun resetStaleClerkSession(onReset: (String) -> Unit) {
    resetClerk()
    isReturningToken = false
    onReset("Sua sessao anterior expirou. Entre novamente para continuar.")
  }

  private fun resetClerk() {
    Clerk.reset()
    Clerk.initialize(this, publishableKey = BuildConfig.CLERK_PUBLISHABLE_KEY)
  }

  companion object {
    const val EXTRA_SESSION_TOKEN = "clerk_session_token"
  }
}

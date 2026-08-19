package com.branchcommercehub.app

import android.app.Application
import com.clerk.api.Clerk

class BranchCommerceApplication : Application() {
  override fun onCreate() {
    super.onCreate()
    clearIncompatibleClerkStateOnce()
    Clerk.initialize(this, publishableKey = BuildConfig.CLERK_PUBLISHABLE_KEY)
  }

  private fun clearIncompatibleClerkStateOnce() {
    val migrations = getSharedPreferences(MIGRATIONS_PREFERENCES, MODE_PRIVATE)
    if (migrations.getBoolean(CLERK_NATIVE_API_RESET, false)) return

    // Builds installed before Native API was enabled can retain an invalid Clerk device token.
    val cleared = getSharedPreferences(CLERK_PREFERENCES, MODE_PRIVATE).edit().clear().commit()
    if (cleared) {
      migrations.edit().putBoolean(CLERK_NATIVE_API_RESET, true).commit()
    }
  }

  private companion object {
    const val MIGRATIONS_PREFERENCES = "branch_commerce_mobile_migrations"
    const val CLERK_NATIVE_API_RESET = "clerk_native_api_reset_v1"
    const val CLERK_PREFERENCES = "clerk_preferences"
  }
}

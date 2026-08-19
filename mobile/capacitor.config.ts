import type { CapacitorConfig } from "@capacitor/cli"

const appUrl = process.env.BRANCH_MOBILE_APP_URL ?? "https://branchcommercehub.com/mobile"
const appHost = new URL(appUrl).hostname

const config: CapacitorConfig = {
  appId: "com.branchcommercehub.app",
  appName: "Branch Commerce",
  webDir: "www",
  server: {
    url: appUrl,
    cleartext: appUrl.startsWith("http://"),
    allowNavigation: [appHost, `*.${appHost}`],
  },
  android: {
    allowMixedContent: false,
  },
  ios: {
    contentInset: "automatic",
  },
  plugins: {
    SystemBars: {
      insetsHandling: "css",
      style: "LIGHT",
      hidden: false,
    },
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: "#f6f7f1",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#f6f7f1",
      overlaysWebView: false,
    },
    Keyboard: {
      resize: "body",
      resizeOnFullScreen: true,
    },
  },
}

export default config

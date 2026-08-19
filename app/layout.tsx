import type { Metadata, Viewport } from "next"
import { ClerkProvider } from "@clerk/nextjs"
import { Geist, Geist_Mono, Inter, Sora } from "next/font/google"
import { ConvexClientProvider } from "@/components/providers/convex-client-provider"
import { ThemeProvider } from "@/components/providers/theme-provider"
import "./globals.css"
import { cn } from "@/lib/utils"
import { MobileRuntime } from "@/components/mobile/mobile-runtime"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })
const sora = Sora({ subsets: ["latin"], variable: "--font-mobile-display" })

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: {
    default: "Branch Commerce",
    template: "%s | Branch Commerce",
  },
  description: "Gestão financeira, estoque e operação de e-commerce.",
  applicationName: "Branch Commerce",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Branch Commerce",
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f1" },
    { media: "(prefers-color-scheme: dark)", color: "#182018" },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider>
      <html
        lang="pt-BR"
        suppressHydrationWarning
        className={cn(
          "h-full",
          "antialiased",
          geistSans.variable,
          geistMono.variable,
          "font-sans",
          inter.variable,
          sora.variable,
        )}
      >
        <body className="min-h-full flex flex-col">
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
          >
            <ConvexClientProvider>
              <MobileRuntime />
              {children}
            </ConvexClientProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}

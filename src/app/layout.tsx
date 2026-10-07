import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { AppNav } from "@/components/AppNav";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["500", "600"],
});

export const metadata: Metadata = {
  title: "Ginoo's Log Book",
  description: "An Australian car logbook PWA for the ATO logbook method.",
  applicationName: "Ginoo's Log Book",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    // "default" keeps status-bar text legible in both themes (black-translucent forces white text).
    statusBarStyle: "default",
    title: "Log Book",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "dark light",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#15181b" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
};

/** Root layout: fonts, theme tokens, and the app shell (top nav on desktop, tab bar on phone). */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-bg text-ink font-sans pt-safe md:pt-0">
        <AppNav />
        <div className="flex-1 flex flex-col pb-tabbar md:pb-10">{children}</div>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

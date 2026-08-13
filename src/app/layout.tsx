import type { Metadata, Viewport } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { THEME_BOOT_SCRIPT } from "@/components/theme/ThemeToggle";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
// Terminal / code mono for the whole CRM (the "off the radar" look-and-feel).
const geistMono = JetBrains_Mono({ variable: "--font-geist-mono", subsets: ["latin"], weight: ["400", "500", "700", "800"] });

export const metadata: Metadata = {
  title: "Luxvance CRM",
  description: "Work the reply pipeline, book the call.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Luxvance CRM",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  // Per scheme, so the iOS status bar and the Android chrome match the page instead of
  // staying black behind a white one. The boot script rewrites this tag when the choice
  // is an explicit light/dark rather than "system".
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#0A0D14" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // No `dark` class here any more: the script below decides, before the browser paints.
    // suppressHydrationWarning because that script mutates <html> ahead of React, which is
    // exactly the point — reading the preference in an effect would paint the page dark and
    // then snap it to white on every single load.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} h-screen flex overflow-hidden antialiased bg-background text-foreground font-mono`}>
        <Sidebar />
        <div className="flex-1 flex flex-col h-screen overflow-hidden">
          {/* pb-24 on mobile clears the fixed bottom tab bar so nothing hides behind it */}
          <main className="flex-1 overflow-y-auto bg-background p-4 pb-24 md:p-6 lg:p-8">
            {children}
          </main>
        </div>
        <MobileNav />
      </body>
    </html>
  );
}

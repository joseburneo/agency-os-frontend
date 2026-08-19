import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { THEME_BOOT_SCRIPT } from "@/components/theme/ThemeToggle";

// No web font is loaded, deliberately. luxvance.com sets display, body AND mono to
// 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Monaco, "Cascadia Code",
// "Roboto Mono", monospace' and loads nothing, so on a Mac it renders the real SF
// Mono. Loading JetBrains Mono here is what made the app look like a different
// product: both are monospace, and they look nothing alike side by side.

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
    { media: "(prefers-color-scheme: light)", color: "#F6F4EF" },
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
      <body className={`h-screen flex overflow-hidden antialiased bg-background text-foreground`}>
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

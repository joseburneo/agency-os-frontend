import type { MetadataRoute } from "next";

// PWA manifest so the CRM installs to the phone home screen and runs standalone
// (no browser chrome), feeling like a native app. Start straight on /crm.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Luxvance CRM",
    short_name: "Luxvance",
    description: "Work the reply pipeline, book the call.",
    start_url: "/crm",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0A0E1A",
    theme_color: "#0A0E1A",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

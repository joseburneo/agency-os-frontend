"use client";

import { useEffect } from "react";

// Fire-and-forget open tracking for magnet workspaces. One ping per browser
// session per slug (30-min guard), sent from the client so ISR page caching
// can never swallow it. The API route drops agency visits server-side, so
// Jose reviewing a magnet never counts as the prospect opening it.
export function VisitBeacon({ slug }: { slug: string }) {
  useEffect(() => {
    try {
      const key = `lxv_visit_${slug}`;
      const last = Number(sessionStorage.getItem(key) || 0);
      if (Date.now() - last < 30 * 60 * 1000) return;
      sessionStorage.setItem(key, String(Date.now()));
      const body = JSON.stringify({ slug });
      if (!navigator.sendBeacon?.("/api/magnet/visit", new Blob([body], { type: "application/json" }))) {
        fetch("/api/magnet/visit", { method: "POST", body, keepalive: true }).catch(() => {});
      }
    } catch {
      /* tracking must never break the page */
    }
  }, [slug]);
  return null;
}

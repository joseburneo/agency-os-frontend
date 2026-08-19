"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Fire-and-forget open tracking for magnet workspaces, sent from the client so
// page caching can never swallow it.
//
// It reports WHICH page was opened, not just that something was, because "did
// they reach the leads" is the question a bare counter could never answer. And it
// forwards the two things that let the server attribute the visit: the token from
// the delivered link (?v=) and our own preview flag (?preview=1). Without those,
// a visit from the prospect's inbox and a visit from our phone look identical,
// which is how the CRM ended up reporting our own checks as prospect opens.
export function VisitBeacon({ slug }: { slug: string }) {
  const pathname = usePathname();
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("v") || "";
      const preview = params.get("preview") === "1";

      // One ping per page per browser session (30-minute guard). Keyed on the
      // path too: a prospect moving through four tabs is four data points about
      // how far they got, not three duplicates to suppress.
      const key = `lxv_visit_${slug}_${pathname}`;
      const last = Number(sessionStorage.getItem(key) || 0);
      if (Date.now() - last < 30 * 60 * 1000) return;
      sessionStorage.setItem(key, String(Date.now()));

      // Coarse, non-identifying: separates one person reading six tabs from six
      // people reading one, and stores nothing about who they are.
      let visitKey = sessionStorage.getItem("lxv_visit_key");
      if (!visitKey) {
        visitKey = Math.random().toString(36).slice(2, 12);
        sessionStorage.setItem("lxv_visit_key", visitKey);
      }

      const body = JSON.stringify({ slug, path: pathname, token, preview, visitKey });
      if (!navigator.sendBeacon?.("/api/magnet/visit", new Blob([body], { type: "application/json" }))) {
        fetch("/api/magnet/visit", { method: "POST", body, keepalive: true }).catch(() => {});
      }
    } catch {
      /* tracking must never break the page */
    }
  }, [slug, pathname]);
  return null;
}

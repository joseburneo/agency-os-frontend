"use client";

import { useState } from "react";

// Company favicon with a monogram fallback — never ships a broken image.
// This is the ONLY portal primitive that needs client state (the <img> onError
// fallback), so it lives in its own "use client" module. Everything else in
// ui.tsx stays server-safe so server components can import values from it.
// Google's favicon cache for luxvance.com is a 16px mark pasted un-scaled onto a
// white 64px canvas (a white square in practice), and their refresh cadence is not
// ours to control — the agency's own mark ships as a local asset instead.
const LOCAL_MARKS: Record<string, string> = {
  "luxvance.com": "/icon-192.png",
};

export function CompanyMark({ name, domain, size = 22 }: { name: string; domain?: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const mono = (name?.trim()?.[0] || "?").toUpperCase();
  const local = domain ? LOCAL_MARKS[domain.toLowerCase()] : undefined;
  const show = domain && !failed;
  return (
    <span
      className="inline-grid place-items-center rounded-md shrink-0 overflow-hidden bg-white/10 text-[10px] font-bold text-foreground"
      style={{ width: size, height: size }}
    >
      {show ? (
        <img
          src={local ?? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain!)}&sz=64`}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          onError={() => setFailed(true)}
          style={{ width: size, height: size, borderRadius: 6, background: local ? "transparent" : "#fff" }}
        />
      ) : (
        mono
      )}
    </span>
  );
}

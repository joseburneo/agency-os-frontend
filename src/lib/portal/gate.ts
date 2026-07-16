// Multi-scope access gate. Edge-safe (proxy) AND node-safe (route handler):
// only TextEncoder / crypto.subtle / btoa, no Node APIs.
//
// Two tiers:
//   • AGENCY — one key (PORTAL_AGENCY_PASSWORD) opens the agency view and, by
//     design, every workspace. This is Jose's own key.
//   • CLIENT — each workspace has its own key (PORTAL_WS_KEYS, "slug:key,slug:key")
//     that opens ONLY that /w/<slug> portal. Paul's Arco key never touches
//     Luxvance or the agency view.
//
// Cookies never store a raw password. They store an HMAC(secret, scope) token so
// a value unlocked for one scope can't be replayed against another.

export const AGENCY_COOKIE = "lxv_agency";
export const wsCookie = (slug: string) => `lxv_ws_${slug}`;
// Demo (prospect preview): unlocked by a signed link, not a password.
export const demoCookie = (slug: string) => `lxv_demo_${slug}`;

// HMAC-SHA256(secret, scope) → compact base64. Same input → same token, so the
// route (setting the cookie) and the proxy (checking it) agree without a DB.
export async function scopeToken(secret: string, scope: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(scope));
  let s = "";
  for (const b of new Uint8Array(sig)) s += String.fromCharCode(b);
  return btoa(s).replace(/[^a-zA-Z0-9]/g, "");
}

// Demo access token — carried in the magnet link (?k=<token>). Signed like the
// cookie tokens so we validate it statelessly, no per-link storage. The token
// never expires by design; urgency lives in the copy, not the link.
export function demoToken(secret: string, slug: string): Promise<string> {
  return scopeToken(secret, `demo:${slug}`);
}

// "arco-irish:arco-irish-2026,luxvance:luxvance-2026" → { "arco-irish": "arco-irish-2026", … }
export function parseWsKeys(raw: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw) return out;
  for (const pair of raw.split(",")) {
    const i = pair.indexOf(":");
    if (i < 0) continue;
    const slug = pair.slice(0, i).trim();
    const key = pair.slice(i + 1).trim();
    if (slug && key) out[slug] = key;
  }
  return out;
}

// Which scope a path requires. /w/<slug>/... → that workspace; everything else
// (the matcher already excludes /gate, /api, static) → the agency scope.
export function requiredScope(pathname: string): { kind: "agency" } | { kind: "ws"; slug: string } {
  const m = pathname.match(/^\/w\/([^/]+)/);
  if (m) return { kind: "ws", slug: m[1] };
  return { kind: "agency" };
}

// "arco-irish" → "Arco Irish" for the gate heading.
export function prettySlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

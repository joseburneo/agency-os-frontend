import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AGENCY_COOKIE, wsCookie, demoCookie } from "@/lib/portal/gate";

// Sign out. Clears the portal cookies relevant to the current scope, then sends
// the visitor back to the right gate. Agency logout clears the agency cookie;
// a client logout clears that workspace's cookie (and any demo cookie for it).
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const scope = String(form.get("scope") ?? "agency");

  const dest =
    scope === "agency"
      ? "/gate?scope=agency"
      : `/gate?scope=${encodeURIComponent(scope)}&next=${encodeURIComponent(`/w/${scope}/dashboard`)}`;

  const res = NextResponse.redirect(new URL(dest, request.url), { status: 303 });
  res.cookies.delete(AGENCY_COOKIE);
  if (scope !== "agency") {
    res.cookies.delete(wsCookie(scope));
    res.cookies.delete(demoCookie(scope));
  }
  return res;
}

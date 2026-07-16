import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { AGENCY_COOKIE, scopeToken, demoToken } from "@/lib/portal/gate";

// Agency-only helper to mint a prospect demo link:
//   GET /api/demo-link?slug=arco-irish
//   -> { slug, url: "https://app.luxvance.com/w/arco-irish?k=<token>" }
// Jose hits this while unlocked as agency; the signed ?k= token opens the lite
// preview with no password. /api is outside the proxy matcher, so we check the
// agency cookie here ourselves.
export async function GET(req: NextRequest) {
  const secret = process.env.PORTAL_ACCESS_TOKEN;
  if (!secret) return NextResponse.json({ error: "gate disabled (no PORTAL_ACCESS_TOKEN)" }, { status: 400 });

  const slug = new URL(req.url).searchParams.get("slug")?.trim();
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  const jar = await cookies();
  if (jar.get(AGENCY_COOKIE)?.value !== (await scopeToken(secret, "agency"))) {
    return NextResponse.json({ error: "agency access required" }, { status: 401 });
  }

  const token = await demoToken(secret, slug);
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://app.luxvance.com";
  return NextResponse.json({ slug, url: `${base}/w/${slug}?k=${token}` });
}

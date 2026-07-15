# Deploy — Luxvance Platform (agy-lxv-frontend)

The multi-tenant client portal. Agency view at `/`, client view at `/w/<slug>`
(e.g. `/w/arco-irish`). Data comes live from Supabase (project
`sgaeggmkmipcoikzqwpy`), scoped by `workspace_id`, service key server-only.
The whole deploy sits behind a shared-password gate (`proxy.ts`) until
per-workspace login lands.

- **Vercel project:** `agy-lxv-frontend` (`prj_wop4fddo6RFlUX5SmUERVW99Hev5`)
- **Current URL:** https://agy-lxv-frontend.vercel.app
- **Target custom domain:** `app.luxvance.com`

---

## 1. Set the four env vars (once, all environments)

Run from this directory. `vercel env add` prompts for the value and the
environments — choose **Production, Preview, Development** for all four.

```bash
cd /Users/joseburneo/Luxvance_OS/code/agency-os-frontend

# Public — Supabase URL
printf 'https://sgaeggmkmipcoikzqwpy.supabase.co' | vercel env add NEXT_PUBLIC_SUPABASE_URL production preview development

# SECRET — service-role key (from credentials/master.env → SUPABASE_SERVICE_KEY)
# Paste the key when prompted:
vercel env add SUPABASE_SERVICE_KEY production preview development

# Gate — the access key Paul types at /gate. Pick something memorable, e.g.:
printf 'arco-irish-2026' | vercel env add PORTAL_PASSWORD production preview development

# Gate — server secret cookie value (a fresh one is generated below)
printf 'tok_C-4wObkup9pUekg_Aak3DAnNL6O6_aORrmaMP1gebPeGK6Sj' | vercel env add PORTAL_ACCESS_TOKEN production preview development
```

> Regenerate the access token anytime with:
> `python3 -c "import secrets; print('tok_'+secrets.token_urlsafe(36))"`
> (PORTAL_ACCESS_TOKEN is NOT the password — it's the cookie secret. Never share it.)

Verify:
```bash
vercel env ls
```

---

## 2. Deploy to production

```bash
cd /Users/joseburneo/Luxvance_OS/code/agency-os-frontend
vercel --prod
```

Smoke test the deploy (replace with the printed URL):
```bash
BASE=https://agy-lxv-frontend.vercel.app
# 1) gate redirects when not authed
curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}\n" "$BASE/w/arco-irish/dashboard"   # expect 307 -> /gate
# 2) log in
curl -s -o /dev/null -c /tmp/c.txt -w "%{http_code} -> %{redirect_url}\n" -X POST "$BASE/api/gate" -F password=arco-irish-2026 -F next=/w/arco-irish/dashboard
# 3) authed dashboard shows live lead count
curl -s -b /tmp/c.txt "$BASE/w/arco-irish/dashboard" | grep -oE 'Cold leads live|1,1[0-9][0-9]' | head
```

---

## 3. Custom domain `app.luxvance.com`

1. In Vercel → project `agy-lxv-frontend` → Settings → Domains → add
   `app.luxvance.com`.
2. Vercel shows a CNAME target (`cname.vercel-dns.com`). In **Cloudflare**
   (luxvance.com DNS), add:
   - Type `CNAME`, Name `app`, Target `cname.vercel-dns.com`, **Proxy: DNS only**
     (grey cloud — Vercel handles TLS; orange-cloud proxy breaks it).
3. Wait for Vercel to verify + issue the cert, then:
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" https://app.luxvance.com/gate   # expect 200
   ```

---

## 4. Hand Paul the link

Once the domain is live, Paul's workspace is:

> **https://app.luxvance.com/w/arco-irish** — access key: `arco-irish-2026`

He lands on the gate, enters the key once (cookie lasts 30 days), and sees his
1,113 cold leads, the Draft/Preview email flow, and the empty-but-honest
Email / LinkedIn / WhatsApp / Content / CRM / Library modules that fill in as
the campaign runs.

---

## Notes

- **Gate off locally / on preview:** if `PORTAL_ACCESS_TOKEN` is unset, the gate
  is disabled (open). This keeps local `next dev` unlocked. Set all four vars in
  Vercel for the gate to engage.
- **Mock fallback:** any module with no live source yet renders an empty state,
  not fake data, as long as the Supabase vars are set. Without them, the whole
  portal falls back to the mock fixture (dev only).
- **Env reference:** see `.env.example`.

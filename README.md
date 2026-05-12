# remnawave-ldc-shop

> **A fork of [chatgptuk/ldc-shop](https://github.com/chatgptuk/ldc-shop) (MIT).**
> Repurposed as the web payment surface for a Remnawave VPN subscription
> platform. Replaces card-key fulfilment with Remnawave API calls; everything
> else (linux.do OIDC login, EasyPay / LDC payment, Next.js + Cloudflare
> Workers + D1 stack) is inherited from upstream.
>
> Attribution, fork purpose, and full divergence checklist:
> [`ATTRIBUTION.md`](./ATTRIBUTION.md). License: [`LICENSE`](./LICENSE) (MIT).

---

## Implementation status (fork-specific)

This fork is built in slices defined by the parent task `web-payment-ui-ldc-integration`.

| Slice | Status | Description |
|-------|--------|-------------|
| 2a | ✅ done | Fork bootstrap (LICENSE, ATTRIBUTION, README, remotes, upstream-sync workflow removed) |
| 2b | ⏳ pending | Strip upstream features we don't use (coupons, checkin, admin, multi-product list, SKU multi-spec) |
| 2c | ⏳ pending | Add single product "Remnawave Subscription" + custom detail-page form |
| 2d | ⏳ pending | TS port of pro-rate + tier math (fixture-locked against bot's Go tests) |
| 2e | ⏳ pending | TS Remnawave API client (CreateOrUpdateUser subset) |
| 2f | ⏳ pending | D1 schema: orders.tier/months/monthly_ldc, users.telegram_id |
| 2g | ⏳ pending | Patch `processOrderFulfillment` to provision Remnawave |
| 2h | ⏳ pending | Wrangler config + OIDC + LDC merchant secrets |
| 2i | ⏳ pending | Cloudflare Workers + D1 + custom domain deploy |

---

## Quick orientation (fork-specific)

- **Active workspace**: [`_workers_next/`](./_workers_next/) — Next.js 16 App Router app targeting Cloudflare Workers via OpenNext, backed by D1. This is what we deploy.
- **Other directories** (inherited from upstream, **not currently used** by the fork):
  - [`_docker/`](./_docker/) — upstream's Docker / VPS / SQLite mirror. Kept for reference; not part of our deploy path.
  - Root-level Next.js code (`src/`, `lib/`, `package.json`, `Dockerfile`, `vercel.json`, ...) — upstream's abandoned Vercel/Postgres build. Marked unmaintained by upstream. Not used by the fork.
- **Upstream sync workflow removed**: the upstream `.github/workflows/sync.yml` did a daily `git reset --hard upstream/main` and force-push — which would clobber all fork changes. Removed in the bootstrap commit. Pull upstream patches manually with `git fetch upstream && git merge upstream/main` (or rebase) when wanted.

---

## (from upstream) Tech stack snapshot

- Next.js 16 (App Router), TypeScript, Tailwind v4
- Cloudflare Workers (via OpenNext adapter) + D1 (SQLite at the edge)
- Drizzle ORM
- NextAuth v5-beta with `linuxdo` OIDC provider (against `connect.linux.do`)
- EasyPay (彩虹易支付) merchant client targeting `credit.linux.do`

For the full upstream feature list (including the parts we'll strip in slice
2b) see the upstream Workers README: [`_workers_next/README.md`](./_workers_next/README.md).

---

## (from upstream) Deploy guide

The deploy guide referenced for the Workers + D1 path lives at
[`_workers_next/README.md`](./_workers_next/README.md). Our fork-specific
deploy doc (wrangler vars, OIDC client registration, LDC merchant config)
will land in slice 2h.

> ⚠️ **`NEXT_PUBLIC_APP_URL` must be set as a Text variable, not a Secret**
> (upstream README repeats this twice). Cloudflare Secret values break the
> exact-byte matching used in the EasyPay MD5 sign computation.
>
> ⚠️ The fork **must** be deployed on a custom domain (or at minimum a
> `.workers.dev` URL set in `NEXT_PUBLIC_APP_URL`). Shared/free domains may
> be blocked by EasyPay / firewalls, breaking webhook delivery.

---

## (fork-specific) Architecture notes

- Bot and ldc-shop share the same LDC `MERCHANT_ID` / `MERCHANT_KEY`
  (decision M1 in the parent PRD). Per-order `notify_url` discriminates the
  webhook destination — bot orders route back to the bot's `/ldc/notify`,
  web orders route back to ldc-shop's `/api/notify`.
- Order ids are naturally namespaced (bot = int64 purchase id; ldc-shop =
  `ORD<base36>`), so no collision is possible at the merchant level.
- Two parallel `Customer` pools (bot's Postgres `customers` is TG-keyed;
  this fork's D1 `users` is linux.do-keyed). A user who pays via both
  surfaces ends up with two separate Remnawave accounts — accepted as a
  temporary v1 limitation, will require user-initiated identity binding to
  unify.
- Pro-rate + tier compute parity with the bot is enforced via JSON fixtures
  exported by the bot's Go test suite and consumed by this fork's TS test
  suite (slice 2d).

---

## (from upstream) License

MIT. See [`LICENSE`](./LICENSE).

# Deployed instance — Remnawave LDC Shop (Slice 2i, 2026-05-13)

Operator runbook for the live x-socks deploy of this fork. Captured at end of slice 2i so a future operator can recover state without re-discovering it. **No secrets in this file.**

## Live URLs

| Surface | URL |
|---|---|
| Worker (custom domain) | `https://ldc.irin.eu.org` |
| Worker (workers.dev fallback) | `https://ldc-shop-next.xsocks.workers.dev` |
| LDC payment cashier | `https://credit.linux.do/epay/pay/submit.php` |
| OIDC issuer | `https://connect.linux.do` |
| Remnawave panel | `https://c.node.us.kg` |

## Cloudflare Workers

- Account: x-socks (auth via `wrangler login`)
- Worker name: `ldc-shop-next`
- Custom domain: `ldc.irin.eu.org` (bound via Workers & Pages → Settings → Domains & Routes)
- Compatibility date: `2025-11-12` with `nodejs_compat` flag
- Cron trigger: `* * * * *` (cleanup only — see `src/app/api/internal/cron/cleanup/route.ts`; no LDC outbound polling)
- Observability: enabled

## D1 database

- Binding: `DB`
- Name: `ldc-shop-next`
- ID: `1a34eb42-98d7-4f42-8ae1-293fc9fc7a59`
- Migrations dir: `src/lib/db/migrations` (drizzle-managed)
- Migrations applied at deploy: `0000_overrated_speedball`, `0001_add_product_type_remnawave_order_metadata`, `0002_fearless_victor_mancha`
- Runtime schema reconcile: `src/lib/db/queries.ts ensureDatabaseInitialized()` (called on every API path) adds missing columns at first DB access — required because drizzle migrations are not in lock-step with `schema.ts`

## Seed

The "Remnawave Subscription" product seed (`src/lib/db/seeds/0001_remnawave_subscription.sql`) is **not auto-applied** by wrangler. After every fresh D1 create, the operator must run:

```bash
wrangler d1 execute ldc-shop-next --remote --file src/lib/db/seeds/0001_remnawave_subscription.sql
```

It uses `INSERT OR IGNORE`, so re-running is safe.

## linux.do OIDC client

- Public client ID: `0qSoucMdQwlNlPvtKVsJeIleelnh2vhq`
- Registered redirect URI: `https://ldc.irin.eu.org/api/auth/callback/linuxdo` (NextAuth callback path — **NOT** `/callback`, which is the LDC payment return URL)
- Scopes: `openid profile email`
- Issuer: `https://connect.linux.do`
- Client secret stored in: `wrangler secret put OAUTH_CLIENT_SECRET` (never committed)

**Pitfall captured during slice 2i**: confusing the OIDC redirect_uri (`/api/auth/callback/linuxdo`) with the LDC payment return URL (`/callback`) leaves OAuth flow with the auth code landing at the wrong route — login completes upstream but never establishes a NextAuth session. Symptom: tail log shows `GET /callback?code=REDACTED` instead of `GET /api/auth/callback/linuxdo?code=REDACTED`.

## LDC merchant (M1: shared with the Telegram bot)

- Merchant ID (public, signing identifier): `ff9d9400b0c6cad497b7b0e0a2324d3c19d4eef13a88131a4b3e78396b461d2d`
- Merchant secret stored in: `wrangler secret put MERCHANT_KEY` (= bot's `LDC_CLIENT_SECRET`, never committed)
- `notify_url`: `https://ldc.irin.eu.org/api/notify`
- `return_url`: `https://ldc.irin.eu.org/callback`
- Test mode: `true` at slice 2i sign-off (flip to `false` before public launch)

The bot's own `notify_url` (existing `/ldc/notify` on the bot host) keeps its existing entry in the same merchant; LDC supports multiple callback URLs per merchant app, so per-order `notify_url` discriminates bot vs web fork (M1 strategy decided in slice 2a).

## Remnawave provisioning

- Panel base URL: `https://c.node.us.kg`
- API token stored in: `wrangler secret put REMNAWAVE_TOKEN` (never committed)
- External squad UUID: empty (`""` — bot's `.env.sample` line 46 leaves this empty too; `client.ts:103 optionalUuid()` accepts empty)
- Per-tier squad UUIDs:

  | Tier | UUID |
  |---|---|
  | LV0 | `080ede28-243f-4546-807e-1b83841e4b4f` |
  | LV1 | `e696935b-daad-4967-bb2d-2efb31189986` |
  | LV2 | `26aa912f-cb61-4b2b-9de5-db35b734b69f` |

- Tier promotion thresholds: `TIER1_THRESHOLD=1000` (≥1000 monthly_ldc → LV1), `TIER2_THRESHOLD=2000` (≥2000 → LV2)
- External identity scheme: `linuxdo_<sub>` (immutable OIDC `sub`); the linux.do username gets denormalised onto the user row but is not the PK

## Secrets summary

All stored via `wrangler secret put`, none in git:

- `MERCHANT_KEY` — LDC merchant signing secret
- `REMNAWAVE_TOKEN` — Remnawave admin API token
- `OAUTH_CLIENT_SECRET` — linux.do OIDC client secret
- `AUTH_SECRET` — NextAuth session encryption (32-byte random)

## End-to-end test (slice 2i sign-off)

Test order `ORDMP4384HI3JGZQ0`:

- Product: Remnawave Subscription
- Selection: LV0, 1 month, monthly_ldc=5
- LDC `trade_no`: `59270767652634624`
- Status: `delivered` (paid 1778678460848 → delivered 1778678462881 = 2-second turnaround)
- Subscription URL: `https://sub.node.us.kg/sub/ScKYdZujmf7Tvnyd`
- Remnawave panel: user created with `externalId=linuxdo_<sub>` and `expireAt=1781270462708` (+30 days)
- Test_mode: `true` (no real LDC moved between accounts)

## Bug fixed during slice 2i (regression-prevention note)

`src/lib/remnawave/fulfillment.ts markOrderPaidIfPending` originally wrapped its UPDATE+RETURNING CAS in `BEGIN IMMEDIATE` / `COMMIT` / `ROLLBACK`. Cloudflare D1 rejects raw SQL transactions:

> `D1_ERROR: To execute a transaction, please use the state.storage.transaction() or state.storage.transactionSync() APIs instead of the SQL BEGIN TRANSACTION or SAVEPOINT statements.`

Fix (commit `ec4ec30`): a single `UPDATE ... WHERE status IN (...) ... RETURNING` is already atomic on D1; the wrapper is redundant and broken. The fulfillment test mocks `markOrderPaidIfPending` with a `vi.fn`, so the real Drizzle path was never exercised in CI — which is exactly why the bug shipped to prod.

**Pattern**: when porting Postgres `BEGIN ... COMMIT` patterns to D1, look for the underlying atomicity invariant rather than copying the wrapper. Single statement = single unit of atomicity in SQLite-on-Durable-Object. For multi-statement work, use `db.batch()` or Drizzle's `db.transaction()` (which translates to `db.batch()` under D1).

## Recovery steps if D1 is wiped or Worker re-bound

1. `wrangler d1 create ldc-shop-next` (capture new database_id, patch `wrangler.jsonc` locally)
2. `wrangler d1 migrations apply ldc-shop-next --remote`
3. `wrangler deploy` to give the schema-reconcile path a Worker to run in
4. Hit `https://ldc.irin.eu.org/` once to trigger `ensureDatabaseInitialized()` (adds drift columns)
5. `wrangler d1 execute ldc-shop-next --remote --file src/lib/db/seeds/0001_remnawave_subscription.sql`
6. Re-set all 4 secrets via `wrangler secret put` (values stay in operator's notes / 1Password — never in git)

## Local-only wrangler.jsonc

Per slice 2i decision A2, `_workers_next/wrangler.jsonc` is kept with **placeholder values** in the committed copy and **real values** in the local working tree (`git status` shows `M wrangler.jsonc` persistently). This protects the operator's panel URL + merchant ID + squad UUIDs from leaking into the public fork. Anyone cloning the fork must re-populate per this runbook before deploying.

## Slice 2j additions (2026-05-13)

New server-side `wrangler.jsonc` vars (no `NEXT_PUBLIC_` prefix — read by the BuyPage server component + `createRemnawavePaymentOrder` action and passed to the form as props):

| Name | Sample | Purpose |
|---|---|---|
| `LDC_MIN_MONTHLY` | `100` | Lower bound for the buy-form's monthly LDC stepper. |
| `LDC_MAX_MONTHLY` | `10000` | Upper bound for the buy-form's monthly LDC stepper. |
| `LDC_DEFAULT_MONTHLY` | `100` | Default value on first render. |

Behaviour changes the operator should know about:

- `src/lib/remnawave-subscription.ts` no longer exports `TIER_RATES`. The fork is now bot-parity: the buy form takes a free `monthly_ldc` integer input (clamped to the bounds above) and the tier (LV0/LV1/LV2) is derived from `monthly_ldc` against `TIER1_THRESHOLD` / `TIER2_THRESHOLD`. Server re-derives the tier from `monthly_ldc` on submit; any tier value posted by the client is ignored.
- Homepage / search product cards for `type='remnawave_subscription'` no longer show "out of stock" or a numeric price; they render an "Unlimited" badge and skip the stock indicator (this product is `is_shared=1` and stock_count is intentionally `NULL`).
- Per A2 strategy the committed `wrangler.jsonc` carries `PLACEHOLDER_REPLACE_ME` for the three new vars; replace them locally before `pnpm run deploy`. Defaults baked into the code (100 / 10000 / 100) match the bot's `.env.sample`, so an empty/placeholder value falls back to the bot defaults without breaking the form.

---

Captured at slice 2i sign-off, 2026-05-13.

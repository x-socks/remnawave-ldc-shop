# Secrets and Bindings

This fork keeps non-secret configuration in `wrangler.jsonc` and stores sensitive values with `wrangler secret put`. Never commit real merchant keys, Remnawave tokens, OAuth client secrets, or auth secrets.

| Name | Type | Where to obtain | Sample value | Slice introduced |
|---|---|---|---|---|
| `NEXT_PUBLIC_APP_URL` | var | Final Worker or custom-domain URL in Cloudflare. Must be a plain var because upstream payment signing reads it from text env. | `https://shop.example.com` | 2h |
| `MERCHANT_ID` | var | Linux DO Credit merchant dashboard after registering the shared merchant app. | `PLACEHOLDER_REPLACE_ME` | 2h |
| `REMNAWAVE_BASE_URL` | var | Remnawave panel base URL from the panel operator. | `https://remnawave.example.com` | 2h |
| `EXTERNAL_SQUAD_UUID` | var | Remnawave external squad UUID for provisioned web users. | `PLACEHOLDER_REPLACE_ME` | 2h |
| `TIER1_THRESHOLD` | var | Bot tier configuration; keep aligned with fixture semantics. | `PLACEHOLDER_REPLACE_ME` | 2h |
| `TIER2_THRESHOLD` | var | Bot tier configuration; keep aligned with fixture semantics. | `PLACEHOLDER_REPLACE_ME` | 2h |
| `OIDC_ISSUER_URL` | var | linux.do OIDC issuer. | `https://connect.linux.do` | 2h |
| `OAUTH_CLIENT_ID` | var | linux.do OAuth client dashboard at `https://connect.linux.do/dash/sso`. | `PLACEHOLDER_REPLACE_ME` | 2h |
| `MERCHANT_KEY` | secret | Linux DO Credit merchant dashboard; this is the merchant API secret/key. | `PLACEHOLDER_REPLACE_ME` | 2h |
| `REMNAWAVE_TOKEN` | secret | Remnawave API token created for this web fork. Prefer a token scoped to the required user operations only. | `PLACEHOLDER_REPLACE_ME` | 2h |
| `OAUTH_CLIENT_SECRET` | secret | linux.do OAuth client dashboard. Copy it immediately when created; it is shown once. | `PLACEHOLDER_REPLACE_ME` | 2h |
| `AUTH_SECRET` | secret | Locally generated random string for NextAuth/Auth.js session encryption. Upstream already documented this secret. | `openssl rand -base64 32` | upstream, documented in 2h |
| `DB` | binding | Cloudflare D1 database created or reused for this Worker. | `ldc-shop-next` | upstream, extended in 2h |

## First-time setup

Run these from `_workers_next` after installing dependencies and authenticating Wrangler. Do not run them in CI with real values printed to logs.

1. `wrangler d1 create ldc-shop-next`
   Create the D1 database if you are not reusing the upstream `ldc-shop-next` DB. Copy the returned `database_id` into the `DB` binding in `wrangler.jsonc`.

2. `wrangler secret put MERCHANT_KEY`
   Paste the Linux DO Credit merchant key from `https://credit.linux.do`.

3. `wrangler secret put REMNAWAVE_TOKEN`
   Paste the Remnawave API token for this fork.

4. `wrangler secret put OAUTH_CLIENT_SECRET`
   Paste the linux.do OAuth client secret from `https://connect.linux.do/dash/sso` immediately after client creation.

5. `wrangler secret put AUTH_SECRET`
   Paste a newly generated random value, for example from `openssl rand -base64 32`.

After secrets are stored, replace every `PLACEHOLDER_REPLACE_ME` var in `wrangler.jsonc` before deploying.

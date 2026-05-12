# Linux DO Credit Merchant Setup

The MVP uses the M1 merchant strategy: the Telegram bot and this web fork share one `MERCHANT_ID` and `MERCHANT_KEY`. Each order still selects its own handler because the order creation request sends a per-order `notify_url`: bot orders point to the bot webhook, and web orders point to this fork's `/api/notify` route.

## Setup

1. For a fresh setup, register a merchant at `https://credit.linux.do`.
2. Fill the merchant name and description for the Remnawave subscription shop.
3. Add callback hosts for both surfaces:
   - Web fork notify URL: `<NEXT_PUBLIC_APP_URL>/api/notify`
   - Web fork return URL: `<NEXT_PUBLIC_APP_URL>/callback`
   - Bot notify URL: the existing bot `/ldc/notify` HTTPS endpoint
4. Copy `MERCHANT_ID` into `wrangler.jsonc` under `vars`.
5. Store `MERCHANT_KEY` with `wrangler secret put MERCHANT_KEY`.
6. In the LDC dashboard, open the merchant app/API key settings and use the expected **Merchant** -> **API Keys** -> app edit page to toggle `test_mode` for a first payment test. Only the merchant account can pay test-mode orders.

Bot-side runbook: `/Users/oydodo/Documents/research/remnawave/.trellis/tasks/archive/2026-05/05-09-remnawave-telegram-ldc/` has no `runbook.md` at the time of this slice, so the bot-side operational runbook link is TBD.

Out of scope: LDC merchant APIs never expose payer identity to merchant credentials or webhooks, so this fork must rely on its own linux.do OIDC session for web buyer identity. See [`ldc-payer-field.md`](../../../remnawave/.trellis/tasks/archive/2026-05/05-10-username-normalize/research/ldc-payer-field.md).

# Attribution

This repository is a fork of [chatgptuk/ldc-shop](https://github.com/chatgptuk/ldc-shop).

## Source

- **Upstream**: https://github.com/chatgptuk/ldc-shop
- **Forked at commit**: `143773d188c19e92b009332f1d5b0f6a54cef88c` (Release v1.4.1)
- **Forked on**: 2026-05-11

## License

The upstream project declares **MIT** in its `README.md` but ships no `LICENSE`
file. We added an explicit `LICENSE` file at the fork root based on that
declaration, with copyright attributed to both the upstream author
(`chatgptuk`, 2024) and the fork (`x-socks`, 2026). The full MIT text is in
[`LICENSE`](./LICENSE).

## Fork purpose

Adapted as the **web payment surface for a Remnawave VPN subscription
platform**. Replaces card-key product fulfilment with Remnawave API calls.

Paired with the Telegram bot at https://github.com/x-socks/remnawave-ldcstore-bot
(repo visibility / public link TBD). The bot continues to act as the Telegram
entry surface; this fork becomes the web entry surface. Both share the same
Remnawave panel.

See the parent task PRD for the full architecture decision record:
`.trellis/tasks/05-11-web-payment-ui-ldc-integration/prd.md` (in the bot
repo).

## Tracking upstream

A copy of the upstream Git history is preserved in this repo. The upstream
remote is configured as `upstream`, the fork's own remote as `origin`:

```bash
git remote -v
# origin    git@github.com:x-socks/remnawave-ldc-shop.git  (fork)
# upstream  https://github.com/chatgptuk/ldc-shop.git      (source)
```

To pull upstream patches:

```bash
git fetch upstream
git merge upstream/main   # or rebase, depending on workflow preference
```

The upstream `.github/workflows/sync.yml` (a daily `git reset --hard
upstream/main` force-push job) has been **removed** in the bootstrap commit
because it would clobber fork-specific changes. Re-apply manually and
selectively when a sync is wanted.

## Divergence from upstream

This list is **forward-looking** — entries will be checked off as future
slices land. Source of truth for plan: parent task PRD slices 2a–2i.

- [x] **(Slice 2a) Bootstrap**: LICENSE, ATTRIBUTION.md, README rewrite, remote reconfigure, upstream-sync workflow removed
- [ ] **(Slice 2b) Strip**: hide/remove coupons, checkin/points, admin panel, multi-product list, SKU multi-spec
- [ ] **(Slice 2c) Add**: single product "Remnawave Subscription" + custom detail-page form (tier dropdown + months 1–12 + computed price)
- [ ] **(Slice 2d) TS port**: pro-rate + tier math, with fixture-driven tests consuming JSON from the bot repo
- [ ] **(Slice 2e) TS Remnawave client**: `CreateOrUpdateUser` subset; externalId scheme `linuxdo_<sub>`
- [ ] **(Slice 2f) Schema**: add `orders.tier`, `orders.months`, `orders.monthly_ldc`; add `users.telegram_id` (nullable, for future v2 unification)
- [ ] **(Slice 2g) Fulfilment patch**: `processOrderFulfillment` → lookup prior paid orders for same linuxdo_id → pro-rate → tier → Remnawave call → persist sub URL
- [ ] **(Slice 2h) Wrangler + secrets**: linux.do OIDC client registration, LDC merchant config (shared MERCHANT_ID with bot, per-order `notify_url` discriminates destination)
- [ ] **(Slice 2i) Deploy**: CF Workers + D1 + custom domain; e2e test_mode integration (pay 0.01 LDC → Remnawave user created → sub URL renders)

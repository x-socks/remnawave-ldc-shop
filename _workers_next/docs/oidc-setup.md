# linux.do OIDC Setup

The fork uses the existing NextAuth/Auth.js route at `/api/auth/[...nextauth]` with provider id `linuxdo`, so the linux.do callback path is:

```text
<NEXT_PUBLIC_APP_URL>/api/auth/callback/linuxdo
```

Operator steps:

1. Log in at `https://connect.linux.do` with the linux.do account that will own the OAuth client.
2. Navigate to `https://connect.linux.do/dash/sso` in the same browser session.
3. Click **Create OAuth Client**.
4. Fill the client fields:
   - Name: `remnawave-ldc-shop`
   - Redirect URI: `<NEXT_PUBLIC_APP_URL>/api/auth/callback/linuxdo`
   - Scopes: `openid profile email`
5. Copy `client_id` and `client_secret` immediately. The secret is expected to be a one-time view.
6. Put `client_id` in `wrangler.jsonc` as `OIDC_CLIENT_ID`.
7. Store `client_secret` with `wrangler secret put OIDC_CLIENT_SECRET`.

Reference: [`linuxdo-oauth.md`](../../../remnawave/.trellis/tasks/05-11-web-payment-ui-ldc-integration/research/linuxdo-oauth.md).

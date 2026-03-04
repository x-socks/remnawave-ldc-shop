# LDC Shop (Cloudflare Workers Edition)

[中文说明](./README.md)

---


Serverless virtual goods store built with **Next.js 16**, **Cloudflare Workers** (OpenNext), **D1 Database**, and **Shadcn UI**.

## 🛠 Technical Architecture

This version adopts the cutting-edge **Next.js on Workers** approach, rather than a traditional single-file Worker:

*   **Core Framework**: **Next.js 16 (App Router)** - Maintains the same modern development experience as the Vercel version.
*   **Adapter**: **OpenNext (Cloudflare Adapter)** - The most advanced solution for deployed Next.js on Workers, supporting most Next.js features.
*   **Database**: **Cloudflare D1 (SQLite)** - Edge-native relational database, replacing Vercel Postgres.
*   **ORM**: **Drizzle ORM** - Perfectly adapted for D1, providing type-safe SQL operations.
*   **Deployment**: **Wrangler** - One-click deployment to the global edge network.

This architecture aims to combine the development efficiency of Next.js with the edge performance and low cost advantages of Cloudflare.



## ✨ Features

- **Modern Stack**: Next.js 15 (App Router), Tailwind CSS, TypeScript.
- **Edge Native**: Cloudflare Workers + D1 Database, low cost and high performance.
- **Linux DO Integration**: Built-in OIDC login and EasyPay payments.
- **Storefront Experience**:
    - 🔍 **Search & Categories**: Client-side search and category filters.
    - 📢 **Announcement Banner**: Configurable homepage announcements.
    - 📝 **Markdown Descriptions**: Rich product descriptions.
    - ⚠️ **Purchase Warning**: Optional pre-purchase warning modal.
    - 🔥 **Hot & Discounts**: Hot tag and original/discount price display.
    - ⭐ **Ratings & Reviews**: Verified buyers can rate and review.
    - 📦 **Stock & Sold Counters**: Real-time inventory and sales display.
    - ♾️ **Shared Products**: Infinite-stock items for shared accounts/tutorials.
    - 🚫 **Purchase Limits**: Limit purchases by paid order count.
    - 🔢 **Quantity Selection**: Support purchasing multiple items.
    - 🏷️ **Custom Store Name**: Configurable store name in header/title.
- **Orders & Delivery**:
    - ✅ **Payment Callback Verification**: Signature and amount checks.
    - 🎁 **Auto Delivery**: Card key delivery on payment; paid status retained if out of stock.
    - 📦 **Multi-Card Delivery**: Display multiple card keys for multi-quantity orders.
    - 🔒 **Stock Reservation**: 5-minute hold after entering checkout to prevent oversell.
    - ⏱️ **Auto-Cancel**: Unpaid orders are cancelled after 5 minutes and stock is released.
    - 🧾 **Order Center**: Order list and details pages.
    - 🔔 **Pending Order Alert**: Homepage banner reminds users of unpaid orders.
    - 🔄 **Refund Requests**: Users can submit refund requests for admin review.
    - ✅ **Auto Refund**: Auto-trigger refunds after approval with error handling.
    - 💳 **Payment QR**: Admins can generate payment links/QR codes for direct payments.
- **Admin Console**:
    - 📊 **Sales Stats**: Today/week/month/total overview.
    - ⚠️ **Low Stock Alerts**: Configurable threshold and warnings.
    - 🧩 **Product Management**: Create/edit, enable/disable, reorder, purchase limits.
    - 🏷️ **Category Management**: CRUD categories with icons and ordering.
    - 🗂️ **Card Inventory**: Bulk import and bulk delete unused card keys.
    - 💳 **Order Management**: Pagination/search/filters, order detail, mark paid/delivered/cancel.
    - 🧹 **Order Cleanup**: Bulk select and bulk delete.
    - ⭐ **Review Management**: Search and delete reviews.
    - 📦 **Data Management**: Full SQL export (D1 compatible), import from Vercel SQL.
    - 📣 **Announcements**: Homepage announcement management.
    - 👥 **Customer Management**: View customers, manage points, block/unblock.
    - 📨 **Message Center**: Send inbox messages to all users or specific users, with history.
    - ⚙️ **Refund Settings**: Toggle whether refunded card keys return to stock.
    - 🎨 **Theme & Footer**: Theme color selection and custom footer text.
    - 🔔 **Update Check**: Admin panel auto-detects new versions.
- **Points System**:
    - ✨ **Daily Check-in**: Users earn points by daily check-in.
    - 💰 **Points Discount**: Use points to offset purchase amounts.
    - 🎁 **Points Payment**: If points cover full amount, no payment gateway needed.
- **I18n & Theme**:
    - 🌐 **English/Chinese switcher**.
    - 🌓 **Light/Dark/System themes**.
    - ⏱️ **Auto Update**: GitHub Actions workflow for upstream sync.
- **Notifications**:
    - 📧 **Delivery Email**: Send order delivery notifications via Resend.
    - 📢 **Telegram Notifications**: New order push notifications via Telegram Bot.
    - 📮 **Inbox Notifications**: User inbox for delivery/refund/admin messages.
    - 🌐 **LDC Navigator**: Opt-in store listing and public navigation page.

## 🚀 One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fchatgptuk%2Fldc-shop&env=OAUTH_CLIENT_ID,OAUTH_CLIENT_SECRET,MERCHANT_ID,MERCHANT_KEY,ADMIN_USERS,NEXT_PUBLIC_APP_URL&envDescription=Required%20Environment%20Variables&project-name=ldc-shop&repository-name=ldc-shop&stores=%5B%7B%22type%22%3A%22postgres%22%7D%5D)

Click the button above to deploy your own instance to Vercel.

The database (Vercel Postgres) will be automatically provisioned and linked.

## ☁️ Cloudflare Workers Command Deploy

See [`_workers_v2/README.md`](./_workers_v2/README.md) for Wrangler-based deployment and configuration steps.

## 💡 Recommendation: Custom Domain

While the system supports active order status querying, for the best user experience (instant payment status updates), we still **recommend** binding a custom domain (e.g., `store.yourdomain.com`).

The shared `vercel.app` domain is sometimes flagged by firewalls or payment gateways, which might delay or block payment callbacks. Using a custom domain avoids these issues.

## 🐳 Docker Deployment (Docker Compose)

> ⚠️ **Experimental**: Docker deployment has not been fully tested and may have unknown issues. **We recommend using Vercel deployment** for better stability.

If you have your own server (VPS/NAS), you can deploy simply with Docker:

1.  Clone the repository:
    ```bash
    git clone https://github.com/chatgptuk/ldc-shop.git
    cd ldc-shop
    ```
2.  Edit `docker-compose.yml` environment variables:
    - This file starts a local PostgreSQL database by default.
    - **Crucial**: Replace `OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET`, `MERCHANT_ID`, `MERCHANT_KEY` with your actual credentials.
3.  Start the service:
    ```bash
    docker-compose up -d
    ```
4.  Visit `http://localhost:3000`.
    - Database data is persisted in the local `./postgres-data` folder.

## 🔄 How to Enable Auto Update

If you forked this project, you can enable GitHub Actions to automatically sync the latest code from upstream (triggering a Vercel redeploy):

1.  Go to your GitHub repository page.
2.  Click the **Actions** tab.
3.  Select **Upstream Sync** from the left sidebar.
4.  Click the **Enable workflow** button.
5.  (Optional) Click **Run workflow** to test it manually.

Once enabled, the script will check for updates from `chatgptuk/ldc-shop:main` daily and merge them into your repository.


## ⚙️ Configuration Guide

The following environment variables are required.

> **⚠️ NOTE**: 
> The following configuration uses `store.chatgpt.org.uk` as an example. **Please replace it with your ACTUAL domain when deploying!**

### 1. Linux DO Connect (OIDC)
Go to [connect.linux.do](https://connect.linux.do) to create/configure:

*   **App Name**: `LDC Store Next` (or any name)
*   **App Homepage**: `https://store.chatgpt.org.uk`
*   **App Description**: `LDC Store Next`
*   **Callback URL**: `https://store.chatgpt.org.uk/api/auth/callback/linuxdo`

Get **Client ID** and **Client Secret**, and fill them into environment variables as `OAUTH_CLIENT_ID` and `OAUTH_CLIENT_SECRET` (**Secret recommended**).

### 2. EPay (Linux DO Credit)
Go to [credit.linux.do](https://credit.linux.do) to create/configure:

*   **App Name**: `LDC Store Next` (or any name)
*   **App Address**: `https://store.chatgpt.org.uk`
*   **Callback URI**: `https://store.chatgpt.org.uk/callback`
*   **Notify URL**: `https://store.chatgpt.org.uk/api/notify`

Get **Client ID** and **Client Secret**, and fill them into environment variables as `MERCHANT_ID` and `MERCHANT_KEY` (**Secret recommended**).

For GitHub OAuth App, set **Authorization callback URL** to:
`<your-full-site-url>/api/auth/callback/github`

Example:
`https://shop.chatgpt.org.uk/api/auth/callback/github`

It must exactly match the protocol and domain of `NEXT_PUBLIC_APP_URL` (no extra trailing slash).

### 3. Other Variables
*   **ADMIN_USERS**: Admin usernames, comma separated (supports Linux DO usernames and GitHub usernames in `gh_<login>` format, e.g., `chatgpt,gh_octocat`) (**Secret recommended**).
*   **NEXT_PUBLIC_APP_URL**: Your full app URL (e.g., `https://store.chatgpt.org.uk`). **Must be Text, not Secret**.

> Important: For a GitHub account to be recognized as admin, `ADMIN_USERS` must contain `gh_<github_login>` (for example `gh_octocat`). Using just `octocat` will not work.

## 🔌 Card Auto-Replenish API Integration

You can configure Card API auto-replenish per product in the admin `Card Inventory` page.

### Trigger Timing

- On enable: the system immediately tries to pull 1 card key.
- Manual pull: when clicking `Pull 1 Card`, it pulls 1 card key.
- Auto-replenish: after each successful delivery, it auto-pulls 1 card key (no cron required).

### Request Rules

- Method: `GET`
- URL: uses the exact API URL you configured in admin, as-is
- No automatic `productId` append/replace
- Optional header:
  - `Authorization: Bearer <token>` (sent only when token is configured)
- Fixed header:
  - `Accept: application/json, text/plain;q=0.9, */*;q=0.8`

### Response Requirements

Each request should return one deliverable card key. Supported response formats:

1. Plain text (`text/plain`)

```text
ABC-DEF-123
```

2. JSON direct fields (any one of them)

```json
{ "cardKey": "ABC-DEF-123" }
```

```json
{ "card": "ABC-DEF-123" }
```

```json
{ "key": "ABC-DEF-123" }
```

```json
{ "code": "ABC-DEF-123" }
```

3. JSON nested fields (recursive extraction from `data` / `result` / `item`)

```json
{ "data": { "cardKey": "ABC-DEF-123" } }
```

```json
{ "result": { "item": { "code": "ABC-DEF-123" } } }
```

4. JSON array (the first valid card key will be used)

```json
[{ "cardKey": "ABC-DEF-123" }, { "cardKey": "XYZ-999-888" }]
```

### Recommended Status Codes

- Success: return `200`
- Failure (out of stock/auth invalid/invalid params): return `4xx/5xx`

Your API should avoid returning duplicate card keys. Duplicate keys will be rejected by the store's uniqueness constraints.

## 🛠️ Local Development

1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Link Vercel Project (for Env Vars & DB):
    ```bash
    vercel link
    vercel env pull .env.development.local
    ```
4.  Run migrations:
    ```bash
    npx drizzle-kit push
    ```
5.  Start dev server:
    ```bash
    npm run dev
    ```

## 📄 License
MIT

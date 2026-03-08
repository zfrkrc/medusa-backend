<p align="center">
  <a href="https://www.medusajs.com">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://user-images.githubusercontent.com/59018053/229103275-b5e482bb-4601-46e6-8142-244f531cebdb.svg">
    <source media="(prefers-color-scheme: light)" srcset="https://user-images.githubusercontent.com/59018053/229103726-e5b529a3-9b3f-4970-8a1f-c6af37f087bf.svg">
    <img alt="Medusa logo" src="https://user-images.githubusercontent.com/59018053/229103726-e5b529a3-9b3f-4970-8a1f-c6af37f087bf.svg">
    </picture>
  </a>
</p>
<h1 align="center">
  Medusa
</h1>

<h4 align="center">
  <a href="https://docs.medusajs.com">Documentation</a> |
  <a href="https://www.medusajs.com">Website</a>
</h4>

<p align="center">
  Building blocks for digital commerce
</p>
<p align="center">
  <a href="https://github.com/medusajs/medusa/blob/master/CONTRIBUTING.md">
    <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat" alt="PRs welcome!" />
  </a>
    <a href="https://www.producthunt.com/posts/medusa"><img src="https://img.shields.io/badge/Product%20Hunt-%231%20Product%20of%20the%20Day-%23DA552E" alt="Product Hunt"></a>
  <a href="https://discord.gg/xpCwq3Kfn8">
    <img src="https://img.shields.io/badge/chat-on%20discord-7289DA.svg" alt="Discord Chat" />
  </a>
  <a href="https://twitter.com/intent/follow?screen_name=medusajs">
    <img src="https://img.shields.io/twitter/follow/medusajs.svg?label=Follow%20@medusajs" alt="Follow @medusajs" />
  </a>
</p>

## Version 3.0.0 (B2B Multi-Store Data Isolation)

This version contains the ultimate data isolation matrix for running a multi-tenant B2B platform on Medusa v2.

### 🛡️ Isolation Features (Ghost Mode)
- **Orders & Products**: Isolated via Sales Channel Query Injection (`sales_channel_id`).
- **Store Settings**: Isolated via Response Interceptors (Ghost Mode).
- **Sales Channels**: Admin users only see their linked sales channel.
- **Locations & Shipping**: Highly precise isolation based on `metadata.store_id`, including forced metadata query inclusion to bypass Medusa UI's partial field requests.
- **Users**: Admin users can ONLY see their own user profile in the list (Ghost Mode). E-mail resolution via `actor_id` completely secures the admin listing.
- **API Keys**: Completely hidden from store admins (Returns empty array).
- **Workflows**: Personal boundaries enforced via response filtering.
- **Regions/Tax/Tags/Types**: Shared globally without filtration.

### 🐛 Critical Fixes from previous versions
- **404 Dashboard Crash resolved**: Excluded `/admin/stores` from filtering to provide Medusa Admin UI with required payload, eliminating false 404s.
- **Invalid Password / Scrypt Auth Hash**: Re-written `reset-password.ts` to exactly match Medusa v2's native scrypt standards (`N=32768, r=8, p=1, keyLen=72`).
- **Location Listing Ghost Bug**: Enforced `*metadata` query params in middleware so UI always gets `store_id` data to filter.

## Compatibility

This starter is compatible with versions >= 2 of `@medusajs/medusa`. 

## Build Instructions
1. `docker compose up -d --build medusa-backend`
2. Run database migrations: `npx medusa db:migrate`
3. Check users and store links carefully via local custom module (`store-management`).

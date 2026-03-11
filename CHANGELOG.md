# Changelog

All notable changes to `@waffo/pancake-ts` will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.3] - 2026-03-11

### Added

- **Private key normalization** — `privateKey` is automatically normalized at construction time. Accepts literal `\n` from environment variables, Windows `\r\n` line endings, raw base64 without PEM headers, single-line base64, and PKCS#1 (`BEGIN RSA PRIVATE KEY`) format. Invalid or empty keys throw a descriptive error immediately instead of failing on the first API call.
- **Checkout integration guide** in README — Step-by-step instructions (Issue Token → Create Session → Open Checkout Page) with recommendation to open the checkout URL in a new browser tab.

## [0.1.2] - 2026-03-11

### Fixed

- **Signing** — Body hash encoding changed from `hex` to `base64` to match auth-service canonical request format

## [0.1.1] - 2026-03-10

### Changed

- **Build** — Switch from `tsc` to `tsup`, output ESM + CJS dual format
- **Package** — Rename from `@waffo-pancake/sdk` to `@waffo/pancake-ts`
- **CI/CD** — Add GitHub Actions workflow (`ci-cd.yml`) with lint, test, coverage, build, and npm publish on `v*` tag
- **Node** — Minimum Node version raised from 18 to 20 (`@vitest/coverage-v8` requires `node:inspector/promises`)

## [0.1.0] - 2026-03-10

### Added

- **Client** — `WaffoPancake` SDK client with RSA-SHA256 request signing and deterministic idempotency key (`X-Idempotency-Key = SHA256(merchantId:path:body)`)
- **Auth** — `client.auth.issueSessionToken()` for buyer session token issuance
- **Stores** — `client.stores.create()` / `update()` / `delete()` for store management (webhook, notification, checkout settings)
- **Store Merchants** — `client.storeMerchants.add()` / `remove()` / `updateRole()` (endpoints return 501, coming soon)
- **Onetime Products** — `client.onetimeProducts.create()` / `update()` / `publish()` / `updateStatus()` with multi-currency pricing
- **Subscription Products** — `client.subscriptionProducts.create()` / `update()` / `publish()` / `updateStatus()` with billing period support
- **Subscription Product Groups** — `client.subscriptionProductGroups.create()` / `update()` / `delete()` / `publish()` for shared trial and plan switching
- **Orders** — `client.orders.cancelSubscription()` with status machine (pending→canceled, active→canceling)
- **Checkout** — `client.checkout.createSession()` with trial toggle, billing detail, price snapshot, and metadata
- **GraphQL** — `client.graphql.query<T>()` for typed GraphQL queries (Query only, no Mutations)
- **Webhooks** — `verifyWebhook()` with embedded RSA-SHA256 public keys (test/prod), auto environment detection, and replay protection (default 5min tolerance)
- **Error handling** — `WaffoPancakeError` with HTTP status and call-stack-ordered `errors` array
- **Types** — 15 runtime enums, 40+ TypeScript interfaces covering all API resources
- **Engineering** — ESLint 9 (TypeScript ESLint + import order + naming convention + JSDoc), Vitest 4 with v8 coverage, `tsconfig.build.json` for clean `dist/` output
- **Documentation** — Split into focused documents: README (project intro), `docs/api-reference.md` (complete API reference), `docs/graphql-guide.md` (GraphQL usage guide), `docs/webhook-guide.md` (webhook verification guide)

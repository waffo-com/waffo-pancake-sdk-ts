# Changelog

All notable changes to `@waffo/pancake-ts` will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.4] - 2026-04-14

### Changed

- **Store settings partial update types** — `UpdateStoreParams.webhookSettings`, `notificationSettings`, and `checkoutSettings` now use `Partial<>` types, allowing individual sub-fields to be omitted (kept unchanged) or set to `null` (cleared). Previously all sub-fields were required when passing a settings object.

### Documentation

- **`stores.update()` JSDoc** — Added partial update semantics explanation and example for clearing individual webhook URLs.

## [0.3.2] - 2026-04-10

### Fixed

- **Cloudflare Workers compatibility** — `fetch` is now bound to `globalThis` when no custom `fetch` is provided. Fixes `TypeError: Illegal invocation` in edge runtimes (Cloudflare Workers, Vercel Edge) where unbound `fetch` references lose their `this` context. Affected both `HttpClient` (merchant API Key auth) and `BuyerHttpClient` (session token auth). Users no longer need to pass `{ fetch: globalThis.fetch.bind(globalThis) }` as a workaround.

## [0.3.1] - 2026-04-09

### Changed

- **Product update simplified** — `update()` only modifies provided fields; omitted fields are preserved. `name`, `prices`, and `billingPeriod` (subscription) are now optional.

### Documentation

- **GraphQL type difference warning** — Added warnings in `graphql-guide.md`, `api-reference.md`, and external docs (EN/ZH/JA) clarifying that SDK TypeScript types reflect the REST API shape and differ from GraphQL schema types. Users should always use introspection for GraphQL queries.

## [0.3.0] - 2026-04-09

### Breaking Changes

- **Checkout params simplified** — `storeId` and `productType` removed from `CreateCheckoutSessionParams`, `AnonymousCheckoutParams`, and `AuthenticatedCheckoutParams`. The server now derives both from `productId` automatically. Only `productId` + `currency` are required.
- **`CheckoutSessionProductType` enum removed** — No longer exported. Product type is determined server-side.
- **`IssueSessionTokenParams.storeId` now optional** — Provide either `storeId` or `productId` (at least one required). When `productId` is given, the server derives the store from the product.

### Added

- **`IssueSessionTokenParams.productId`** — New optional field. When provided without `storeId`, the server derives the store from the product.

### Changed

- **`checkout.authenticated.create()`** — Now sends `productId` (instead of `storeId`) to `issue-session-token` endpoint for parallel session token + checkout session creation.

## [0.2.2] - 2026-04-03

### Fixed

- **Checkout idempotency** — Checkout methods (`anonymous.create()`, `authenticated.create()`, `createSession()`) now use time-windowed idempotency keys (60-second window) instead of fully deterministic keys. Previously, identical checkout params always produced the same `X-Idempotency-Key`, causing the gateway to return cached (and potentially expired) sessions. Now, same params within the same minute are still deduped (protects against network retries), but a new key is generated after the window elapses.
- **Timestamp consistency** — `Date.now()` is now called once per request and shared between signature timestamp and idempotency key calculation, eliminating a theoretical edge case where the two could land in different seconds.

### Internal

- **`PostOptions` interface** — Extracted inline `{ idempotencyWindow?: number }` into a named type in `types.ts` (not publicly exported).

## [0.2.1] - 2026-04-02

### Added

- **Client-side input validation** — All resource methods now validate inputs before sending network requests. Checks include: required field presence, Short ID format (`STO_xxx`, `PROD_xxx`, etc.), ISO 4217 currency codes, ISO 3166-1 country codes, display-format amount strings, enum value ranges, and positive integers. Validation errors throw `WaffoPancakeError` with `status: 400` and `layer: "sdk"`, so developers catch them uniformly with API errors.
- **`ErrorLayer.Sdk`** — New `"sdk"` value in the `ErrorLayer` enum for client-side validation errors.

### Fixed

- **Types** — `RefundTicketStatus` enum now includes all 9 statuses: added `UnderReview`, `Returned`, `Cancelled` (previously missing 3 values)
- **Types** — `RefundTicket.currentVersionId` corrected to `string | null` (was `string`)
- **Types** — `RefundTicket.versionNumber` corrected to `number | null` (was `number`)
- **Types** — `RefundTicket.versionData` corrected to `Record<string, unknown> | null` (was non-nullable)
- **Types** — `RefundTicket` now includes `createdAt` and `updatedAt` fields (previously missing)
- **Types** — `PriceInfo`, `Prices`, `WebhookEvent` JSDoc examples corrected from numeric amounts to display-format strings

## [0.2.0] - 2026-04-02

### Added

- **Checkout convenience methods** — `client.checkout.authenticated.create()` and `client.checkout.anonymous.create()` wrap the full checkout flow into a single call. Authenticated mode issues a session token, creates a checkout session, and returns a URL with the token appended as a URL fragment. Anonymous mode creates a session directly.
- **Buyer self-service** — `client.buyer(token)` creates a session-token-authenticated buyer session with methods: `cancelSubscription()`, `cancelOnetimeOrder()`, `reactivateSubscription()`, `createRefundTicket()`, `resubmitRefundTicket()`, and `graphql.query()`.
- **Types** — `AuthenticatedCheckoutParams`, `AuthenticatedCheckoutResult`, `AnonymousCheckoutParams`, `CancelOnetimeOrderParams`, `CancelOnetimeOrderResult`, `ReactivateSubscriptionParams`, `ReactivateSubscriptionResult`, `CreateRefundTicketParams`, `ResubmitRefundTicketParams`, `RefundTicket`, `RequestedAmount`
- **Resources** — `CheckoutAnonymousResource`, `CheckoutAuthenticatedResource`, `BuyerSession`, `BuyerHttpClient`

### Changed

- **Base URL** — Default API endpoint changed from `waffo-pancake-auth-service.vercel.app` to `api.waffo.ai`
- **Package** — `docs/` directory now included in npm package (`files` field)
- **Docs** — `docs/api-reference.md` synced with endpoint docs: fixed `storeId` required status, added `BillingDetail` conditional field rules, fixed price amount format (display string, not integer), added subscription product group UUID note, added Buyer Self-Service section
- **Docs** — `docs/graphql-guide.md` rewritten: corrected query names (`onetimeOrders` / `subscriptionOrders`), added product version queries, exchange rate query, webhook/email delivery log queries, 9 analytics queries (`orderStatistics`, `paymentStatistics`, `productStatistics`, `trendAnalysis`, `distributionAnalysis`, `customerAnalysis`, `taxAnalysis`, `subscriptionAnalysis`, `refundTicketAnalysis`), updated count query list and filter examples
- **Docs** — `docs/webhook-guide.md` fixed `amount` / `taxAmount` type from `number` to `string` (display format), added retry mechanism section with delivery status table
- **README** — Reorganized by use-case priority (checkout → webhooks → buyer self-service → GraphQL → programmatic management), added checkout mode comparison and recommendation rationale

## [0.1.8] - 2026-03-20

### Added

- **Types** — `UpdateStoreParams` adds optional `supportEmail` and `website` fields (`string | null`) with JSDoc
- **Types** — `ErrorLayer` enum adds `Ticket = "ticket"` value

### Changed

- **Resources** — All resource method calls now use explicit generic type parameters (`http.post<T>()`) for improved type safety
- **README** — Corrected Node requirement to "Node >= 20" and build output to "ESM + CJS"

## [0.1.7] - 2026-03-20

### Added

- **Custom webhook public key** — `WaffoPancakeConfig.webhookPublicKey` accepts `string` (shared) or `{ test?, prod? }` (per-environment) to override built-in keys.
- **Multi-level key resolution** — Webhook public key is resolved per environment: `options.publicKey` (per-call) → config key → `WAFFO_WEBHOOK_{TEST|PROD}_PUBLIC_KEY` env var → `WAFFO_WEBHOOK_PUBLIC_KEY` env var → built-in hardcoded key.
- **`client.webhooks.verify()`** — New resource namespace on the client instance. Injects config-level keys into the resolution chain automatically; supports per-call override via `options.publicKey`.
- **`VerifyWebhookOptions.publicKey`** — Per-call override for the standalone `verifyWebhook()` function (highest priority, skips all resolution).
- **`VerifyWebhookOptions.publicKeys`** — Config-level key(s) for the resolution chain (typically injected by `client.webhooks.verify()`).
- **`WebhookPublicKeys` type** — `string | { test?: string; prod?: string }`, exported from the package.
- **Public key normalization** — `normalizePublicKey()` handles the same flexible input formats as `normalizePrivateKey`: literal `\n` from environment variables, Windows `\r\n` line endings, raw base64 without PEM headers, single-line base64, and PKCS#1 (`BEGIN RSA PUBLIC KEY`) format. Applied automatically at every level of the resolution chain.

## [0.1.6] - 2026-03-18

### Changed

- **Types (BREAKING)** — `PriceInfo` removes `taxIncluded` field. Prices now only require `amount` and `taxCategory`. The system internally defaults to tax-exclusive pricing; `taxIncluded` may be re-introduced in a future version.
- **Types (BREAKING)** — `Store` removes `isPublic` field from response type. `UpdateStoreParams` removes `isPublic` field from input type. Store visibility is no longer configurable (defaults to private).

### Migration

Remove `taxIncluded` from all `PriceInfo` / `Prices` objects:

```diff
 const { product } = await client.onetimeProducts.create({
   storeId: "STO_xxx",
   name: "My Product",
   prices: {
-    USD: { amount: 2900, taxIncluded: false, taxCategory: "digital_goods" },
+    USD: { amount: 2900, taxCategory: "digital_goods" },
   },
 });
```

Remove `isPublic` from `stores.update()` calls:

```diff
 const { store } = await client.stores.update({
   id: "STO_xxx",
-  isPublic: true,
   name: "Updated Name",
 });
```

## [0.1.5] - 2026-03-18

### Changed

- **Types** — `CheckoutThemeSettings` removes `checkoutColorTextSecondary` field (7→6 fields). The secondary text color is now derived server-side from `checkoutColorText` and `checkoutColorCard` via color mixing. Merchants only need to configure 5 base color/radius fields; the remaining 7 PSP variables are computed automatically.

### Migration

If your code references `checkoutColorTextSecondary`, remove it. The field is no longer accepted by the API and is silently ignored in stored data.

```diff
 const theme: CheckoutThemeSettings = {
   checkoutLogo: null,
   checkoutColorPrimary: "#6366f1",
   checkoutColorBackground: "#ffffff",
   checkoutColorCard: "#f9fafb",
   checkoutColorText: "#111827",
-  checkoutColorTextSecondary: "#6b7280",
   checkoutBorderRadius: "0.5rem",
 };
```

## [0.1.4] - 2026-03-16

### Changed

- **Types** — `CheckoutSettings` adds `defaultDarkMode: boolean` field to match API response (store create/update)
- **Types** — `CreateCheckoutSessionParams` adds optional `darkMode` field for dark mode override
- **Types** — `CreateCheckoutSessionParams.storeId` changed from optional to required to match API spec

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

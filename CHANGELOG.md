# Changelog

All notable changes to `@waffo/pancake-ts` will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.19.1] - 2026-08-20

Pre-filling a billing country does not restrict which payment methods the hosted cashier offers.

### Changed

- `createCheckoutSession` — `billingDetail` no longer couples the hosted cashier to a payment market. The cashier's market adapts to the customer's own environment, and `includePaymentMethods` / `excludePaymentMethods` are the only constraint on which methods it offers; the billing country affects tax calculation and invoice attribution only. This reverts the coupling described in 0.16.1, which the platform no longer applies. Types unchanged — no code migration.

## [0.19.0] - 2026-08-18

Subscription products can now charge for the trial period.

### Added

- **`PriceInfo.trialAmount`** — trial period price as a display string, subscription products only. Omit it for a free trial. It requires `metadata.trialDays` on the product and must be lower than `amount`; the API rejects either violation with a 400.
- **`PriceSnapshot`** — the type `CreateCheckoutSessionParams.priceSnapshot` accepts. Same shape as `PriceInfo` without `trialAmount`.

### Changed

- **`CreateCheckoutSessionParams.priceSnapshot` is typed `PriceSnapshot` rather than `PriceInfo`.** A session-level override replaces the regular period price; the trial price comes from the product version locked into the session, so a `trialAmount` passed here would be dropped server-side. Existing calls compile unchanged — the fields `PriceSnapshot` declares are exactly the two `PriceInfo` had before `trialAmount` was added.

## [0.18.0] - 2026-08-08

Customer sessions never reached the API, and webhook retries were rejected as replays.

### Fixed

- **Customer session requests now send `X-Environment`.** A session token carries no environment of its own, so the gateway requires the header next to the Bearer credential and rejects the request with a 400 without it. The header was missing, which made every `client.customer(...)` method unusable: `cancelSubscription`, `cancelOnetimeOrder`, `reactivateSubscription`, `createRefundTicket`, `resubmitRefundTicket`, and `graphql.query`. API Key requests were never affected — the gateway derives their environment from the key.
- **Webhook verification no longer rejects legitimate retries.** The signature timestamp is stamped once, before the first delivery attempt, and retries reuse the original header — so the last retry of a schedule arrives with a timestamp as old as the schedule itself (observed above 31 minutes). Against the old 5-minute window every late retry failed verification as a suspected replay. `verifyWebhook` now allows timestamps up to **45 minutes** old.

### Added

- **`WaffoPancakeConfig.environment`** — `"test"` or `"prod"`, the environment customer sessions operate in.
- **`CustomerSessionOptions`** — second argument to `client.customer(token, options)`, overriding the config for a single session.
- **`VerifyWebhookOptions.futureToleranceMs`** — how far in the future a signature timestamp may be, default `60000` (1 minute). Raise it for a receiving server with known clock skew.

### Changed

- **`client.customer(token)` requires an environment** from either the config or the per-session options, and throws `WaffoPancakeError` (400, `layer: "sdk"`) when neither supplies one. There is no default — guessing would route the call to the other environment. This turns a request that always failed at the gateway into a local error; no working call changes behavior. Migration: add `environment` to your client config, or pass `client.customer(token, { environment: "test" })`.
- `client.buyer(token, options)` (deprecated) accepts and forwards the same options.
- **`VerifyWebhookOptions.toleranceMs` default raised from `300000` to `2700000`, and the window is now asymmetric** — matching the gateway's API Key check, which pairs a wide past-facing window with a tight future-facing one. `toleranceMs` now means "how far in the past"; the future direction is `futureToleranceMs`. `toleranceMs: 0` still disables the check entirely. A captured request stays replayable for longer under the wider window, so keep your handler idempotent on the event `id` — that, not the window, is the real defense.


## [0.17.0] - 2026-08-03

`supportEmail` and `website` were never applied by the update-store endpoint — passing them was silently ignored.

### Removed

- `UpdateStoreParams.supportEmail` and `UpdateStoreParams.website` — the endpoint never wrote these fields, so passing them had no effect. They are derived from ownership verification and are set only by the flows that prove it: email code binding, domain verification, or KYB approval. Both remain readable on `Store`. Migration: drop them from your `stores.update()` calls; a `null` you were passing to "clear" them was never clearing anything.

## [0.16.1] - 2026-07-30

Pre-filling a billing country restricts which payment methods the hosted cashier offers.

### Changed

- `createCheckoutSession` — passing `billingDetail` couples the hosted cashier to the order's billing country: it then offers only that country's payment market and the customer cannot switch. The country that applies is the one on the finished order, not the one you sent; a country outside the payment markets we cover applies no restriction. If the coupled market offers none of your enabled payment methods the order cannot be paid. Omit `billingDetail` to leave the cashier unrestricted. Types unchanged — no code migration.

## [0.16.0] - 2026-07-28

Per-transaction payment method selection on the hosted checkout page.

### Added

- `PaymentMethod` — payment methods offered on the checkout page: `card` / `applepay` / `googlepay` / `wechat`
- `CreateCheckoutSessionParams.includePaymentMethods` — whitelist: offer only these. Every value must be supported by the product type × currency pair, otherwise the request is rejected with a 400.
- `CreateCheckoutSessionParams.excludePaymentMethods` — blacklist: offer everything the currency supports except these. Values the currency does not offer are ignored, so one blacklist can be reused across currencies. Mutually exclusive with `includePaymentMethods`; omit both to offer every method the currency supports.

### Changed

- Currencies outside the payment method matrix are now rejected at checkout session creation (400) instead of falling through to the provider. One-time supports `USD` / `EUR` / `GBP` / `HKD` / `JPY` / `CNY`; subscription supports `USD` / `EUR` / `GBP` / `HKD` / `JPY`. Affects one-time `THB` and subscription `CNY`, neither of which has ever produced a successful charge.
- Both fields require API Key authentication. Store Slug (visitor) sessions ignore them and always offer every method the currency supports — payment method selection is a merchant-side commercial decision (channel fees, settlement terms).

---

## [0.15.0] - 2026-07-27

Notification settings contract update for platform-managed payout notifications.

### Added

- `NotificationSettings.emailUpcomingCharge` — platform-managed toggle for the upcoming-charge reminder email (renewal notice sent before a subscription charge).

### Removed

- **Breaking**: `NotificationSettings.notifyPayoutCompleted` / `notifyPayoutFailed` and their entries in `MerchantWritableNotificationSettings`. Payout result emails are platform-managed and always delivered (merchant-level platform notification) — they have no toggle. The `update-store` endpoint silently drops the legacy keys with a `warnings[]` entry.

## [0.14.0] - 2026-07-18

Adds content-safety prompt scanning for AIGC generation.

### Added

- `client.contentSafety.scanPrompt(params)` — scan a user prompt before AIGC generation; returns a redacted verdict (`action` = allow / review / block, continue only when `allow`). Stateless (prompt text never stored); fails closed to `review` if the safety service is briefly unavailable.
- Types: `ScanPromptParams`, `ScanResult`; enums `ScanAction`, `ScanReasonCode`, `ScanPolicyCategory`, `ScanSemanticMode`, `ScanSemanticStatus`.

## [0.13.0] - 2026-07-17

Adds cashier language selection to checkout sessions.

### Added

- **`CashierLanguage`** — exported union type of the 22 supported checkout cashier languages (IETF BCP 47, e.g. `"en"`, `"pt-BR"`, `"zh-Hant-TW"`).
- **`CreateCheckoutSessionParams.language`** — optional cashier language, forwarded to `create-session`. Sets the hosted checkout page's default language; the customer can still switch it on the page. Omit to let the payment provider infer.

## [0.12.0] - 2026-07-14

Renames the "buyer" persona to "customer" across the SDK's public API — "customer" is the Waffo term for the merchant's end consumer (the session-token JWT role). Old names remain available as deprecated aliases. Wire-level request and webhook field names (`buyerIdentity`, `buyerEmail`, `merchantProvidedBuyerIdentity`) are part of the server contract and are unchanged.

### Changed

- **`client.customer(token)`** — creates the customer self-service session (class `CustomerSession`, previously `BuyerSession`). Same methods: `cancelSubscription()`, `cancelOnetimeOrder()`, `reactivateSubscription()`, `createRefundTicket()`, `resubmitRefundTicket()`, `graphql.query<T>()`.

### Deprecated

- **`client.buyer(token)`** — use `client.customer(token)` instead. Thin wrapper around `client.customer()`, identical behavior; will be removed in a future major version.

## [0.11.0] - 2026-06-05

Aligns Create/Update Product params with backend product-service v2026.6.4: `description` and `successUrl` accept `null` for explicit field clearing (previously only `undefined` / omitted). Backend also tightens `name` to ≤ 64 characters to match the PSP `goodsName` cap — passing a longer name now returns 400.

### Changed

- **`CreateOnetimeProductParams.description` / `successUrl`** — typed `string | null` (was `string`).
- **`UpdateOnetimeProductParams.description` / `successUrl`** — typed `string | null`.
- **`CreateSubscriptionProductParams.description` / `successUrl`** — typed `string | null`.
- **`UpdateSubscriptionProductParams.description` / `successUrl`** — typed `string | null`.

### Migration

If you currently omit `description` / `successUrl` (or pass `undefined`), no change needed — the backend keeps the existing value. To explicitly clear a previously-set value:

```diff
-await client.onetimeProducts.update({ id, description: undefined });   // keeps existing value
+await client.onetimeProducts.update({ id, description: null });        // clears the field
```

Backend also accepts `""` for the same effect; SDK uses `null` as the canonical "clear" sentinel.

Note `name.length` must now be ≤ 64. The backend enforced no limit previously; existing names > 64 chars are rare (production scan found 1 internal test outlier, no real merchant data). New attempts > 64 chars return `400 { errors: [{ message: "name must not exceed 64 characters", layer: "product" }] }`.

## [0.10.0] - 2026-06-01

Expands `NotificationSettings` to the full 19-field schema (8 consumer-email + 11 merchant-notify toggles) and narrows `UpdateStoreParams.notificationSettings` to the merchant-writable subset.

### Added

- **`NotificationSettings`** gains 11 fields aligning with the platform schema:
  - Consumer email (platform-managed): `emailTrialStarted`, `emailTrialEnding`
  - Merchant notify (merchant-writable): `notifySubscriptionCanceled`, `notifySubscriptionEnded`, `notifySubscriptionPastDue`, `notifySubscriptionRenewed`, `notifySubscriptionUncanceled`, `notifySubscriptionUpdated`, `notifyChargeback`, `notifyPayoutCompleted`, `notifyPayoutFailed`
- **`MerchantWritableNotificationSettings`** — new type exposing only the 11 `notify*` toggles. Use this for any merchant-side `update-store` call. `email*` toggles are managed by the PANCAKE platform (admin via DB) and silently dropped if passed to the merchant API.

### Changed

- **`UpdateStoreParams.notificationSettings` narrowed** from `Partial<NotificationSettings>` to `Partial<MerchantWritableNotificationSettings>`. Passing `email*` keys now fails TypeScript compilation rather than being silently dropped at the server.
- README "Update store" example pruned to only show writable `notify*` fields with an explicit comment on the platform-managed `email*` subset.

### Migration

If your `client.stores.update` calls passed any `emailOrderConfirmation` / `emailSubscription*` / `emailTrial*` keys in `notificationSettings`, remove them — these were already being dropped server-side as of v2026.5 (returned as a `warnings[].aiHint`). Only `notify*` keys are merchant-writable.

```diff
 await client.stores.update({
   id: storeId,
   notificationSettings: {
-    emailOrderConfirmation: true,
-    emailSubscriptionCycled: true,
     notifyNewOrders: true,
     notifyNewSubscriptions: false,
+    notifyChargeback: true,
+    notifyPayoutFailed: true,
   },
 });
```

## [0.9.0] - 2026-05-21

Adds flat dual-key external-id fields across write inputs, response entities, and webhook payload. The same field name now appears at every layer (REST request body / REST response / webhook payload / GraphQL).

### Added

- `CreateCheckoutSessionParams.orderMerchantExternalId` — order business identifier (optional, max 128 chars). Inherited by orders, payments, and refunds; surfaces in webhook payload (`data.orderMerchantExternalId`) and GraphQL (`Order.orderMerchantExternalId` / `Payment.orderMerchantExternalId` / `Refund.orderMerchantExternalId`).
- `CreateRefundTicketParams.refundTicketMerchantExternalId` — refund-ticket business identifier (optional, max 128 chars). Inherited by the executed refund record on PSP success; surfaces in webhook payload (`data.refundTicketMerchantExternalId`) and GraphQL (`RefundTicket.refundTicketMerchantExternalId` / `Refund.refundTicketMerchantExternalId`).
- `RefundTicket.refundTicketMerchantExternalId` — response field (immutable across resubmits, max 128 chars).
- `WebhookEventData.orderMerchantExternalId` — present on order/payment events and on refund events (inherited from the related order).
- `WebhookEventData.refundTicketMerchantExternalId` — only present on `refund.*` events; coexists with `orderMerchantExternalId` on the same refund payload.

### Notes

Non-breaking for SDK users — all five new fields are additive. The dual flat key naming is the canonical wire surface from this version onward.

## [0.8.0] - 2026-05-17

### Fixed

- **GraphQL queries actually return data.** Prior versions assumed a double-wrapped envelope (`{data:{data,errors,warnings}}`) and stripped one layer too many, so `result.data` was always `undefined` regardless of what the server returned. The wire is in fact the standard single-layer GraphQL envelope (`{data, errors?, warnings?}`); the SDK now returns it verbatim.
- **GraphQL queries no longer carry `X-Idempotency-Key`.** Queries are read-only; the gateway was caching them for 24h and serving stale snapshots on subsequent identical requests. Side-effect-free queries now hit the live DB on every call.
- **REST `warnings` are no longer dropped.** Every REST action endpoint can return `warnings: Notice[]` (handbook `command-layer.md`); prior `HttpClient.post()` returned only the unwrapped `data` field, throwing away migration `aiHint` notices like `update-store`'s `webhookSettings field ignored → Switch to client.webhooks.add/update/remove`.

### Changed

- **Resource method return types widened** from `Promise<X>` to `Promise<X & { warnings?: Notice[] }>` for every REST action method (`stores`, `storeMerchants`, `onetimeProducts`, `subscriptionProducts`, `subscriptionProductGroups`, `orders`, `checkout.*`, `webhooks.add/update/remove`, `auth.issueSessionToken`, `buyer.cancelSubscription / cancelOnetimeOrder / reactivateSubscription / createRefundTicket / resubmitRefundTicket`). Existing destructuring (`const { store } = await client.stores.create(...)`) keeps working; add `warnings` to the destructure to read advisories.
- **Transport refactored**: `HttpClient.post<T>()` now returns the parsed envelope plus HTTP status (`PostResult<T> = { status, data, errors?, warnings? }`) without throwing on `errors[]`. Throw / unwrap / warnings handling moved to the resource layer via the internal `unwrapAction` helper. GraphQL resources return the envelope verbatim.
- **`GraphQLResource.query` and `BuyerGraphQL.query` pass `noIdempotency: true`** to the transport (suppresses `X-Idempotency-Key`).

### Added

- **`Notice` type** (`{ message, layer, aiHint? }`) — unified shape used by both REST and GraphQL `errors[]` / `warnings[]`. Exported from `index.ts`.
- **`Envelope<T>` / `PostResult<T>` types** — transport-level envelope (and `PostResult` adds HTTP `status`). Exported for advanced callers.
- **`GraphQLResponse.errors[].layer?`** — optional field carrying which service stage produced the error (`"graphql"`, `"gateway"`).
- **`PostOptions.noIdempotency`** — boolean to suppress the `X-Idempotency-Key` header on a per-call basis.
- **README "Warnings (Migration Notices)" section** with REST + GraphQL examples and explicit guidance for LLM/agent consumers to act on `aiHint`.

### Deprecated

- **`ApiError`, `ApiResponse`, `ApiSuccessResponse`, `ApiErrorResponse`** — kept as type aliases for backwards compatibility; prefer `Notice` and the new `Envelope<T>` / `PostResult<T>`.

### Migration

- **Most callers need no changes.** Destructuring (`const { store } = ...`) still works; the new `warnings` field is optional and untouched code ignores it.
- **GraphQL callers**: if you have hacks that read `(result as any).stores` directly (bypassing the broken `result.data`), revert to `result.data.stores` — the bug that motivated the hack is gone.
- **LLM/agent consumers**: read `result.warnings?.[].aiHint` on every action — that's where the platform team puts canonical migration instructions when an API evolves (e.g. `update-store`'s deprecated `webhookSettings` field).
- **Direct `HttpClient.post` consumers** (rare; `HttpClient` is internal but reachable): return type changed from `T` to `PostResult<T>`; access `.data` to get the unwrapped payload, inspect `.errors` / `.warnings` directly. The transport no longer throws on `errors[]`.

## [0.7.0] - 2026-05-11

### Changed

- **`AddWebhookParams.events` / `UpdateWebhookParams.events` / `StoreWebhook.events`** typed as `` `${WebhookEventType}`[] `` instead of `string[]`. Editors now autocomplete the 10 enum values and flag typos at compile time. Runtime behavior unchanged — server still accepts string literals.
- **README webhook examples** use `WebhookEventType.OrderCompleted` enum form instead of raw string literals.

### Added

- **`GraphQLResponse.warnings?[]`** — soft warning envelope emitted when query cost approaches the hard limit (graphql-service `v2026.5.11.3`). Each warning carries `message`, `layer`, and `aiHint` (e.g. `REDUCE_QUERY_SIZE`). Server still returns HTTP 200; the next slightly-larger query may be rejected with 400.
- **`GraphQLResponse.errors[].aiHint?`** — actionable agent hint on error items (e.g. `REDUCE_QUERY_SIZE` when query cost exceeds the hard limit).

### Migration

- TypeScript compile errors in webhook event arrays — import `WebhookEventType` and use enum values (or string literals matching the enum) instead of arbitrary strings. Runtime payload unchanged.
- Client logic reading webhook errors / warnings can now surface `aiHint` to operators or feed it back to LLM agents for self-correction.

## [0.6.0] - 2026-05-07

### BREAKING

- **`UpdateStoreParams.webhookSettings` removed** — webhook configuration is no longer managed through `client.stores.update()`. The legacy single-URL JSONB shape (`testWebhookUrl` / `prodWebhookUrl` / `testEvents` / `prodEvents`) has been replaced by a multi-row `store.store_webhooks` table supporting multiple webhooks and multiple channels per store.
- **`WebhookSettings` type removed** from public exports. Replaced by `StoreWebhook`, `WebhookChannel`, and the new `Add/Update/RemoveWebhookParams` types.
- The server's `update-store` endpoint accepts the legacy `webhookSettings` field for backward compatibility but **ignores it** and returns `200` with a top-level `warnings` array containing `WEBHOOK_SETTINGS_IGNORED` and an `aiHint` describing the migration path. Old SDK calls will silently lose webhook updates — upgrade to use the new methods below.

### Added

- **`client.webhooks.add / update / remove`** — manage webhook endpoints (HTTP / Feishu / Discord / Telegram / Slack) via dedicated mutations.
  - `channel` field selects the payload format. HTTP keeps the existing RSA-signed envelope (no breakage on the merchant consumption side); IM platforms render their native card / embed / attachment formats.
  - `secret` field stores channel-specific credentials (e.g. Telegram `chat_id`).
  - Any valid HTTPS URL accepted; merchant ensures the URL matches the chosen channel.
  - Hard-delete; historical `webhook_deliveries` rows are retained with `storeWebhookId = null` for audit.
- **`StoreWebhook`, `WebhookChannel`, `AddWebhookParams`, `UpdateWebhookParams`, `RemoveWebhookParams`** types exported.

### Migration

- **List webhooks**: query GraphQL `Store.storeWebhooks` (filtered automatically by environment via `test_mode`). The SDK does not expose a `list` method — `client.graphql.query` is the only read path, by design.
- **Create/Update/Delete**: replace `client.stores.update({ id, webhookSettings: {...} })` with `client.webhooks.add({...})` / `update({...})` / `remove({ id })`.

## [0.5.2] - 2026-04-22

### Added

- **MIT LICENSE file** — repository now includes the full MIT license text. `LICENSE` is also included in the npm package via the `files` field.

## [0.5.1] - 2026-04-22

### Added

- **`storeName` in `WebhookEventData`** — webhook payloads now include the store name in `data.storeName`. Always present for all transaction events.

## [0.5.0] - 2026-04-18

### Added

- **Enriched `WebhookEventData`** — webhook payloads now include full transaction chain data. New optional fields organized by section:
  - **Order**: `orderStatus`, `merchantProvidedBuyerIdentity`, `billingDetail`, `orderMetadata`
  - **Amount**: `taxRate`, `taxName`, `subtotal`, `total`
  - **Product**: `productDescription`, `productMetadata`
  - **Payment** (payment events only): `paymentId`, `paymentStatus`, `paymentMethod`, `paymentLast4`, `paymentFailureReason`, `paymentDate`
  - **Subscription** (subscription events only): `billingPeriod`, `currentPeriodStart`, `currentPeriodEnd`, `canceledAt`
  - **Refund** (refund events only): `refundStatus`, `refundReason`, `refundCreatedAt`
- All new fields are optional — existing webhook handlers continue to work without changes.

### Documentation

- **Webhook guide** — updated `WebhookEventData` field reference with sectioned layout and conditional field documentation.
- **README** — expanded webhook verification example showing new fields.

## [0.4.2] - 2026-04-16

### Fixed

- **`merchantId` validated at construction** — `WaffoPancake` constructor now validates that `merchantId` matches `MER_{base62}` format (exactly 22 base62 characters after prefix). Previously, malformed values like `MER_1XdxrN8hqc5jBMAnWvVm1W1` (23 chars) or `merchant-123` were silently accepted, passed through to the gateway, and caused cryptic 500 errors from the database layer. Invalid formats now throw `WaffoPancakeError` (`status: 400`, `layer: "sdk"`) immediately.
- **Short ID regex tightened** — All `validateShortId()` checks (affecting `storeId`, `productId`, `orderId`, `paymentId`, `ticketId`, `merchantId`) now enforce exactly 22 base62 characters after the prefix, matching the server-side format. The previous regex (`/[A-Za-z0-9]+/`) accepted any length.

## [0.4.1] - 2026-04-15

### Changed

- **`RefundTicket.versionData` is now structured** — tightened from `Record<string, unknown> | null` to a new `RefundTicketVersionData | null` type matching the GraphQL `RefundTicketVersionData` shape: `{ reason: string; requestedAmount: RequestedAmount | null }`. Aligns with `waffo-pancake-graphql-service` v2026.04.15.1.

### Added

- **`RefundTicketVersionData`** — exported type. Reuses the existing `RequestedAmount` for the nested amount field.

## [0.4.0] - 2026-04-15

### Breaking Changes

- **`buyerEmail` no longer falls back to `buyerIdentity`** — `checkout.authenticated.create({ buyerIdentity, ... })` used to silently copy `buyerIdentity` into the outgoing `buyerEmail` when the caller omitted `buyerEmail`. It no longer does. `buyerIdentity` is for the JWT (merchant-side buyer identification) and `buyerEmail` is for pre-filling the checkout page's email input; the two fields are fully independent. Migration: if you were passing a non-email `buyerIdentity` (e.g. an internal user ID) and relying on the email input being pre-filled, pass `buyerEmail: user.email` explicitly alongside `buyerIdentity`.

### Changed

- **`AnonymousCheckoutParams` widened to full session params** — now accepts `buyerEmail` and `billingDetail` so merchants can pre-fill the checkout page without issuing a session token. Equivalent to `CreateCheckoutSessionParams`.
- **`AuthenticatedCheckoutParams` restructured** — now extends `CreateCheckoutSessionParams` with a single extra field `buyerIdentity`. Implementation uses destructure-and-forward so `buyerIdentity` can never leak into the create-session payload.

### Documentation

- **JSDoc rewrites** — `IssueSessionTokenParams.buyerIdentity`, `AuthenticatedCheckoutParams.buyerIdentity`, and both checkout wrappers now clearly state that `buyerIdentity` is JWT-only and is never rendered on the checkout page.

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

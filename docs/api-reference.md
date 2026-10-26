# API Reference

Complete reference for all `@waffo/pancake-ts` resources, parameters, and return types.

> **Conventions**:
>
> - All amounts are in the **smallest currency unit** (e.g. 999 = $9.99 USD, 4500 = ¥4500 JPY)
> - All timestamps are **ISO 8601 UTC** strings
> - Product updates follow **immutable versioning** — only provided fields are updated (omitted fields are preserved), each update creates a new version, skipped if content is unchanged
> - The **publish** flow promotes a test version to production
> - Every write method takes an optional `RequestOptions` as its **last argument**; its only field today is `idempotencyKey`. No key is sent unless you pass one — see [Idempotency](#idempotency)

---

## Auth

### `client.auth.issueSessionToken(params)`

Issue a customer session token (JWT) for storefront authentication.

```typescript
// With storeId
const { token, expiresAt } = await client.auth.issueSessionToken({
  storeId: "STO_xxx",
  buyerIdentity: "customer@example.com",
});

// With productId (server derives storeId from the product)
const { token, expiresAt } = await client.auth.issueSessionToken({
  productId: "PROD_xxx",
  buyerIdentity: "customer@example.com",
});
```

**Parameters `IssueSessionTokenParams`**:

| Field           | Type     | Required | Description                                                                                      |
| --------------- | -------- | -------- | ------------------------------------------------------------------------------------------------ |
| `storeId`       | `string` | No       | Store ID (at least one of `storeId` / `productId` required)                                      |
| `productId`     | `string` | No       | Product ID (at least one of `storeId` / `productId` required; server derives store from product) |
| `buyerIdentity` | `string` | Yes      | Customer identity (email or merchant-defined identifier)                                         |

**Returns `SessionToken`**:

| Field       | Type     | Description           |
| ----------- | -------- | --------------------- |
| `token`     | `string` | JWT token string      |
| `expiresAt` | `string` | Token expiration time |

### `client.auth.createCustomerPortalLink(params, options?)`

Create a link that signs a customer into your store's Pancake customer portal without email verification. Calls `issue-session-token` with `purpose: "portal"` and appends the returned token to the portal URL as a fragment (`#token=...`).

```typescript
const { portalUrl, expiresAt } = await client.auth.createCustomerPortalLink({
  storeId: "STO_xxx",
  buyerIdentity: session.user.id, // from YOUR authenticated session
});
// 302-redirect the browser to portalUrl
// => "https://pancake.waffo.ai/consumer/portal/store/STO_xxx#token=eyJ..."
```

**Parameters `CreateCustomerPortalLinkParams`**:

| Field           | Type     | Required | Description                                                                                  |
| --------------- | -------- | -------- | -------------------------------------------------------------------------------------------- |
| `storeId`       | `string` | Yes      | Store ID (`STO_xxx`)                                                                         |
| `buyerIdentity` | `string` | Yes      | Customer identity in your system — the same value used for `checkout.authenticated.create()` |

**Returns `CustomerPortalLink`**:

| Field       | Type     | Description                                                             |
| ----------- | -------- | ----------------------------------------------------------------------- |
| `portalUrl` | `string` | Portal URL with the session token appended as a fragment (`#token=...`) |
| `expiresAt` | `string` | Session token expiration time                                           |

- **Environment** is the API Key's environment (test key → test portal, prod key → prod portal); it is not a parameter.
- **Security**: `storeId` and `buyerIdentity` must come from your backend's authenticated session, never from browser input. `portalUrl` carries a bearer token — redirect immediately, send `Cache-Control: no-store` and `Referrer-Policy: no-referrer` on the redirect, and do not log it.
- **Errors**: invalid `storeId` / empty `buyerIdentity` throw `WaffoPancakeError` (400, `layer: "sdk"`) before any request; a response without `portalUrl` or `token` throws `WaffoPancakeError` with `layer: "sdk"`.

---

## Stores

### `client.stores.create(params)`

Create a store. The URL slug is auto-generated from the name.

```typescript
const { store } = await client.stores.create({ name: "My Store" });
```

**Parameters `CreateStoreParams`**:

| Field  | Type     | Required | Description                                         |
| ------ | -------- | -------- | --------------------------------------------------- |
| `name` | `string` | Yes      | Store name (1–48 characters, trimmed automatically) |

**Returns `{ store: Store }`**

### `client.stores.update(params)`

Update store settings including webhook endpoints, notification preferences, and checkout page styling.

```typescript
const { store } = await client.stores.update({
  id: "STO_xxx",
  name: "Updated Name",
  supportEmail: "help@example.com",
  webhookSettings: {
    testWebhookUrl: "https://example.com/webhooks",
    prodWebhookUrl: null,
    testEvents: ["order.completed", "subscription.created"],
    prodEvents: [],
  },
  notificationSettings: {
    notifyNewOrders: true,
    notifyNewSubscriptions: true,
    // The two consumer emails a merchant may switch off, both per store. The
    // other `email*` toggles are platform-managed and dropped with a warning
    // if passed.
    emailUpcomingCharge: false,
    emailTrialEnding: false,
  },
  checkoutSettings: {
    light: {
      checkoutLogo: null,
      checkoutColorPrimary: "#000000",
      checkoutColorBackground: "#ffffff",
      checkoutColorCard: "#f5f5f5",
      checkoutColorText: "#000000",
      checkoutBorderRadius: "8px",
    },
    dark: {
      checkoutLogo: null,
      checkoutColorPrimary: "#ffffff",
      checkoutColorBackground: "#1a1a1a",
      checkoutColorCard: "#2a2a2a",
      checkoutColorText: "#ffffff",
      checkoutBorderRadius: "8px",
    },
  },
});
```

**Parameters `UpdateStoreParams`**:

| Field                  | Type                                                    | Required | Description                                                                                                                                                                                                                                                                             |
| ---------------------- | ------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                   | `string`                                                | Yes      | Store ID                                                                                                                                                                                                                                                                                |
| `name`                 | `string`                                                | No       | Store name (1–100 characters)                                                                                                                                                                                                                                                           |
| `status`               | `EntityStatus`                                          | No       | Store status                                                                                                                                                                                                                                                                            |
| `logo`                 | `string \| null`                                        | No       | Logo (Base64 encoded image)                                                                                                                                                                                                                                                             |
| `supportEmail`         | `string \| null`                                        | No       | Support email address                                                                                                                                                                                                                                                                   |
| `website`              | `string \| null`                                        | No       | Store website URL                                                                                                                                                                                                                                                                       |
| `webhookSettings`      | `WebhookSettings \| null`                               | No       | Webhook endpoint configuration (test/prod URLs and subscribed event types)                                                                                                                                                                                                              |
| `notificationSettings` | `Partial<MerchantWritableNotificationSettings> \| null` | No       | Notification preferences: every `notify*` toggle plus the two customer reminders `emailUpcomingCharge` and `emailTrialEnding`. The other `email*` toggles are platform-managed and dropped with a `warnings` entry. Passing `null` clears the writable keys back to their default of on |
| `checkoutSettings`     | `CheckoutSettings \| null`                              | No       | Checkout page theme (light/dark)                                                                                                                                                                                                                                                        |

**Returns `{ store: Store }`**

### `client.stores.delete(params)`

Soft-delete a store. Only the store owner can perform this operation.

```typescript
const { store } = await client.stores.delete({ id: "STO_xxx" });
```

**Parameters `DeleteStoreParams`**:

| Field | Type     | Required | Description |
| ----- | -------- | -------- | ----------- |
| `id`  | `string` | Yes      | Store ID    |

**Returns `{ store: Store }`**

---

## Store Merchants

> Coming soon — endpoints currently return 501.

### `client.storeMerchants.add(params)`

Add a merchant to a store with a specified role.

```typescript
const result = await client.storeMerchants.add({
  storeId: "STO_xxx",
  email: "member@example.com",
  role: "admin",
});
```

**Parameters `AddMerchantParams`**:

| Field     | Type                  | Required | Description    |
| --------- | --------------------- | -------- | -------------- |
| `storeId` | `string`              | Yes      | Store ID       |
| `email`   | `string`              | Yes      | Merchant email |
| `role`    | `"admin" \| "member"` | Yes      | Role to assign |

**Returns `AddMerchantResult`**:

| Field        | Type     | Description          |
| ------------ | -------- | -------------------- |
| `storeId`    | `string` | Store ID             |
| `merchantId` | `string` | Merchant ID          |
| `email`      | `string` | Merchant email       |
| `role`       | `string` | Assigned role        |
| `status`     | `string` | Membership status    |
| `addedAt`    | `string` | Timestamp when added |

### `client.storeMerchants.remove(params)`

Remove a merchant from a store.

```typescript
const result = await client.storeMerchants.remove({
  storeId: "STO_xxx",
  merchantId: "MER_xxx",
});
```

**Parameters `RemoveMerchantParams`**:

| Field        | Type     | Required | Description |
| ------------ | -------- | -------- | ----------- |
| `storeId`    | `string` | Yes      | Store ID    |
| `merchantId` | `string` | Yes      | Merchant ID |

**Returns `RemoveMerchantResult`**:

| Field       | Type     | Description            |
| ----------- | -------- | ---------------------- |
| `message`   | `string` | Operation message      |
| `removedAt` | `string` | Timestamp when removed |

### `client.storeMerchants.updateRole(params)`

Update a merchant's role within a store.

```typescript
const result = await client.storeMerchants.updateRole({
  storeId: "STO_xxx",
  merchantId: "MER_xxx",
  role: "member",
});
```

**Parameters `UpdateRoleParams`**:

| Field        | Type                  | Required | Description |
| ------------ | --------------------- | -------- | ----------- |
| `storeId`    | `string`              | Yes      | Store ID    |
| `merchantId` | `string`              | Yes      | Merchant ID |
| `role`       | `"admin" \| "member"` | Yes      | New role    |

**Returns `UpdateRoleResult`**:

| Field        | Type     | Description            |
| ------------ | -------- | ---------------------- |
| `storeId`    | `string` | Store ID               |
| `merchantId` | `string` | Merchant ID            |
| `role`       | `string` | Updated role           |
| `updatedAt`  | `string` | Timestamp when updated |

---

## Onetime Products

### `client.onetimeProducts.create(params)`

Create a one-time product with multi-currency pricing.

```typescript
import { TaxCategory } from "@waffo/pancake-ts";

const { product } = await client.onetimeProducts.create({
  storeId: "STO_xxx",
  name: "E-Book: TypeScript Handbook",
  description: "Complete TypeScript guide for developers",
  prices: {
    USD: { amount: "29.00", taxCategory: TaxCategory.DigitalGoods },
    EUR: { amount: "27.00", taxCategory: TaxCategory.DigitalGoods },
    JPY: { amount: "4500", taxCategory: TaxCategory.DigitalGoods },
  },
  media: [{ type: "image", url: "https://example.com/cover.jpg", alt: "Book cover" }],
  successUrl: "https://example.com/thank-you",
  metadata: { sku: "ebook-ts-001" },
});
```

**Parameters `CreateOnetimeProductParams`**:

| Field         | Type                      | Required | Description                                         |
| ------------- | ------------------------- | -------- | --------------------------------------------------- |
| `storeId`     | `string`                  | Yes      | Store ID                                            |
| `name`        | `string`                  | Yes      | Product name                                        |
| `prices`      | `Prices`                  | Yes      | Multi-currency prices (`Record<string, PriceInfo>`) |
| `description` | `string`                  | No       | Product description                                 |
| `media`       | `MediaItem[]`             | No       | Media assets (images, videos)                       |
| `successUrl`  | `string`                  | No       | Redirect URL after successful payment               |
| `metadata`    | `Record<string, unknown>` | No       | Custom metadata                                     |

**Returns `{ product: OnetimeProductDetail }`**

### `client.onetimeProducts.update(params)`

Update a one-time product. Creates a new immutable version; skips if content is unchanged.

> Only `id` is required. Omitted fields keep their current values.

```typescript
// Update only the name
const { product } = await client.onetimeProducts.update({
  id: "PROD_xxx",
  name: "E-Book: TypeScript Handbook v2",
});

// Update only the prices
const { product: p2 } = await client.onetimeProducts.update({
  id: "PROD_xxx",
  prices: { USD: { amount: "39.00", taxCategory: "digital_goods" } },
});
```

**Parameters `UpdateOnetimeProductParams`**:

| Field         | Type                      | Required | Description                           |
| ------------- | ------------------------- | -------- | ------------------------------------- |
| `id`          | `string`                  | Yes      | Product ID                            |
| `name`        | `string`                  | No       | Product name                          |
| `prices`      | `Prices`                  | No       | Multi-currency prices                 |
| `description` | `string`                  | No       | Product description                   |
| `media`       | `MediaItem[]`             | No       | Media assets                          |
| `successUrl`  | `string`                  | No       | Redirect URL after successful payment |
| `metadata`    | `Record<string, unknown>` | No       | Custom metadata                       |

**Returns `{ product: OnetimeProductDetail }`**

### `client.onetimeProducts.publish(params)`

Publish the test version to production.

```typescript
const { product } = await client.onetimeProducts.publish({ id: "PROD_xxx" });
```

**Parameters `PublishOnetimeProductParams`**:

| Field | Type     | Required | Description |
| ----- | -------- | -------- | ----------- |
| `id`  | `string` | Yes      | Product ID  |

**Returns `{ product: OnetimeProductDetail }`**

### `client.onetimeProducts.updateStatus(params)`

Activate or deactivate a product.

```typescript
import { ProductVersionStatus } from "@waffo/pancake-ts";

const { product } = await client.onetimeProducts.updateStatus({
  id: "PROD_xxx",
  status: ProductVersionStatus.Inactive,
});
```

**Parameters `UpdateOnetimeStatusParams`**:

| Field    | Type                   | Required | Description            |
| -------- | ---------------------- | -------- | ---------------------- |
| `id`     | `string`               | Yes      | Product ID             |
| `status` | `ProductVersionStatus` | Yes      | `Active` or `Inactive` |

**Returns `{ product: OnetimeProductDetail }`**

---

## Subscription Products

### `client.subscriptionProducts.create(params)`

Create a subscription product with a billing period and multi-currency pricing.

```typescript
import { BillingPeriod, TaxCategory } from "@waffo/pancake-ts";

const { product } = await client.subscriptionProducts.create({
  storeId: "STO_xxx",
  name: "Pro Plan",
  billingPeriod: BillingPeriod.Monthly,
  prices: { USD: { amount: "9.99", taxCategory: TaxCategory.SaaS } },
  description: "Unlimited access to all features",
});
```

**Parameters `CreateSubscriptionProductParams`**:

| Field           | Type                      | Required | Description                                                    |
| --------------- | ------------------------- | -------- | -------------------------------------------------------------- |
| `storeId`       | `string`                  | Yes      | Store ID                                                       |
| `name`          | `string`                  | Yes      | Product name                                                   |
| `billingPeriod` | `BillingPeriod`           | Yes      | Billing period (`Weekly` / `Monthly` / `Quarterly` / `Yearly`) |
| `prices`        | `Prices`                  | Yes      | Multi-currency prices                                          |
| `description`   | `string`                  | No       | Product description                                            |
| `media`         | `MediaItem[]`             | No       | Media assets                                                   |
| `successUrl`    | `string`                  | No       | Redirect URL after successful payment                          |
| `metadata`      | `Record<string, unknown>` | No       | Custom metadata                                                |

**Returns `{ product: SubscriptionProductDetail }`**

### `client.subscriptionProducts.update(params)`

Update a subscription product. Creates a new immutable version; skips if unchanged.

> Only `id` is required. Omitted fields keep their current values.

```typescript
// Update only the name
const { product } = await client.subscriptionProducts.update({
  id: "PROD_xxx",
  name: "Pro Plan v2",
});

// Update billing period and prices
const { product: p2 } = await client.subscriptionProducts.update({
  id: "PROD_xxx",
  billingPeriod: BillingPeriod.Yearly,
  prices: { USD: { amount: "99.00", taxCategory: "saas" } },
});
```

**Parameters `UpdateSubscriptionProductParams`**:

| Field           | Type                      | Required | Description                           |
| --------------- | ------------------------- | -------- | ------------------------------------- |
| `id`            | `string`                  | Yes      | Product ID                            |
| `name`          | `string`                  | No       | Product name                          |
| `billingPeriod` | `BillingPeriod`           | No       | Billing period                        |
| `prices`        | `Prices`                  | No       | Multi-currency prices                 |
| `description`   | `string`                  | No       | Product description                   |
| `media`         | `MediaItem[]`             | No       | Media assets                          |
| `successUrl`    | `string`                  | No       | Redirect URL after successful payment |
| `metadata`      | `Record<string, unknown>` | No       | Custom metadata                       |

**Returns `{ product: SubscriptionProductDetail }`**

### `client.subscriptionProducts.publish(params)`

Publish the test version to production.

```typescript
const { product } = await client.subscriptionProducts.publish({ id: "PROD_xxx" });
```

**Returns `{ product: SubscriptionProductDetail }`**

### `client.subscriptionProducts.updateStatus(params)`

Activate or deactivate a subscription product.

```typescript
const { product } = await client.subscriptionProducts.updateStatus({
  id: "PROD_xxx",
  status: ProductVersionStatus.Active,
});
```

**Returns `{ product: SubscriptionProductDetail }`**

---

## Subscription Product Groups

Groups enable **shared trial periods** and **plan switching** across related subscription products (e.g. Free / Pro / Enterprise tiers).

> **Note**: Group IDs are UUIDs (not Short IDs). The `id` field in responses and the `id` parameter in requests use raw UUID format.

### `client.subscriptionProductGroups.create(params)`

```typescript
const { group } = await client.subscriptionProductGroups.create({
  storeId: "STO_xxx",
  name: "Pro Plans",
  description: "All Pro tier plans",
  rules: { sharedTrial: true, selfServicePlanChange: true },
  productIds: ["PROD_aaa", "PROD_bbb"],
});
```

**Parameters `CreateSubscriptionProductGroupParams`**:

| Field         | Type              | Required | Description                                                                                                                                                                                                    |
| ------------- | ----------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storeId`     | `string`          | Yes      | Store ID                                                                                                                                                                                                       |
| `name`        | `string`          | Yes      | Group name                                                                                                                                                                                                     |
| `description` | `string`          | No       | Group description                                                                                                                                                                                              |
| `rules`       | `GroupRulesInput` | No       | Group switches, each optional: `sharedTrial` shares the trial across the group, `selfServicePlanChange` lets customers change plan within the group from the customer portal. A switch left out is created off |
| `productIds`  | `string[]`        | No       | Subscription product IDs to include                                                                                                                                                                            |

**Returns `{ group: SubscriptionProductGroup }`**

### `client.subscriptionProductGroups.update(params)`

Update a group. `productIds` is a **full replacement** (not a merge); `rules` is the opposite — it is merged switch by switch, so a switch you leave out keeps its stored value.

```typescript
const { group } = await client.subscriptionProductGroups.update({
  id: "spg_xxx",
  productIds: ["PROD_aaa", "PROD_bbb", "PROD_ccc"],
});

// Open self-service plan change without touching sharedTrial
const { group: opened } = await client.subscriptionProductGroups.update({
  id: "spg_xxx",
  rules: { selfServicePlanChange: true },
});
// opened.rules => { sharedTrial: <stored value>, selfServicePlanChange: true }
```

**Returns `{ group: SubscriptionProductGroup }`** — `group.rules` always carries both switches, so reading one never needs a fallback.

### `client.subscriptionProductGroups.delete(params)`

Hard-delete a group.

```typescript
const { group } = await client.subscriptionProductGroups.delete({ id: "spg_xxx" });
```

**Returns `{ group: SubscriptionProductGroup }`**

### `client.subscriptionProductGroups.publish(params)`

Publish a test-environment group to production (upsert).

```typescript
const { group } = await client.subscriptionProductGroups.publish({ id: "spg_xxx" });
```

**Returns `{ group: SubscriptionProductGroup }`**

---

## Coupons

A coupon defines a discount and has its own `code` that buyers can enter (random when omitted). Its only redemption limits are `redeemBy` and `maxRedemptions` (total across all its codes); buyer restrictions belong to promotion codes — create up to 20 of them together with the coupon (`promotionCodes`) and add more later with [`client.promotionCodes`](#promotion-codes). A coupon applied with `couponId` on a checkout or plan change session needs no code. Codes are 3–32 letters, digits or `-`, case-insensitive (surrounding whitespace is trimmed and the code is stored uppercase), and unique among the store's **active** codes in the same environment; a deactivated code is released and can be reused. Deactivation is permanent. Only the name of a coupon can change — create a new coupon to change the discount.

Server-side only: requests are signed with your private key. List and read coupons with [`client.graphql.query`](#graphql) (`coupons`, `couponsCount`, `coupon`).

### `client.coupons.create(params, options?)`

```typescript
import { CouponDiscountType, CouponDuration } from "@waffo/pancake-ts";

const { coupon } = await client.coupons.create(
  {
    storeId: "STO_xxx",
    name: "Black Friday 20% off",
    discount: { type: CouponDiscountType.Percentage, percentOff: 20 },
    duration: CouponDuration.Repeating,
    durationInPeriods: 3,
    code: "BF2026",
    maxRedemptions: 1000,
    promotionCodes: [{ code: "BF-VIP" }, { restrictions: { maxRedemptions: 100, perCustomerLimit: 1 } }],
  },
  { idempotencyKey: "coupon-bf2026" },
);
// coupon.status => CouponStatus.Active (a successful creation is always active)
// coupon.code => "BF2026" (random when omitted)
// coupon.promotionCodes.map((p) => p.code) => ["BF-VIP", "X7K2M9PQ4R"] (random when `code` is omitted)
```

**Parameters `CreateCouponParams`**:

| Field               | Type                                | Required         | Description                                                                                                                                                                                                                                                        |
| ------------------- | ----------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `storeId`           | `string`                            | Yes              | Store ID                                                                                                                                                                                                                                                           |
| `name`              | `string`                            | Yes              | Internal name (≤ 64 characters), not visible to buyers                                                                                                                                                                                                             |
| `code`              | `string`                            | No               | The coupon's own code buyers can enter; random (10 characters) when omitted, and must not repeat a code in `promotionCodes`                                                                                                                                        |
| `discount`          | `CouponDiscount`                    | Yes              | `{ type: CouponDiscountType.Percentage, percentOff }` (0 < x ≤ 100) or `{ type: CouponDiscountType.FixedAmount, amountOff: { USD: "5.00" } }` (each amount > 0)                                                                                                    |
| `duration`          | `CouponDuration`                    | No               | `Once` (default), `Repeating` or `Forever` — how many subscription periods get the discount                                                                                                                                                                        |
| `durationInPeriods` | `number`                            | When `Repeating` | Number of billing periods                                                                                                                                                                                                                                          |
| `productIds`        | `string[]`                          | No               | Restrict to these products; empty means the whole store                                                                                                                                                                                                            |
| `maxRedemptions`    | `number \| null`                    | No               | Total redemption limit across the coupon's code and all its promotion codes; refunds do not give uses back                                                                                                                                                         |
| `redeemBy`          | `string \| null`                    | No               | Expiry (ISO 8601). Discounts already attached to subscriptions also end at this time                                                                                                                                                                               |
| `promotionCodes`    | `CreateCouponPromotionCodeParams[]` | No               | 0–20 promotion codes created in the same request, each `{ code?, restrictions? }` with the same rules as [`promotionCodes.create`](#clientpromotioncodescreateparams-options); `code` is random (10 characters) when omitted and must be unique within the request |

**Returns `{ coupon: CreatedCouponDetail }`** — the coupon with its `code` and `promotionCodes` (the codes created in this request, in request order). Errors: 400 for duplicate codes in the request or a promotion code limit beyond the coupon's (the message names `promotionCodes[i]`), 409 when a code is taken — the message names it (also when retrying a request that succeeded **without** the idempotency key, because the first request already took the codes), 502 when the payment provider rejects the coupon or does not confirm the creation — the creation failed and every code is released, so retry with the same codes.

### `client.coupons.update(params, options?)`

Rename a coupon — the only field that can change.

```typescript
const { coupon } = await client.coupons.update({ id: "CPN_xxx", name: "Black Friday (extended)" });
```

### `client.coupons.deactivate(params, options?)`

Deactivate permanently. All its promotion codes are deactivated and their codes released. Discounts already attached to subscriptions continue until the subscription's next plan change. Calling it again returns the coupon unchanged.

```typescript
const { coupon } = await client.coupons.deactivate({ id: "CPN_xxx" });
```

---

## Promotion Codes

Promotion codes point to a coupon and carry the buyer restrictions; the coupon's `redeemBy` and `maxRedemptions` apply to every code.

### `client.promotionCodes.create(params, options?)`

```typescript
const { promotionCode } = await client.promotionCodes.create({
  couponId: "CPN_xxx",
  code: "KOL-ALICE", // optional; a random code is generated when omitted
  restrictions: { maxRedemptions: 100, minimumAmount: { USD: "50.00" } },
});
```

**`PromotionCodeRestrictions`**: `customerEmails`, `perCustomerLimit`, `maxRedemptions` (≤ the coupon's), `expiresAt` (≤ the coupon's `redeemBy`; defaults to it), `minimumAmount` (pre-discount, pre-tax amount per currency; currencies not listed have no minimum).

**Returns `{ promotionCode: PromotionCodeDetail }`**. Errors: 409 when the code is taken, the coupon is not `Active`, or the coupon has expired (its `redeemBy` is within 60 seconds) — no promotion code can be added to it.

### `client.promotionCodes.generate(params, options?)`

Generate 1–500 random codes in one call. Random parts use letters and digits without `0 O 1 I L`.

```typescript
const { batchId, promotionCodes } = await client.promotionCodes.generate(
  { couponId: "CPN_xxx", count: 100, prefix: "KOL-", length: 10, restrictions: { maxRedemptions: 1 } },
  { idempotencyKey: "kol-batch-2026-11" },
);
```

> **Always retry with the same idempotency key.** Codes are random, so a retry without it generates another batch.

**Returns `{ batchId: string, promotionCodes: PromotionCodeDetail[] }`**

### `client.promotionCodes.deactivate(params, options?)`

Deactivate permanently and release the code. The coupon stays active; deactivate the coupon to stop it entirely.

```typescript
const { promotionCode } = await client.promotionCodes.deactivate({ id: "PMC_xxx" });
```

---

## Orders

### `client.orders.cancelSubscription(params)`

Cancel a subscription order. The resulting status depends on the current order state:

| Current Status        | Result      | Behavior                                                 |
| --------------------- | ----------- | -------------------------------------------------------- |
| `pending`             | `canceled`  | Immediate cancellation                                   |
| `active` / `trialing` | `canceling` | PSP cancellation initiated; webhook updates status later |

```typescript
const { orderId, status } = await client.orders.cancelSubscription({
  orderId: "ORD_xxx",
});
// status: "canceled" or "canceling"
```

**Parameters `CancelSubscriptionParams`**:

| Field     | Type     | Required | Description |
| --------- | -------- | -------- | ----------- |
| `orderId` | `string` | Yes      | Order ID    |

**Returns `CancelSubscriptionResult`**:

| Field     | Type     | Description                                      |
| --------- | -------- | ------------------------------------------------ |
| `orderId` | `string` | Order ID                                         |
| `status`  | `string` | Resulting status (`"canceled"` or `"canceling"`) |

---

## Customer Self-Service

Issue a session token and create a customer session to let customers manage their own orders.

### `client.customer(token, options?)`

Create a customer session from a session token issued by `client.auth.issueSessionToken()`.

```typescript
const { token } = await client.auth.issueSessionToken({
  storeId: "STO_xxx",
  buyerIdentity: "customer@example.com",
});
const customer = client.customer(token, { environment: "test" });
```

| Option        | Type               | Required                        | Description                                      |
| ------------- | ------------------ | ------------------------------- | ------------------------------------------------ |
| `environment` | `"test" \| "prod"` | Unless set on the client config | Sent as `X-Environment` on every session request |

An environment must come from either `options.environment` or
`WaffoPancakeConfig.environment` — the session token carries none of its own, and
the gateway rejects a Bearer credential without the header. There is no default:
guessing would route the call to the other environment. When neither supplies
one, this throws `WaffoPancakeError` (400, `layer: "sdk"`).

Session tokens expire 5 minutes after issuance — issue one right before use
rather than caching it.

### `customer.cancelSubscription(params)`

| Field     | Type     | Required | Description           |
| --------- | -------- | -------- | --------------------- |
| `orderId` | `string` | Yes      | Subscription order ID |

**Returns `CancelSubscriptionResult`**: `{ orderId, status }` — status is `"canceling"` (active) or `"canceled"` (pending)

### `customer.cancelOnetimeOrder(params)`

| Field     | Type     | Required | Description       |
| --------- | -------- | -------- | ----------------- |
| `orderId` | `string` | Yes      | One-time order ID |

**Returns `CancelOnetimeOrderResult`**: `{ orderId, status }` — status is `"canceled"`

### `customer.reactivateSubscription(params)`

| Field     | Type     | Required | Description                                           |
| --------- | -------- | -------- | ----------------------------------------------------- |
| `orderId` | `string` | Yes      | Subscription order ID (must be in `canceling` status) |

**Returns `ReactivateSubscriptionResult`**: `{ orderId, status }` — status is `"active"`

### `customer.createRefundTicket(params)`

| Field                            | Type                      | Required | Description                                                                                                                                                                                       |
| -------------------------------- | ------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `paymentId`                      | `string`                  | Yes      | Payment ID to refund                                                                                                                                                                              |
| `reason`                         | `string`                  | Yes      | Reason for the refund request                                                                                                                                                                     |
| `requestedAmount`                | `RequestedAmount`         | Yes      | Refund amount (`{ amount, currency }`)                                                                                                                                                            |
| `metadata`                       | `Record<string, unknown>` | No       | Custom metadata                                                                                                                                                                                   |
| `refundTicketMerchantExternalId` | `string`                  | No       | Your business-side refund-ticket identifier (max 128 chars). Surfaces under the same name in webhook payload (`data.refundTicketMerchantExternalId`) and GraphQL `RefundTicket` / `Refund` types. |

**`RequestedAmount`**:

| Field      | Type     | Description                                |
| ---------- | -------- | ------------------------------------------ |
| `amount`   | `string` | Amount in display format (e.g., `"29.00"`) |
| `currency` | `string` | Currency code (ISO 4217)                   |

**Returns `{ ticket: RefundTicket }`**

### `customer.resubmitRefundTicket(params)`

| Field             | Type              | Required | Description           |
| ----------------- | ----------------- | -------- | --------------------- |
| `ticketId`        | `string`          | Yes      | Existing ticket ID    |
| `paymentId`       | `string`          | Yes      | Payment ID            |
| `reason`          | `string`          | Yes      | Updated reason        |
| `requestedAmount` | `RequestedAmount` | Yes      | Updated refund amount |

**Returns `{ ticket: RefundTicket }`**

### `customer.createPlanChangeSession(params)`

The self-service half of a plan change: the customer switches one of their own subscriptions to another plan in the same group. Same `create-session` endpoint as the merchant methods, reached with the customer session token.

```typescript
const session = await customer.createPlanChangeSession({
  originOrderId: "ORD_xxx",
  productId: "PROD_target_plan",
  currency: "USD",
  changeTiming: ChangeTiming.NextPeriod,
});
// Send the customer to session.checkoutUrl
```

**Parameters `CustomerPlanChangeParams`**:

| Field           | Type           | Required | Description                                                         |
| --------------- | -------------- | -------- | ------------------------------------------------------------------- |
| `originOrderId` | `string`       | Yes      | The customer's own subscription being changed (`ORD_xxx`)           |
| `productId`     | `string`       | Yes      | Target plan — must be in the same product group as the current plan |
| `currency`      | `string`       | Yes      | Currency code (ISO 4217); must match the origin subscription        |
| `changeTiming`  | `ChangeTiming` | No       | `Immediate` or `NextPeriod`; omit to let the platform derive it     |
| `successUrl`    | `string`       | No       | Redirect URL after the change is confirmed and paid                 |
| `darkMode`      | `boolean`      | No       | Dark mode override                                                  |
| `language`      | `string`       | No       | Confirmation page language (IETF BCP 47)                            |

The merchant-only fields (`changeAmount`, `changeCreditAmount`, `withTrial`, `priceSnapshot`, `expiresInSeconds`, `metadata`, `orderMerchantExternalId`, `includePaymentMethods`, `excludePaymentMethods`) are **not** on this type. A customer-session request carries no merchant id, so the platform drops all of them without reporting it — accepting them here would only look like they worked.

Three platform checks apply to this path and not to merchant-issued links, each a 403:

| Check                                      | Message when it fails                                              |
| ------------------------------------------ | ------------------------------------------------------------------ |
| The subscription belongs to this customer  | `Subscription order does not belong to this credential`            |
| Target plan is in the same product group   | `Target plan is not in the same product group as the current plan` |
| That group's `selfServicePlanChange` is on | `Self-service plan change is not enabled for this product group`   |

**Returns `CheckoutSessionResult`**

### `customer.graphql.query<T>(params)`

Same parameters as `client.graphql.query<T>()` but scoped to the customer's own data via session token.

| Field       | Type                      | Required | Description          |
| ----------- | ------------------------- | -------- | -------------------- |
| `query`     | `string`                  | Yes      | GraphQL query string |
| `variables` | `Record<string, unknown>` | No       | Query variables      |

**Returns `GraphQLResponse<T>`**: `{ data, errors? }`

---

## Checkout

Waffo supports two checkout modes based on whether the merchant knows the customer's identity at checkout time:

- **Authenticated** — the merchant has a user system or collects customer info before checkout. The customer's identity is provided upfront, the checkout form is pre-filled, and a session token is automatically issued.
- **Anonymous** — the customer arrives via a template store or shared link with no prior context. They fill in billing details manually on the checkout page.

> **Authenticated checkout is recommended.** The key advantage: the order is bound to the `buyerIdentity` you provide — a **merchant-controlled stable identifier**. Even if the customer changes the email on the checkout form, the order stays tied to your identifier. In anonymous mode, the customer self-reports their email, and a different address means a different user — **previous orders become unlinked** and **subscription trial periods can be exploited** (new email = new user = fresh trial). Additionally, anonymous checkout only supports creating orders — customers cannot cancel orders, manage subscriptions, or submit refund tickets afterward.

Changing the plan of an existing subscription is a third flow with its own pair of methods — `checkout.createPlanChangeSession()` and `checkout.authenticated.createPlanChange()`.

For advanced use cases, the low-level `createSession()` is also available.

### `client.checkout.authenticated.create(params)`

Authenticated checkout — the merchant provides customer identity. The SDK issues a session token, creates a checkout session, and returns a checkout URL with the token appended as a URL fragment (`#token=...`). The checkout page pre-fills customer information from the token.

Internally calls `POST /v1/actions/auth/issue-session-token` and `POST /v1/actions/checkout/create-session` in parallel.

`buyerIdentity` is for order attribution and trial tracking only — it is not rendered on the checkout page. To pre-fill the email field on the checkout form, pass `buyerEmail` explicitly.

```typescript
// One-time product with customer identity (checkout page email field stays empty)
const result = await client.checkout.authenticated.create({
  productId: "PROD_xxx",
  currency: "USD",
  buyerIdentity: "userIdInYourSystem",
  successUrl: "https://example.com/thank-you",
});
// => redirect customer to result.checkoutUrl (includes #token=...)

// Subscription with trial and billing detail
const subResult = await client.checkout.authenticated.create({
  productId: "PROD_yyy",
  currency: "USD",
  buyerIdentity: "userIdInYourSystem",
  buyerEmail: "customer@example.com",
  withTrial: true,
  billingDetail: { country: "US", isBusiness: false, state: "CA", postcode: "94105" },
});
```

**Parameters `AuthenticatedCheckoutParams`**:

| Field                     | Type                     | Required | Description                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------- | ------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `productId`               | `string`                 | Yes      | Product ID (product type is auto-detected server-side)                                                                                                                                                                                                                                                                                                                                              |
| `currency`                | `string`                 | Yes      | Currency code (ISO 4217)                                                                                                                                                                                                                                                                                                                                                                            |
| `buyerIdentity`           | `string`                 | Yes      | Customer identity (email or merchant-defined identifier)                                                                                                                                                                                                                                                                                                                                            |
| `buyerEmail`              | `string`                 | No       | Pre-fill checkout page email field (independent from `buyerIdentity`)                                                                                                                                                                                                                                                                                                                               |
| `billingDetail`           | `BillingDetail`          | No       | Pre-filled billing details. Passing this couples the cashier to the order's billing country: it then offers only that country's payment market and the customer cannot switch. The country that applies is the one on the finished order, not the one you sent; a country outside the payment markets we cover applies no restriction. Omit to leave the cashier unrestricted.                      |
| `priceSnapshot`           | `PriceInfo`              | No       | Price snapshot override (reads from DB if omitted)                                                                                                                                                                                                                                                                                                                                                  |
| `withTrial`               | `boolean`                | No       | Enable trial period (subscription only)                                                                                                                                                                                                                                                                                                                                                             |
| `successUrl`              | `string`                 | No       | Redirect URL after successful payment                                                                                                                                                                                                                                                                                                                                                               |
| `expiresInSeconds`        | `number`                 | No       | Session expiry in seconds (default: 24 hours, recommended: 60 to 604800 / 1 min to 7 days)                                                                                                                                                                                                                                                                                                          |
| `darkMode`                | `boolean`                | No       | Dark mode override (true=dark, false=light, omit=store default)                                                                                                                                                                                                                                                                                                                                     |
| `metadata`                | `Record<string, string>` | No       | Custom metadata                                                                                                                                                                                                                                                                                                                                                                                     |
| `orderMerchantExternalId` | `string`                 | No       | Your business-side order identifier (max 128 chars). Surfaces under the same name on `Order` / `Payment` / `Refund` GraphQL types and in webhook payload (`data.orderMerchantExternalId`).                                                                                                                                                                                                          |
| `language`                | `string`                 | No       | Default checkout cashier language (IETF BCP 47), e.g. `pt-BR`, `zh-Hant-TW`. Must be one of the supported cashier languages; the customer can switch on the page.                                                                                                                                                                                                                                   |
| `couponId`                | `string`                 | No       | Coupon to apply (`CPN_xxx`, from `client.coupons.create`). Locked: the customer sees the discount but not a code (even when the coupon has its own code), cannot change or remove it, and no code entry field is shown. One-time products, new subscriptions (the coupon's `duration` sets how many billing periods are discounted) and plan changes (see `createPlanChangeSession`). Mutually exclusive with `promotionCode` and `allowPromotionCodes` |
| `promotionCode`           | `string`                 | No       | Promotion code to prefill (the code string, case-insensitive). Merchant credentials only. Changeable — the customer can replace or remove it — only with `allowPromotionCodes: true`; otherwise locked. Mutually exclusive with `couponId`                                                                                                                                                          |
| `allowPromotionCodes`     | `boolean`                | No       | Show a code entry field where the customer can enter a coupon or promotion code. Default `false` for API Key sessions. With `promotionCode`, `true` lets the customer change or remove the prefilled code. Mutually exclusive with `couponId`                                                                                                                                                       |

**Returns `AuthenticatedCheckoutResult`**:

| Field            | Type     | Description                             |
| ---------------- | -------- | --------------------------------------- |
| `sessionId`      | `string` | Session ID                              |
| `checkoutUrl`    | `string` | Checkout URL with `#token=...` appended |
| `expiresAt`      | `string` | Session expiration time                 |
| `token`          | `string` | Issued JWT token                        |
| `tokenExpiresAt` | `string` | Token expiration time                   |

### `client.checkout.anonymous.create(params)`

Anonymous checkout — visitor enters without a session token. The customer fills in billing details manually on the checkout page.

Internally calls `POST /v1/actions/checkout/create-session`.

```typescript
const result = await client.checkout.anonymous.create({
  productId: "PROD_xxx",
  currency: "USD",
});
// => redirect customer to result.checkoutUrl (customer fills form manually)

// With price snapshot override
const snapshotResult = await client.checkout.anonymous.create({
  productId: "PROD_xxx",
  currency: "USD",
  priceSnapshot: { amount: "19.99", taxCategory: "digital_goods" },
});
```

**Parameters `AnonymousCheckoutParams`**:

| Field                     | Type                     | Required | Description                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------- | ------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `productId`               | `string`                 | Yes      | Product ID (product type is auto-detected server-side)                                                                                                                                                                                                                                                                                                                                              |
| `currency`                | `string`                 | Yes      | Currency code (ISO 4217)                                                                                                                                                                                                                                                                                                                                                                            |
| `priceSnapshot`           | `PriceInfo`              | No       | Price snapshot override (reads from DB if omitted)                                                                                                                                                                                                                                                                                                                                                  |
| `withTrial`               | `boolean`                | No       | Enable trial period (subscription only)                                                                                                                                                                                                                                                                                                                                                             |
| `successUrl`              | `string`                 | No       | Redirect URL after successful payment                                                                                                                                                                                                                                                                                                                                                               |
| `expiresInSeconds`        | `number`                 | No       | Session expiry in seconds (default: 24 hours, recommended: 60 to 604800 / 1 min to 7 days)                                                                                                                                                                                                                                                                                                          |
| `darkMode`                | `boolean`                | No       | Dark mode override (true=dark, false=light, omit=store default)                                                                                                                                                                                                                                                                                                                                     |
| `metadata`                | `Record<string, string>` | No       | Custom metadata                                                                                                                                                                                                                                                                                                                                                                                     |
| `orderMerchantExternalId` | `string`                 | No       | Your business-side order identifier (max 128 chars). Honored on the API Key path; visitor / store-slug flows silently drop it. Same field name in webhook payload and GraphQL `Order` / `Payment` / `Refund`.                                                                                                                                                                                       |
| `language`                | `string`                 | No       | Default checkout cashier language (IETF BCP 47), e.g. `pt-BR`, `zh-Hant-TW`. Must be one of the supported cashier languages; the customer can switch on the page.                                                                                                                                                                                                                                   |
| `couponId`                | `string`                 | No       | Coupon to apply (`CPN_xxx`, from `client.coupons.create`). Locked: the customer sees the discount but not a code (even when the coupon has its own code), cannot change or remove it, and no code entry field is shown. One-time products, new subscriptions (the coupon's `duration` sets how many billing periods are discounted) and plan changes (see `createPlanChangeSession`). Mutually exclusive with `promotionCode` and `allowPromotionCodes` |
| `promotionCode`           | `string`                 | No       | Promotion code to prefill (the code string, case-insensitive). Merchant credentials only. Changeable — the customer can replace or remove it — only with `allowPromotionCodes: true`; otherwise locked. Mutually exclusive with `couponId`                                                                                                                                                          |
| `allowPromotionCodes`     | `boolean`                | No       | Show a code entry field where the customer can enter a coupon or promotion code. Default `false` for API Key sessions. With `promotionCode`, `true` lets the customer change or remove the prefilled code. Mutually exclusive with `couponId`                                                                                                                                                       |

**Returns `CheckoutSessionResult`**:

| Field         | Type     | Description              |
| ------------- | -------- | ------------------------ |
| `sessionId`   | `string` | Session ID               |
| `checkoutUrl` | `string` | Hosted checkout page URL |
| `expiresAt`   | `string` | Session expiration time  |

### `client.checkout.createPlanChangeSession(params)`

Issue a link that changes an existing subscription to another plan. Same `create-session` endpoint as a new purchase — `originOrderId` is what puts it into plan change mode, which is why it is a required field here instead of an optional one on the new-purchase params.

The returned `checkoutUrl` points at the change confirmation page (`…/store/{slug}/change/{sessionId}`), where the customer confirms the change.

```typescript
import { ChangeTiming } from "@waffo/pancake-ts";

const session = await client.checkout.createPlanChangeSession({
  originOrderId: "ORD_xxx",
  productId: "PROD_target_plan",
  currency: "USD",
  changeTiming: ChangeTiming.Immediate,
  changeCreditAmount: "8.00",
});
```

**Parameters `CreatePlanChangeSessionParams`**:

| Field                                             | Type                     | Required | Description                                                                                                                                                                                                            |
| ------------------------------------------------- | ------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `originOrderId`                                   | `string`                 | Yes      | Order ID of the subscription being changed (`ORD_xxx`). Its presence is what selects plan change mode                                                                                                                  |
| `productId`                                       | `string`                 | Yes      | Target plan's product ID — a subscription product other than the current one                                                                                                                                           |
| `currency`                                        | `string`                 | Yes      | Currency code (ISO 4217)                                                                                                                                                                                               |
| `changeTiming`                                    | `ChangeTiming`           | No       | `Immediate` or `NextPeriod`. Omit to let the platform derive it from the change direction; the derived tier is not echoed back                                                                                         |
| `changeAmount`                                    | `string`                 | No       | What to charge for this change (display string, tax inclusive). Mutually exclusive with `changeCreditAmount`; merchant credentials only                                                                                |
| `changeCreditAmount`                              | `string`                 | No       | How much to credit against this change (display string, tax inclusive, same basis as `changeAmount`). Mutually exclusive with `changeAmount`; merchant credentials only                                                |
| `withTrial`                                       | `boolean`                | No       | Trial toggle for the target plan, three-state as on a new purchase. Merchant credentials only                                                                                                                          |
| `priceSnapshot`                                   | `PriceSnapshot`          | No       | Price override for the target plan                                                                                                                                                                                     |
| `successUrl`                                      | `string`                 | No       | Redirect URL after the change is confirmed and paid                                                                                                                                                                    |
| `expiresInSeconds`                                | `number`                 | No       | Session expiry in seconds (default: 24 hours, recommended: 60 to 604800 / 1 min to 7 days)                                                                                                                             |
| `darkMode`                                        | `boolean`                | No       | Dark mode override (true=dark, false=light, omit=store default)                                                                                                                                                        |
| `metadata`                                        | `Record<string, string>` | No       | Custom metadata                                                                                                                                                                                                        |
| `orderMerchantExternalId`                         | `string`                 | No       | Your business-side order identifier (max 128 chars)                                                                                                                                                                    |
| `language`                                        | `string`                 | No       | Confirmation page language (IETF BCP 47)                                                                                                                                                                               |
| `includePaymentMethods` / `excludePaymentMethods` | `PaymentMethod[]`        | No       | Whitelist / blacklist, mutually exclusive                                                                                                                                                                              |
| `couponId`                                        | `string`                 | No       | Coupon to apply to the new plan (`CPN_xxx`). Locked; the customer sees the discount but not a code. Replaces the subscription's current discount. Mutually exclusive with `promotionCode` and `allowPromotionCodes`                                                   |
| `promotionCode`                                   | `string`                 | No       | Promotion code to prefill on the confirmation page (code string, case-insensitive). Replaces the subscription's current discount. Changeable only with `allowPromotionCodes: true`. Mutually exclusive with `couponId` |
| `allowPromotionCodes`                             | `boolean`                | No       | Show a code entry field on the confirmation page. Default `false` for API Key sessions. Mutually exclusive with `couponId`                                                                                             |

There is no `buyerEmail` or `billingDetail`: in plan change mode the customer email, billing details, and tax all come from the origin subscription.

**Discounts on a plan change.** A `couponId` or `promotionCode` replaces the subscription's current discount: the remaining periods of the old one are dropped, and the new one counts its periods from the new subscription's first charge above zero (a first charge of $0, when the credit covers the new price, uses no period). Without one, the current discount carries over to the new plan with the periods already used, unless it has no periods left, its coupon's `redeemBy` is within 60 seconds, or the coupon is deactivated — then the new plan is charged the full price. A promotion code's minimum amount is checked against the new plan's regular price before the discount, excluding tax. See [Discounts](https://docs.waffo.ai/guides/discounts#plan-changes).

Two amount fields, two ways to price the same change: `changeAmount` says what to charge for this period, `changeCreditAmount` says how much to credit against it. Same unit and tax basis, opposite meaning — sending both is rejected with a 400, and the SDK forwards what you pass rather than picking one.

**Returns `CheckoutSessionResult`** — same three fields as a new-purchase session.

### `client.checkout.authenticated.createPlanChange(params)`

The authenticated form of the above: issues a customer session token in parallel and appends it to the confirmation URL (`#token=...`), so the customer lands on the page already signed in. Internally calls `POST /v1/actions/auth/issue-session-token` and `POST /v1/actions/checkout/create-session`.

```typescript
const result = await client.checkout.authenticated.createPlanChange({
  originOrderId: "ORD_xxx",
  productId: "PROD_target_plan",
  currency: "USD",
  buyerIdentity: "userIdInYourSystem",
  changeTiming: ChangeTiming.NextPeriod,
});
// => redirect the customer to result.checkoutUrl (includes #token=...)
```

**Parameters `AuthenticatedPlanChangeParams`**: every field of `CreatePlanChangeSessionParams`, plus `buyerIdentity` (`string`, required) — routed to `issue-session-token` only, never into the session body.

**Returns `AuthenticatedCheckoutResult`** — same five fields as authenticated checkout.

<a id="no-anonymous-plan-change"></a>

> **There is no anonymous plan change.** A Store Slug session is an anonymous credential with no subscription to attribute the change to, and the platform answers 403 — so `client.checkout.anonymous` carries no plan change method.

### `client.checkout.createSession(params)` (low-level)

Create a checkout session directly. For most use cases, prefer `checkout.authenticated.create()` or `checkout.anonymous.create()`.

```typescript
const session = await client.checkout.createSession({
  productId: "PROD_xxx",
  currency: "USD",
  buyerEmail: "customer@example.com",
});
```

**Parameters `CreateCheckoutSessionParams`**:

| Field                     | Type                     | Required | Description                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------- | ------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `productId`               | `string`                 | Yes      | Product ID (product type is auto-detected server-side)                                                                                                                                                                                                                                                                                                                                              |
| `currency`                | `string`                 | Yes      | Currency code (ISO 4217)                                                                                                                                                                                                                                                                                                                                                                            |
| `priceSnapshot`           | `PriceInfo`              | No       | Price snapshot override (reads from DB if omitted)                                                                                                                                                                                                                                                                                                                                                  |
| `withTrial`               | `boolean`                | No       | Enable trial period (subscription only)                                                                                                                                                                                                                                                                                                                                                             |
| `buyerEmail`              | `string`                 | No       | Pre-filled customer email                                                                                                                                                                                                                                                                                                                                                                           |
| `billingDetail`           | `BillingDetail`          | No       | Pre-filled billing details. Passing this couples the cashier to the order's billing country: it then offers only that country's payment market and the customer cannot switch. The country that applies is the one on the finished order, not the one you sent; a country outside the payment markets we cover applies no restriction. Omit to leave the cashier unrestricted.                      |
| `successUrl`              | `string`                 | No       | Redirect URL after successful payment                                                                                                                                                                                                                                                                                                                                                               |
| `expiresInSeconds`        | `number`                 | No       | Session expiry in seconds (default: 24 hours, recommended: 60 to 604800 / 1 min to 7 days)                                                                                                                                                                                                                                                                                                          |
| `darkMode`                | `boolean`                | No       | Dark mode override                                                                                                                                                                                                                                                                                                                                                                                  |
| `metadata`                | `Record<string, string>` | No       | Custom metadata                                                                                                                                                                                                                                                                                                                                                                                     |
| `orderMerchantExternalId` | `string`                 | No       | Your business-side order identifier (max 128 chars). Honored on the API Key (merchant) path; visitor / store-slug flows silently drop it. Same field name in webhook payload and GraphQL.                                                                                                                                                                                                           |
| `language`                | `string`                 | No       | Default checkout cashier language (IETF BCP 47), e.g. `pt-BR`, `zh-Hant-TW`. Must be one of the supported cashier languages; the customer can switch on the page.                                                                                                                                                                                                                                   |
| `couponId`                | `string`                 | No       | Coupon to apply (`CPN_xxx`, from `client.coupons.create`). Locked: the customer sees the discount but not a code (even when the coupon has its own code), cannot change or remove it, and no code entry field is shown. One-time products, new subscriptions (the coupon's `duration` sets how many billing periods are discounted) and plan changes (see `createPlanChangeSession`). Mutually exclusive with `promotionCode` and `allowPromotionCodes` |
| `promotionCode`           | `string`                 | No       | Promotion code to prefill (the code string, case-insensitive). Merchant credentials only. Changeable — the customer can replace or remove it — only with `allowPromotionCodes: true`; otherwise locked. Mutually exclusive with `couponId`                                                                                                                                                          |
| `allowPromotionCodes`     | `boolean`                | No       | Show a code entry field where the customer can enter a coupon or promotion code. Default `false` for API Key sessions. With `promotionCode`, `true` lets the customer change or remove the prefilled code. Mutually exclusive with `couponId`                                                                                                                                                       |

`couponId`, `promotionCode` and `allowPromotionCodes` are checked by every checkout and plan change method: a `couponId` without the `CPN_` prefix, an empty `promotionCode`, or `couponId` together with `promotionCode` or `allowPromotionCodes` (either value), throws `WaffoPancakeError` (400, `layer: "sdk"`) before any request is sent. The platform answers 409 for a coupon or prefilled promotion code from another store or environment, one that is not `active`, expires within 60 seconds, does not cover the product, or has no fixed amount in the session currency; the message names the reason. Rules tied to the customer are checked when the order is placed.

```typescript
// Locked coupon
await client.checkout.createSession({ productId: "PROD_xxx", currency: "USD", couponId: "CPN_xxx" });

// Code entry field on the checkout page
await client.checkout.createSession({ productId: "PROD_xxx", currency: "USD", allowPromotionCodes: true });

// Prefilled promotion code the customer can change or remove (leave out allowPromotionCodes to lock it)
await client.checkout.createSession({ productId: "PROD_xxx", currency: "USD", promotionCode: "SPRING-20", allowPromotionCodes: true });
```

**`BillingDetail` fields**:

| Field          | Type      | Required    | Description                                                                                             |
| -------------- | --------- | ----------- | ------------------------------------------------------------------------------------------------------- |
| `country`      | `string`  | Yes         | Country code (ISO 3166-1 alpha-2)                                                                       |
| `isBusiness`   | `boolean` | Yes         | Whether this is a business purchase                                                                     |
| `postcode`     | `string`  | No          | Postal / ZIP code                                                                                       |
| `state`        | `string`  | Conditional | State / province code (required when `country` is `US` or `CA`)                                         |
| `businessName` | `string`  | Conditional | Business name (required when `isBusiness` is `true`)                                                    |
| `taxId`        | `string`  | Conditional | Tax ID / VAT number (required for EU countries when `isBusiness` is `true`; triggers reverse charge 0%) |

**Returns `CheckoutSessionResult`**:

| Field         | Type     | Description              |
| ------------- | -------- | ------------------------ |
| `sessionId`   | `string` | Session ID               |
| `checkoutUrl` | `string` | Hosted checkout page URL |
| `expiresAt`   | `string` | Session expiration time  |

---

## GraphQL

### `client.graphql.query<T>(params)`

Execute a typed GraphQL query. Only Query operations are supported — Mutations return a 403 error.

> **Note**: GraphQL field names may differ from SDK TypeScript types. For example, `prices` is `Record<string, PriceInfo>` in REST but `[CurrencyPrice!]!` in GraphQL. Use introspection (`__schema` / `__type` queries) to discover the exact schema. See [GraphQL Guide](./graphql-guide.md) for details.

```typescript
interface StoresQuery {
  stores: Array<{ id: string; name: string; status: string }>;
}
const result = await client.graphql.query<StoresQuery>({
  query: `query { stores { id name status } }`,
});

const productResult = await client.graphql.query({
  query: `query ($id: ID!) { onetimeProduct(id: $id) { id name prices } }`,
  variables: { id: "PROD_xxx" },
});
```

**Parameters `GraphQLParams`**:

| Field       | Type                      | Required | Description          |
| ----------- | ------------------------- | -------- | -------------------- |
| `query`     | `string`                  | Yes      | GraphQL query string |
| `variables` | `Record<string, unknown>` | No       | Query variables      |

**Returns `GraphQLResponse<T>`**:

| Field    | Type                                    | Description             |
| -------- | --------------------------------------- | ----------------------- |
| `data`   | `T \| null`                             | Query result            |
| `errors` | `Array<{ message, locations?, path? }>` | GraphQL errors (if any) |

See [GraphQL Guide](graphql-guide.md) for introspection, filters, pagination, and practical examples.

---

## Idempotency

`RequestOptions` is the last argument of every write method:

```typescript
await client.stores.create({ name: "My Store" }, { idempotencyKey: "MER_store-create-9f2c" });
```

| Field            | Type     | Required | Description                                                                               |
| ---------------- | -------- | -------- | ----------------------------------------------------------------------------------------- |
| `idempotencyKey` | `string` | No       | Sent as `X-Idempotency-Key`. Omitted → the header is not sent and nothing is deduplicated |

Platform behavior when a key is sent: the first request executes and its 2xx response is cached for **24 hours**; the same key returns that cached response; the same key while the original is in flight returns **409**; a non-2xx original leaves the key free to retry. Keys are at most 256 characters of letters, numbers, hyphens and underscores, and a malformed one is rejected by the gateway with a 400.

The SDK never derives a key — **uniqueness is the caller's to guarantee**, and reusing one key across two different calls makes the second replay the first one's response. For that reason a key passed to `checkout.authenticated.create()` / `.createPlanChange()` is applied to the `create-session` call only, not to the token call. GraphQL queries accept no key.

---

## Types

All exported type interfaces:

| Export                                  | Description                                                                                                                                                 |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Config**                              |                                                                                                                                                             |
| `WaffoPancakeConfig`                    | Client configuration                                                                                                                                        |
| **Response Envelope**                   |                                                                                                                                                             |
| `ApiError`                              | Error object (`{ message, layer }`)                                                                                                                         |
| `ApiErrorResponse`                      | Error response (`{ data: null, errors }`)                                                                                                                   |
| `ApiResponse<T>`                        | Union of success and error responses                                                                                                                        |
| `ApiSuccessResponse<T>`                 | Success response (`{ data: T }`)                                                                                                                            |
| **Auth**                                |                                                                                                                                                             |
| `IssueSessionTokenParams`               | Issue token request                                                                                                                                         |
| `SessionToken`                          | Token response                                                                                                                                              |
| **Store**                               |                                                                                                                                                             |
| `Store`                                 | Store entity                                                                                                                                                |
| `CreateStoreParams`                     | Create store request                                                                                                                                        |
| `UpdateStoreParams`                     | Update store request                                                                                                                                        |
| `DeleteStoreParams`                     | Delete store request                                                                                                                                        |
| `WebhookSettings`                       | Webhook endpoint configuration (test/prod)                                                                                                                  |
| `NotificationSettings`                  | 21 notification toggles (10 `notify*` + 11 `email*`)                                                                                                        |
| `CheckoutSettings`                      | Checkout page theme (light/dark)                                                                                                                            |
| `CheckoutThemeSettings`                 | Single-theme checkout styling                                                                                                                               |
| **Store Merchant**                      |                                                                                                                                                             |
| `AddMerchantParams`                     | Add merchant request                                                                                                                                        |
| `AddMerchantResult`                     | Add merchant response                                                                                                                                       |
| `RemoveMerchantParams`                  | Remove merchant request                                                                                                                                     |
| `RemoveMerchantResult`                  | Remove merchant response                                                                                                                                    |
| `UpdateRoleParams`                      | Update role request                                                                                                                                         |
| `UpdateRoleResult`                      | Update role response                                                                                                                                        |
| **Product (shared)**                    |                                                                                                                                                             |
| `PriceInfo`                             | Single-currency price (amount in smallest unit)                                                                                                             |
| `Prices`                                | Multi-currency prices (`Record<currencyCode, PriceInfo>`)                                                                                                   |
| `MediaItem`                             | Media asset (image or video)                                                                                                                                |
| **Onetime Product**                     |                                                                                                                                                             |
| `OnetimeProductDetail`                  | One-time product entity                                                                                                                                     |
| `CreateOnetimeProductParams`            | Create request                                                                                                                                              |
| `UpdateOnetimeProductParams`            | Update request (creates new version)                                                                                                                        |
| `PublishOnetimeProductParams`           | Publish test → prod                                                                                                                                         |
| `UpdateOnetimeStatusParams`             | Activate / deactivate                                                                                                                                       |
| **Subscription Product**                |                                                                                                                                                             |
| `SubscriptionProductDetail`             | Subscription product entity                                                                                                                                 |
| `CreateSubscriptionProductParams`       | Create request                                                                                                                                              |
| `UpdateSubscriptionProductParams`       | Update request (creates new version)                                                                                                                        |
| `PublishSubscriptionProductParams`      | Publish test → prod                                                                                                                                         |
| `UpdateSubscriptionStatusParams`        | Activate / deactivate                                                                                                                                       |
| **Subscription Product Group**          |                                                                                                                                                             |
| `SubscriptionProductGroup`              | Product group entity                                                                                                                                        |
| `GroupRules`                            | Group switches as returned on an entity (both required)                                                                                                     |
| `GroupRulesInput`                       | Group switches as accepted on create / update (both optional, merged)                                                                                       |
| `CreateSubscriptionProductGroupParams`  | Create request                                                                                                                                              |
| `UpdateSubscriptionProductGroupParams`  | Update request (`productIds` = full replacement)                                                                                                            |
| `DeleteSubscriptionProductGroupParams`  | Delete request                                                                                                                                              |
| `PublishSubscriptionProductGroupParams` | Publish test → prod                                                                                                                                         |
| **Coupon & Promotion Code**             |                                                                                                                                                             |
| `CouponStatus`                          | Coupon status (`Active` / `Inactive` / `Failed`)                                                                                                            |
| `CouponDiscountType`                    | Discount type (`Percentage` / `FixedAmount`)                                                                                                                |
| `CouponDuration`                        | Subscription periods that get the discount (`Once` / `Repeating` / `Forever`)                                                                               |
| `CouponDiscount`                        | Discount of a coupon (percentage or fixed amount per currency)                                                                                              |
| `CouponDetail`                          | Coupon entity                                                                                                                                               |
| `CreatedCouponDetail`                   | Coupon entity returned by `create`, with `promotionCodes`                                                                                                   |
| `CreateCouponParams`                    | Create request (optional `code` and `promotionCodes`, 0–20)                                                                                                 |
| `CreateCouponPromotionCodeParams`       | Promotion code created with the coupon (`code` optional, `restrictions`)                                                                                    |
| `UpdateCouponParams`                    | Rename request                                                                                                                                              |
| `DeactivateCouponParams`                | Deactivate request (permanent)                                                                                                                              |
| `PromotionCodeStatus`                   | Promotion code status (`Active` / `Inactive`)                                                                                                               |
| `PromotionCodeRestrictions`             | Buyer restrictions (`customerEmails` / `perCustomerLimit`) plus `maxRedemptions` / `expiresAt` / `minimumAmount`                                            |
| `PromotionCodeDetail`                   | Promotion code entity                                                                                                                                       |
| `CreatePromotionCodeParams`             | Create request (`code` optional)                                                                                                                            |
| `GeneratePromotionCodesParams`          | Bulk generate request (1–500 codes)                                                                                                                         |
| `DeactivatePromotionCodeParams`         | Deactivate request (permanent)                                                                                                                              |
| **Order**                               |                                                                                                                                                             |
| `CancelSubscriptionParams`              | Cancel subscription request                                                                                                                                 |
| `CancelSubscriptionResult`              | Cancel subscription response                                                                                                                                |
| `BillingDetail`                         | Customer billing details (country, tax ID, etc.)                                                                                                            |
| `CreatePlanChangeSessionParams`         | Plan change session request (`originOrderId` required)                                                                                                      |
| `AuthenticatedPlanChangeParams`         | Plan change request with customer identity                                                                                                                  |
| `ChangeTiming`                          | When a plan change takes effect (`Immediate` / `NextPeriod`)                                                                                                |
| **Customer Self-Service**               |                                                                                                                                                             |
| `CancelOnetimeOrderParams`              | Cancel one-time order request                                                                                                                               |
| `CancelOnetimeOrderResult`              | Cancel one-time order response                                                                                                                              |
| `ReactivateSubscriptionParams`          | Reactivate subscription request                                                                                                                             |
| `ReactivateSubscriptionResult`          | Reactivate subscription response                                                                                                                            |
| `CreateRefundTicketParams`              | Create refund ticket request                                                                                                                                |
| `ResubmitRefundTicketParams`            | Resubmit refund ticket request                                                                                                                              |
| `RefundTicket`                          | Refund ticket entity                                                                                                                                        |
| `RequestedAmount`                       | Refund amount (`{ amount, currency }`)                                                                                                                      |
| **Checkout**                            |                                                                                                                                                             |
| `AuthenticatedCheckoutParams`           | Authenticated checkout request (with customer identity)                                                                                                     |
| `AuthenticatedCheckoutResult`           | Authenticated checkout response (URL with token + expiry)                                                                                                   |
| `AnonymousCheckoutParams`               | Anonymous checkout request (no identity)                                                                                                                    |
| `CreateCheckoutSessionParams`           | Low-level checkout session request                                                                                                                          |
| `CheckoutSessionResult`                 | Checkout session response (URL + expiry)                                                                                                                    |
| **GraphQL**                             |                                                                                                                                                             |
| `GraphQLParams`                         | GraphQL query parameters                                                                                                                                    |
| `GraphQLResponse<T>`                    | GraphQL response envelope                                                                                                                                   |
| **Webhook**                             |                                                                                                                                                             |
| `WebhookEvent<T>`                       | Webhook event payload                                                                                                                                       |
| `WebhookEventData`                      | Common event data fields                                                                                                                                    |
| `WebhookAmountBreakdown`                | Amount breakdown of the object an event refers to (`listPrice` / `originalPayment` / `planPrice`)                                                           |
| `VerifyWebhookOptions`                  | Verification options (environment, tolerance)                                                                                                               |

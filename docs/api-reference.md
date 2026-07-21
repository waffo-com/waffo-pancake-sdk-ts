# API Reference

Complete reference for all `@waffo/pancake-ts` resources, parameters, and return types.

> **Conventions**:
>
> - All amounts are in the **smallest currency unit** (e.g. 999 = $9.99 USD, 4500 = ¥4500 JPY)
> - All timestamps are **ISO 8601 UTC** strings
> - Product updates follow **immutable versioning** — only provided fields are updated (omitted fields are preserved), each update creates a new version, skipped if content is unchanged
> - The **publish** flow promotes a test version to production

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
    emailOrderConfirmation: true,
    emailSubscriptionConfirmation: true,
    emailSubscriptionCycled: true,
    emailSubscriptionCanceled: true,
    emailSubscriptionRevoked: true,
    emailSubscriptionPastDue: true,
    notifyNewOrders: true,
    notifyNewSubscriptions: true,
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

| Field                  | Type                           | Required | Description                                                                |
| ---------------------- | ------------------------------ | -------- | -------------------------------------------------------------------------- |
| `id`                   | `string`                       | Yes      | Store ID                                                                   |
| `name`                 | `string`                       | No       | Store name (1–100 characters)                                              |
| `status`               | `EntityStatus`                 | No       | Store status                                                               |
| `logo`                 | `string \| null`               | No       | Logo (Base64 encoded image)                                                |
| `supportEmail`         | `string \| null`               | No       | Support email address                                                      |
| `website`              | `string \| null`               | No       | Store website URL                                                          |
| `webhookSettings`      | `WebhookSettings \| null`      | No       | Webhook endpoint configuration (test/prod URLs and subscribed event types) |
| `notificationSettings` | `NotificationSettings \| null` | No       | Email notification preferences                                             |
| `checkoutSettings`     | `CheckoutSettings \| null`     | No       | Checkout page theme (light/dark)                                           |

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
  rules: { sharedTrial: true },
  productIds: ["PROD_aaa", "PROD_bbb"],
});
```

**Parameters `CreateSubscriptionProductGroupParams`**:

| Field         | Type         | Required | Description                                |
| ------------- | ------------ | -------- | ------------------------------------------ |
| `storeId`     | `string`     | Yes      | Store ID                                   |
| `name`        | `string`     | Yes      | Group name                                 |
| `description` | `string`     | No       | Group description                          |
| `rules`       | `GroupRules` | No       | Group rules (e.g. `{ sharedTrial: true }`) |
| `productIds`  | `string[]`   | No       | Subscription product IDs to include        |

**Returns `{ group: SubscriptionProductGroup }`**

### `client.subscriptionProductGroups.update(params)`

Update a group. `productIds` is a **full replacement** (not a merge).

```typescript
const { group } = await client.subscriptionProductGroups.update({
  id: "spg_xxx",
  productIds: ["PROD_aaa", "PROD_bbb", "PROD_ccc"],
});
```

**Returns `{ group: SubscriptionProductGroup }`**

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

### `client.customer(token)`

Create a customer session from a session token issued by `client.auth.issueSessionToken()`.

```typescript
const { token } = await client.auth.issueSessionToken({
  storeId: "STO_xxx",
  buyerIdentity: "customer@example.com",
});
const customer = client.customer(token);
```

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

| Field                     | Type                     | Required | Description                                                                                                                                                                                                                                                                            |
| ------------------------- | ------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `productId`               | `string`                 | Yes      | Product ID (product type is auto-detected server-side)                                                                                                                                                                                                                                 |
| `currency`                | `string`                 | Yes      | Currency code (ISO 4217)                                                                                                                                                                                                                                                               |
| `buyerIdentity`           | `string`                 | Yes      | Customer identity (email or merchant-defined identifier)                                                                                                                                                                                                                               |
| `buyerEmail`              | `string`                 | No       | Pre-fill checkout page email field (independent from `buyerIdentity`)                                                                                                                                                                                                                  |
| `billingDetail`           | `BillingDetail`          | No       | Pre-filled billing details (country, tax ID, etc.)                                                                                                                                                                                                                                     |
| `priceSnapshot`           | `PriceInfo`              | No       | Price snapshot override (reads from DB if omitted)                                                                                                                                                                                                                                     |
| `withTrial`               | `boolean`                | No       | Enable trial period (subscription only)                                                                                                                                                                                                                                                |
| `successUrl`              | `string`                 | No       | Redirect URL after successful payment                                                                                                                                                                                                                                                  |
| `expiresInSeconds`        | `number`                 | No       | Session expiry in seconds (default: 45 minutes)                                                                                                                                                                                                                                        |
| `darkMode`                | `boolean`                | No       | Dark mode override (true=dark, false=light, omit=store default)                                                                                                                                                                                                                        |
| `metadata`                | `Record<string, string>` | No       | Custom metadata                                                                                                                                                                                                                                                                        |
| `orderMerchantExternalId` | `string`                 | No       | Your business-side order identifier (max 128 chars). Surfaces under the same name on `Order` / `Payment` / `Refund` GraphQL types and in webhook payload (`data.orderMerchantExternalId`).                                                                                             |
| `language`                | `string`                 | No       | Default checkout cashier language (IETF BCP 47), e.g. `pt-BR`, `zh-Hant-TW`. Must be one of the supported cashier languages; the customer can switch on the page.                                                                                                                      |
| `paymentMethods`          | `PaymentMethod[]`        | No       | Ordered, non-empty allow-list restricting which methods the hosted cashier shows, in this order. Omit to keep current default (all methods available for currency/product type, provider default order). Unavailable/unknown/duplicate values reject with 4xx; no fallback is applied. |

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

| Field                     | Type                     | Required | Description                                                                                                                                                                                                                                                                            |
| ------------------------- | ------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `productId`               | `string`                 | Yes      | Product ID (product type is auto-detected server-side)                                                                                                                                                                                                                                 |
| `currency`                | `string`                 | Yes      | Currency code (ISO 4217)                                                                                                                                                                                                                                                               |
| `priceSnapshot`           | `PriceInfo`              | No       | Price snapshot override (reads from DB if omitted)                                                                                                                                                                                                                                     |
| `withTrial`               | `boolean`                | No       | Enable trial period (subscription only)                                                                                                                                                                                                                                                |
| `successUrl`              | `string`                 | No       | Redirect URL after successful payment                                                                                                                                                                                                                                                  |
| `expiresInSeconds`        | `number`                 | No       | Session expiry in seconds (default: 45 minutes)                                                                                                                                                                                                                                        |
| `darkMode`                | `boolean`                | No       | Dark mode override (true=dark, false=light, omit=store default)                                                                                                                                                                                                                        |
| `metadata`                | `Record<string, string>` | No       | Custom metadata                                                                                                                                                                                                                                                                        |
| `orderMerchantExternalId` | `string`                 | No       | Your business-side order identifier (max 128 chars). Honored on the API Key path; visitor / store-slug flows silently drop it. Same field name in webhook payload and GraphQL `Order` / `Payment` / `Refund`.                                                                          |
| `language`                | `string`                 | No       | Default checkout cashier language (IETF BCP 47), e.g. `pt-BR`, `zh-Hant-TW`. Must be one of the supported cashier languages; the customer can switch on the page.                                                                                                                      |
| `paymentMethods`          | `PaymentMethod[]`        | No       | Ordered, non-empty allow-list restricting which methods the hosted cashier shows, in this order. Omit to keep current default (all methods available for currency/product type, provider default order). Unavailable/unknown/duplicate values reject with 4xx; no fallback is applied. |

**Returns `CheckoutSessionResult`**:

| Field         | Type     | Description              |
| ------------- | -------- | ------------------------ |
| `sessionId`   | `string` | Session ID               |
| `checkoutUrl` | `string` | Hosted checkout page URL |
| `expiresAt`   | `string` | Session expiration time  |

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

| Field                     | Type                     | Required | Description                                                                                                                                                                                                                                                                            |
| ------------------------- | ------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `productId`               | `string`                 | Yes      | Product ID (product type is auto-detected server-side)                                                                                                                                                                                                                                 |
| `currency`                | `string`                 | Yes      | Currency code (ISO 4217)                                                                                                                                                                                                                                                               |
| `priceSnapshot`           | `PriceInfo`              | No       | Price snapshot override (reads from DB if omitted)                                                                                                                                                                                                                                     |
| `withTrial`               | `boolean`                | No       | Enable trial period (subscription only)                                                                                                                                                                                                                                                |
| `buyerEmail`              | `string`                 | No       | Pre-filled customer email                                                                                                                                                                                                                                                              |
| `billingDetail`           | `BillingDetail`          | No       | Pre-filled billing details (country, tax ID, etc.)                                                                                                                                                                                                                                     |
| `successUrl`              | `string`                 | No       | Redirect URL after successful payment                                                                                                                                                                                                                                                  |
| `expiresInSeconds`        | `number`                 | No       | Session expiry in seconds (default: 45 minutes)                                                                                                                                                                                                                                        |
| `darkMode`                | `boolean`                | No       | Dark mode override                                                                                                                                                                                                                                                                     |
| `metadata`                | `Record<string, string>` | No       | Custom metadata                                                                                                                                                                                                                                                                        |
| `orderMerchantExternalId` | `string`                 | No       | Your business-side order identifier (max 128 chars). Honored on the API Key (merchant) path; visitor / store-slug flows silently drop it. Same field name in webhook payload and GraphQL.                                                                                              |
| `language`                | `string`                 | No       | Default checkout cashier language (IETF BCP 47), e.g. `pt-BR`, `zh-Hant-TW`. Must be one of the supported cashier languages; the customer can switch on the page.                                                                                                                      |
| `paymentMethods`          | `PaymentMethod[]`        | No       | Ordered, non-empty allow-list restricting which methods the hosted cashier shows, in this order. Omit to keep current default (all methods available for currency/product type, provider default order). Unavailable/unknown/duplicate values reject with 4xx; no fallback is applied. |

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

## Types

All exported type interfaces:

| Export                                  | Description                                               |
| --------------------------------------- | --------------------------------------------------------- |
| **Config**                              |                                                           |
| `WaffoPancakeConfig`                    | Client configuration                                      |
| **Response Envelope**                   |                                                           |
| `ApiError`                              | Error object (`{ message, layer }`)                       |
| `ApiErrorResponse`                      | Error response (`{ data: null, errors }`)                 |
| `ApiResponse<T>`                        | Union of success and error responses                      |
| `ApiSuccessResponse<T>`                 | Success response (`{ data: T }`)                          |
| **Auth**                                |                                                           |
| `IssueSessionTokenParams`               | Issue token request                                       |
| `SessionToken`                          | Token response                                            |
| **Store**                               |                                                           |
| `Store`                                 | Store entity                                              |
| `CreateStoreParams`                     | Create store request                                      |
| `UpdateStoreParams`                     | Update store request                                      |
| `DeleteStoreParams`                     | Delete store request                                      |
| `WebhookSettings`                       | Webhook endpoint configuration (test/prod)                |
| `NotificationSettings`                  | Email notification preferences                            |
| `CheckoutSettings`                      | Checkout page theme (light/dark)                          |
| `CheckoutThemeSettings`                 | Single-theme checkout styling                             |
| **Store Merchant**                      |                                                           |
| `AddMerchantParams`                     | Add merchant request                                      |
| `AddMerchantResult`                     | Add merchant response                                     |
| `RemoveMerchantParams`                  | Remove merchant request                                   |
| `RemoveMerchantResult`                  | Remove merchant response                                  |
| `UpdateRoleParams`                      | Update role request                                       |
| `UpdateRoleResult`                      | Update role response                                      |
| **Product (shared)**                    |                                                           |
| `PriceInfo`                             | Single-currency price (amount in smallest unit)           |
| `Prices`                                | Multi-currency prices (`Record<currencyCode, PriceInfo>`) |
| `MediaItem`                             | Media asset (image or video)                              |
| **Onetime Product**                     |                                                           |
| `OnetimeProductDetail`                  | One-time product entity                                   |
| `CreateOnetimeProductParams`            | Create request                                            |
| `UpdateOnetimeProductParams`            | Update request (creates new version)                      |
| `PublishOnetimeProductParams`           | Publish test → prod                                       |
| `UpdateOnetimeStatusParams`             | Activate / deactivate                                     |
| **Subscription Product**                |                                                           |
| `SubscriptionProductDetail`             | Subscription product entity                               |
| `CreateSubscriptionProductParams`       | Create request                                            |
| `UpdateSubscriptionProductParams`       | Update request (creates new version)                      |
| `PublishSubscriptionProductParams`      | Publish test → prod                                       |
| `UpdateSubscriptionStatusParams`        | Activate / deactivate                                     |
| **Subscription Product Group**          |                                                           |
| `SubscriptionProductGroup`              | Product group entity                                      |
| `GroupRules`                            | Group rules (shared trial, etc.)                          |
| `CreateSubscriptionProductGroupParams`  | Create request                                            |
| `UpdateSubscriptionProductGroupParams`  | Update request (`productIds` = full replacement)          |
| `DeleteSubscriptionProductGroupParams`  | Delete request                                            |
| `PublishSubscriptionProductGroupParams` | Publish test → prod                                       |
| **Order**                               |                                                           |
| `CancelSubscriptionParams`              | Cancel subscription request                               |
| `CancelSubscriptionResult`              | Cancel subscription response                              |
| `BillingDetail`                         | Customer billing details (country, tax ID, etc.)          |
| **Customer Self-Service**               |                                                           |
| `CancelOnetimeOrderParams`              | Cancel one-time order request                             |
| `CancelOnetimeOrderResult`              | Cancel one-time order response                            |
| `ReactivateSubscriptionParams`          | Reactivate subscription request                           |
| `ReactivateSubscriptionResult`          | Reactivate subscription response                          |
| `CreateRefundTicketParams`              | Create refund ticket request                              |
| `ResubmitRefundTicketParams`            | Resubmit refund ticket request                            |
| `RefundTicket`                          | Refund ticket entity                                      |
| `RequestedAmount`                       | Refund amount (`{ amount, currency }`)                    |
| **Checkout**                            |                                                           |
| `AuthenticatedCheckoutParams`           | Authenticated checkout request (with customer identity)   |
| `AuthenticatedCheckoutResult`           | Authenticated checkout response (URL with token + expiry) |
| `AnonymousCheckoutParams`               | Anonymous checkout request (no identity)                  |
| `CreateCheckoutSessionParams`           | Low-level checkout session request                        |
| `CheckoutSessionResult`                 | Checkout session response (URL + expiry)                  |
| **GraphQL**                             |                                                           |
| `GraphQLParams`                         | GraphQL query parameters                                  |
| `GraphQLResponse<T>`                    | GraphQL response envelope                                 |
| **Webhook**                             |                                                           |
| `WebhookEvent<T>`                       | Webhook event payload                                     |
| `WebhookEventData`                      | Common event data fields                                  |
| `VerifyWebhookOptions`                  | Verification options (environment, tolerance)             |

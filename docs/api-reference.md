# API Reference

Complete reference for all `@waffo/pancake-ts` resources, parameters, and return types.

> **Conventions**:
> - All amounts are in the **smallest currency unit** (e.g. 999 = $9.99 USD, 4500 = ¥4500 JPY)
> - All timestamps are **ISO 8601 UTC** strings
> - Product updates follow **immutable versioning** — each update creates a new version, skipped if content is unchanged
> - The **publish** flow promotes a test version to production

---

## Auth

### `client.auth.issueSessionToken(params)`

Issue a buyer session token (JWT) for storefront authentication.

```typescript
const { token, expiresAt } = await client.auth.issueSessionToken({
  storeId: "store_xxx",
  buyerIdentity: "customer@example.com",
});
```

**Parameters `IssueSessionTokenParams`**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `storeId` | `string` | Yes | Store ID |
| `buyerIdentity` | `string` | Yes | Buyer identity (email or merchant-defined identifier) |

**Returns `SessionToken`**:

| Field | Type | Description |
|-------|------|-------------|
| `token` | `string` | JWT token string |
| `expiresAt` | `string` | Token expiration time |

---

## Stores

### `client.stores.create(params)`

Create a store. The URL slug is auto-generated from the name.

```typescript
const { store } = await client.stores.create({ name: "My Store" });
```

**Parameters `CreateStoreParams`**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Store name |

**Returns `{ store: Store }`**

### `client.stores.update(params)`

Update store settings including webhook endpoints, notification preferences, and checkout page styling.

```typescript
const { store } = await client.stores.update({
  id: "store_xxx",
  name: "Updated Name",
  supportEmail: "help@example.com",
  isPublic: true,
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
      checkoutColorTextSecondary: "#666666",
      checkoutBorderRadius: "8px",
    },
    dark: {
      checkoutLogo: null,
      checkoutColorPrimary: "#ffffff",
      checkoutColorBackground: "#1a1a1a",
      checkoutColorCard: "#2a2a2a",
      checkoutColorText: "#ffffff",
      checkoutColorTextSecondary: "#999999",
      checkoutBorderRadius: "8px",
    },
  },
});
```

**Parameters `UpdateStoreParams`**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Store ID |
| `name` | `string` | No | Store name |
| `status` | `EntityStatus` | No | Store status |
| `logo` | `string \| null` | No | Logo URL |
| `supportEmail` | `string \| null` | No | Support email address |
| `website` | `string \| null` | No | Store website URL |
| `isPublic` | `boolean` | No | Whether the store is publicly visible |
| `webhookSettings` | `WebhookSettings \| null` | No | Webhook endpoint configuration (test/prod URLs and subscribed event types) |
| `notificationSettings` | `NotificationSettings \| null` | No | Email notification preferences |
| `checkoutSettings` | `CheckoutSettings \| null` | No | Checkout page theme (light/dark) |

**Returns `{ store: Store }`**

### `client.stores.delete(params)`

Soft-delete a store. Only the store owner can perform this operation.

```typescript
const { store } = await client.stores.delete({ id: "store_xxx" });
```

**Parameters `DeleteStoreParams`**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Store ID |

**Returns `{ store: Store }`**

---

## Store Merchants

> Coming soon — endpoints currently return 501.

### `client.storeMerchants.add(params)`

Add a merchant to a store with a specified role.

```typescript
const result = await client.storeMerchants.add({
  storeId: "store_xxx",
  email: "member@example.com",
  role: "admin",
});
```

**Parameters `AddMerchantParams`**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `storeId` | `string` | Yes | Store ID |
| `email` | `string` | Yes | Merchant email |
| `role` | `"admin" \| "member"` | Yes | Role to assign |

**Returns `AddMerchantResult`**:

| Field | Type | Description |
|-------|------|-------------|
| `storeId` | `string` | Store ID |
| `merchantId` | `string` | Merchant ID |
| `email` | `string` | Merchant email |
| `role` | `string` | Assigned role |
| `status` | `string` | Membership status |
| `addedAt` | `string` | Timestamp when added |

### `client.storeMerchants.remove(params)`

Remove a merchant from a store.

```typescript
const result = await client.storeMerchants.remove({
  storeId: "store_xxx",
  merchantId: "merchant_xxx",
});
```

**Parameters `RemoveMerchantParams`**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `storeId` | `string` | Yes | Store ID |
| `merchantId` | `string` | Yes | Merchant ID |

**Returns `RemoveMerchantResult`**:

| Field | Type | Description |
|-------|------|-------------|
| `message` | `string` | Operation message |
| `removedAt` | `string` | Timestamp when removed |

### `client.storeMerchants.updateRole(params)`

Update a merchant's role within a store.

```typescript
const result = await client.storeMerchants.updateRole({
  storeId: "store_xxx",
  merchantId: "merchant_xxx",
  role: "member",
});
```

**Parameters `UpdateRoleParams`**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `storeId` | `string` | Yes | Store ID |
| `merchantId` | `string` | Yes | Merchant ID |
| `role` | `"admin" \| "member"` | Yes | New role |

**Returns `UpdateRoleResult`**:

| Field | Type | Description |
|-------|------|-------------|
| `storeId` | `string` | Store ID |
| `merchantId` | `string` | Merchant ID |
| `role` | `string` | Updated role |
| `updatedAt` | `string` | Timestamp when updated |

---

## Onetime Products

### `client.onetimeProducts.create(params)`

Create a one-time product with multi-currency pricing.

```typescript
import { TaxCategory } from "@waffo/pancake-ts";

const { product } = await client.onetimeProducts.create({
  storeId: "store_xxx",
  name: "E-Book: TypeScript Handbook",
  description: "Complete TypeScript guide for developers",
  prices: {
    USD: { amount: 2900, taxIncluded: false, taxCategory: TaxCategory.DigitalGoods },
    EUR: { amount: 2700, taxIncluded: true, taxCategory: TaxCategory.DigitalGoods },
    JPY: { amount: 4500, taxIncluded: true, taxCategory: TaxCategory.DigitalGoods },
  },
  media: [{ type: "image", url: "https://example.com/cover.jpg", alt: "Book cover" }],
  successUrl: "https://example.com/thank-you",
  metadata: { sku: "ebook-ts-001" },
});
```

**Parameters `CreateOnetimeProductParams`**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `storeId` | `string` | Yes | Store ID |
| `name` | `string` | Yes | Product name |
| `prices` | `Prices` | Yes | Multi-currency prices (`Record<string, PriceInfo>`) |
| `description` | `string` | No | Product description |
| `media` | `MediaItem[]` | No | Media assets (images, videos) |
| `successUrl` | `string` | No | Redirect URL after successful payment |
| `metadata` | `Record<string, unknown>` | No | Custom metadata |

**Returns `{ product: OnetimeProductDetail }`**

### `client.onetimeProducts.update(params)`

Update a one-time product. Creates a new immutable version; skips if content is unchanged.

```typescript
const { product } = await client.onetimeProducts.update({
  id: "prod_xxx",
  name: "E-Book: TypeScript Handbook v2",
  prices: { USD: { amount: 3900, taxIncluded: false, taxCategory: "digital_goods" } },
});
```

**Parameters `UpdateOnetimeProductParams`**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Product ID |
| `name` | `string` | Yes | Product name |
| `prices` | `Prices` | Yes | Multi-currency prices |
| `description` | `string` | No | Product description |
| `media` | `MediaItem[]` | No | Media assets |
| `successUrl` | `string` | No | Redirect URL after successful payment |
| `metadata` | `Record<string, unknown>` | No | Custom metadata |

**Returns `{ product: OnetimeProductDetail }`**

### `client.onetimeProducts.publish(params)`

Publish the test version to production.

```typescript
const { product } = await client.onetimeProducts.publish({ id: "prod_xxx" });
```

**Parameters `PublishOnetimeProductParams`**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Product ID |

**Returns `{ product: OnetimeProductDetail }`**

### `client.onetimeProducts.updateStatus(params)`

Activate or deactivate a product.

```typescript
import { ProductVersionStatus } from "@waffo/pancake-ts";

const { product } = await client.onetimeProducts.updateStatus({
  id: "prod_xxx",
  status: ProductVersionStatus.Inactive,
});
```

**Parameters `UpdateOnetimeStatusParams`**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Product ID |
| `status` | `ProductVersionStatus` | Yes | `Active` or `Inactive` |

**Returns `{ product: OnetimeProductDetail }`**

---

## Subscription Products

### `client.subscriptionProducts.create(params)`

Create a subscription product with a billing period and multi-currency pricing.

```typescript
import { BillingPeriod, TaxCategory } from "@waffo/pancake-ts";

const { product } = await client.subscriptionProducts.create({
  storeId: "store_xxx",
  name: "Pro Plan",
  billingPeriod: BillingPeriod.Monthly,
  prices: { USD: { amount: 999, taxIncluded: false, taxCategory: TaxCategory.SaaS } },
  description: "Unlimited access to all features",
});
```

**Parameters `CreateSubscriptionProductParams`**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `storeId` | `string` | Yes | Store ID |
| `name` | `string` | Yes | Product name |
| `billingPeriod` | `BillingPeriod` | Yes | Billing period (`Weekly` / `Monthly` / `Quarterly` / `Yearly`) |
| `prices` | `Prices` | Yes | Multi-currency prices |
| `description` | `string` | No | Product description |
| `media` | `MediaItem[]` | No | Media assets |
| `successUrl` | `string` | No | Redirect URL after successful payment |
| `metadata` | `Record<string, unknown>` | No | Custom metadata |

**Returns `{ product: SubscriptionProductDetail }`**

### `client.subscriptionProducts.update(params)`

Update a subscription product. Creates a new immutable version; skips if unchanged.

```typescript
const { product } = await client.subscriptionProducts.update({
  id: "prod_xxx",
  name: "Pro Plan v2",
  billingPeriod: BillingPeriod.Monthly,
  prices: { USD: { amount: 1499, taxIncluded: false, taxCategory: "saas" } },
});
```

**Parameters `UpdateSubscriptionProductParams`**: Same as create, but `id` replaces `storeId`.

**Returns `{ product: SubscriptionProductDetail }`**

### `client.subscriptionProducts.publish(params)`

Publish the test version to production.

```typescript
const { product } = await client.subscriptionProducts.publish({ id: "prod_xxx" });
```

**Returns `{ product: SubscriptionProductDetail }`**

### `client.subscriptionProducts.updateStatus(params)`

Activate or deactivate a subscription product.

```typescript
const { product } = await client.subscriptionProducts.updateStatus({
  id: "prod_xxx",
  status: ProductVersionStatus.Active,
});
```

**Returns `{ product: SubscriptionProductDetail }`**

---

## Subscription Product Groups

Groups enable **shared trial periods** and **plan switching** across related subscription products (e.g. Free / Pro / Enterprise tiers).

### `client.subscriptionProductGroups.create(params)`

```typescript
const { group } = await client.subscriptionProductGroups.create({
  storeId: "store_xxx",
  name: "Pro Plans",
  description: "All Pro tier plans",
  rules: { sharedTrial: true },
  productIds: ["prod_aaa", "prod_bbb"],
});
```

**Parameters `CreateSubscriptionProductGroupParams`**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `storeId` | `string` | Yes | Store ID |
| `name` | `string` | Yes | Group name |
| `description` | `string` | No | Group description |
| `rules` | `GroupRules` | No | Group rules (e.g. `{ sharedTrial: true }`) |
| `productIds` | `string[]` | No | Subscription product IDs to include |

**Returns `{ group: SubscriptionProductGroup }`**

### `client.subscriptionProductGroups.update(params)`

Update a group. `productIds` is a **full replacement** (not a merge).

```typescript
const { group } = await client.subscriptionProductGroups.update({
  id: "group_xxx",
  productIds: ["prod_aaa", "prod_bbb", "prod_ccc"],
});
```

**Returns `{ group: SubscriptionProductGroup }`**

### `client.subscriptionProductGroups.delete(params)`

Hard-delete a group.

```typescript
const { group } = await client.subscriptionProductGroups.delete({ id: "group_xxx" });
```

**Returns `{ group: SubscriptionProductGroup }`**

### `client.subscriptionProductGroups.publish(params)`

Publish a test-environment group to production (upsert).

```typescript
const { group } = await client.subscriptionProductGroups.publish({ id: "group_xxx" });
```

**Returns `{ group: SubscriptionProductGroup }`**

---

## Orders

### `client.orders.cancelSubscription(params)`

Cancel a subscription order. The resulting status depends on the current order state:

| Current Status | Result | Behavior |
|---------------|--------|----------|
| `pending` | `canceled` | Immediate cancellation |
| `active` / `trialing` | `canceling` | PSP cancellation initiated; webhook updates status later |

```typescript
const { orderId, status } = await client.orders.cancelSubscription({
  orderId: "order_xxx",
});
// status: "canceled" or "canceling"
```

**Parameters `CancelSubscriptionParams`**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `orderId` | `string` | Yes | Order ID |

**Returns `CancelSubscriptionResult`**:

| Field | Type | Description |
|-------|------|-------------|
| `orderId` | `string` | Order ID |
| `status` | `string` | Resulting status (`"canceled"` or `"canceling"`) |

---

## Checkout

### `client.checkout.createSession(params)`

Create a checkout session. Returns a URL to redirect the buyer to the hosted checkout page.

```typescript
import { CheckoutSessionProductType } from "@waffo/pancake-ts";

// One-time product checkout
const session = await client.checkout.createSession({
  storeId: "store_xxx",
  productId: "prod_xxx",
  productType: CheckoutSessionProductType.Onetime,
  currency: "USD",
  buyerEmail: "customer@example.com",
  successUrl: "https://example.com/thank-you",
});
// => redirect buyer to session.checkoutUrl

// Subscription with trial
const subSession = await client.checkout.createSession({
  productId: "prod_yyy",
  productType: CheckoutSessionProductType.Subscription,
  currency: "USD",
  withTrial: true,
  billingDetail: { country: "US", isBusiness: false, state: "CA", postcode: "94105" },
});

// With price snapshot override
const snapshotSession = await client.checkout.createSession({
  productId: "prod_xxx",
  productType: "onetime",
  currency: "USD",
  priceSnapshot: { amount: 1999, taxIncluded: false, taxCategory: "digital_goods" },
});
```

**Parameters `CreateCheckoutSessionParams`**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `productId` | `string` | Yes | Product ID |
| `productType` | `CheckoutSessionProductType` | Yes | `"onetime"` or `"subscription"` |
| `currency` | `string` | Yes | Currency code (ISO 4217) |
| `storeId` | `string` | No | Store ID |
| `priceSnapshot` | `PriceInfo` | No | Price snapshot override (reads from DB if omitted) |
| `withTrial` | `boolean` | No | Enable trial period (subscription only) |
| `buyerEmail` | `string` | No | Pre-filled buyer email |
| `billingDetail` | `BillingDetail` | No | Pre-filled billing details (country, tax ID, etc.) |
| `successUrl` | `string` | No | Redirect URL after successful payment |
| `expiresInSeconds` | `number` | No | Session expiry in seconds (default: 7 days) |
| `metadata` | `Record<string, string>` | No | Custom metadata |

**Returns `CheckoutSessionResult`**:

| Field | Type | Description |
|-------|------|-------------|
| `sessionId` | `string` | Session ID |
| `checkoutUrl` | `string` | Hosted checkout page URL |
| `expiresAt` | `string` | Session expiration time |

---

## GraphQL

### `client.graphql.query<T>(params)`

Execute a typed GraphQL query. Only Query operations are supported — Mutations return a 403 error.

```typescript
interface StoresQuery {
  stores: Array<{ id: string; name: string; status: string }>;
}
const result = await client.graphql.query<StoresQuery>({
  query: `query { stores { id name status } }`,
});

const productResult = await client.graphql.query({
  query: `query ($id: ID!) { onetimeProduct(id: $id) { id name prices } }`,
  variables: { id: "prod_xxx" },
});
```

**Parameters `GraphQLParams`**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | `string` | Yes | GraphQL query string |
| `variables` | `Record<string, unknown>` | No | Query variables |

**Returns `GraphQLResponse<T>`**:

| Field | Type | Description |
|-------|------|-------------|
| `data` | `T \| null` | Query result |
| `errors` | `Array<{ message, locations?, path? }>` | GraphQL errors (if any) |

See [GraphQL Guide](graphql-guide.md) for introspection, filters, pagination, and practical examples.

---

## Types

All exported type interfaces:

| Export | Description |
|--------|-------------|
| **Config** | |
| `WaffoPancakeConfig` | Client configuration |
| **Response Envelope** | |
| `ApiError` | Error object (`{ message, layer }`) |
| `ApiErrorResponse` | Error response (`{ data: null, errors }`) |
| `ApiResponse<T>` | Union of success and error responses |
| `ApiSuccessResponse<T>` | Success response (`{ data: T }`) |
| **Auth** | |
| `IssueSessionTokenParams` | Issue token request |
| `SessionToken` | Token response |
| **Store** | |
| `Store` | Store entity |
| `CreateStoreParams` | Create store request |
| `UpdateStoreParams` | Update store request |
| `DeleteStoreParams` | Delete store request |
| `WebhookSettings` | Webhook endpoint configuration (test/prod) |
| `NotificationSettings` | Email notification preferences |
| `CheckoutSettings` | Checkout page theme (light/dark) |
| `CheckoutThemeSettings` | Single-theme checkout styling |
| **Store Merchant** | |
| `AddMerchantParams` | Add merchant request |
| `AddMerchantResult` | Add merchant response |
| `RemoveMerchantParams` | Remove merchant request |
| `RemoveMerchantResult` | Remove merchant response |
| `UpdateRoleParams` | Update role request |
| `UpdateRoleResult` | Update role response |
| **Product (shared)** | |
| `PriceInfo` | Single-currency price (amount in smallest unit) |
| `Prices` | Multi-currency prices (`Record<currencyCode, PriceInfo>`) |
| `MediaItem` | Media asset (image or video) |
| **Onetime Product** | |
| `OnetimeProductDetail` | One-time product entity |
| `CreateOnetimeProductParams` | Create request |
| `UpdateOnetimeProductParams` | Update request (creates new version) |
| `PublishOnetimeProductParams` | Publish test → prod |
| `UpdateOnetimeStatusParams` | Activate / deactivate |
| **Subscription Product** | |
| `SubscriptionProductDetail` | Subscription product entity |
| `CreateSubscriptionProductParams` | Create request |
| `UpdateSubscriptionProductParams` | Update request (creates new version) |
| `PublishSubscriptionProductParams` | Publish test → prod |
| `UpdateSubscriptionStatusParams` | Activate / deactivate |
| **Subscription Product Group** | |
| `SubscriptionProductGroup` | Product group entity |
| `GroupRules` | Group rules (shared trial, etc.) |
| `CreateSubscriptionProductGroupParams` | Create request |
| `UpdateSubscriptionProductGroupParams` | Update request (`productIds` = full replacement) |
| `DeleteSubscriptionProductGroupParams` | Delete request |
| `PublishSubscriptionProductGroupParams` | Publish test → prod |
| **Order** | |
| `CancelSubscriptionParams` | Cancel subscription request |
| `CancelSubscriptionResult` | Cancel subscription response |
| `BillingDetail` | Buyer billing details (country, tax ID, etc.) |
| **Checkout** | |
| `CreateCheckoutSessionParams` | Create checkout session request |
| `CheckoutSessionResult` | Checkout session response (URL + expiry) |
| **GraphQL** | |
| `GraphQLParams` | GraphQL query parameters |
| `GraphQLResponse<T>` | GraphQL response envelope |
| **Webhook** | |
| `WebhookEvent<T>` | Webhook event payload |
| `WebhookEventData` | Common event data fields |
| `VerifyWebhookOptions` | Verification options (environment, tolerance) |

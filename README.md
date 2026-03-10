# @waffo-pancake/sdk

TypeScript SDK for the Waffo Pancake Merchant of Record (MoR) payment platform.

- Zero runtime dependencies, ESM-only, Node >= 18
- Automatic RSA-SHA256 request signing with deterministic idempotency keys
- Full TypeScript type definitions (15 enums, 40+ interfaces)
- Webhook verification with embedded public keys (test/prod)

## Installation

```bash
npm install @waffo-pancake/sdk
```

## Quick Start

```typescript
import { WaffoPancake } from "@waffo-pancake/sdk";

const client = new WaffoPancake({
  merchantId: process.env.WAFFO_MERCHANT_ID!,
  privateKey: process.env.WAFFO_PRIVATE_KEY!,
});

// Create a store
const { store } = await client.stores.create({ name: "My Store" });

// Create a one-time product with multi-currency pricing
const { product } = await client.onetimeProducts.create({
  storeId: store.id,
  name: "E-Book: TypeScript Handbook",
  prices: {
    USD: { amount: 2900, taxIncluded: false, taxCategory: "digital_goods" },
    EUR: { amount: 2700, taxIncluded: true, taxCategory: "digital_goods" },
  },
});

// Create a checkout session and redirect the buyer
const session = await client.checkout.createSession({
  storeId: store.id,
  productId: product.id,
  productType: "onetime",
  currency: "USD",
});
// => redirect buyer to session.checkoutUrl

// Query data via GraphQL (Query only, no Mutations)
const result = await client.graphql.query<{ stores: Array<{ id: string; name: string }> }>({
  query: `query { stores { id name status } }`,
});
```

## Configuration

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `merchantId` | `string` | Yes | Merchant ID, sent as `X-Merchant-Id` header |
| `privateKey` | `string` | Yes | RSA private key in PEM format for request signing |
| `baseUrl` | `string` | No | API base URL (default: `https://waffo-pancake-auth-service.vercel.app`) |
| `fetch` | `typeof fetch` | No | Custom fetch implementation |

## Resources

| Namespace | Methods | Description |
|-----------|---------|-------------|
| `client.auth` | `issueSessionToken()` | Issue a buyer session token (JWT) |
| `client.stores` | `create()` `update()` `delete()` | Store management (webhook, notification, checkout settings) |
| `client.storeMerchants` | `add()` `remove()` `updateRole()` | Store member management (coming soon, returns 501) |
| `client.onetimeProducts` | `create()` `update()` `publish()` `updateStatus()` | One-time product CRUD with multi-currency pricing and version management |
| `client.subscriptionProducts` | `create()` `update()` `publish()` `updateStatus()` | Subscription product CRUD with billing period and version management |
| `client.subscriptionProductGroups` | `create()` `update()` `delete()` `publish()` | Product groups for shared trial and plan switching |
| `client.orders` | `cancelSubscription()` | Order management (pending→canceled, active→canceling) |
| `client.checkout` | `createSession()` | Create a checkout session with trial toggle, billing detail, and price snapshot |
| `client.graphql` | `query<T>()` | Typed GraphQL queries (Query only, no Mutations) |

See [API Reference](docs/api-reference.md) for complete parameter tables and return types.

## Usage Examples

### Auth — Issue a Buyer Session Token

```typescript
const { token, expiresAt } = await client.auth.issueSessionToken({
  storeId: "store_xxx",
  buyerIdentity: "customer@example.com",
});
```

### Stores — Create, Update, Delete

```typescript
// Create a store
const { store } = await client.stores.create({ name: "My Store" });

// Update settings (webhook, notification, checkout theme)
const { store: updated } = await client.stores.update({
  id: store.id,
  supportEmail: "help@example.com",
  webhookSettings: {
    testWebhookUrl: "https://example.com/webhooks",
    prodWebhookUrl: null,
    testEvents: ["order.completed", "subscription.activated"],
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
});

// Soft-delete
const { store: deleted } = await client.stores.delete({ id: store.id });
```

### Onetime Products — Create, Update, Publish

```typescript
import { TaxCategory, ProductVersionStatus } from "@waffo-pancake/sdk";

// Create with multi-currency pricing
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
  metadata: { sku: "ebook-ts-001" },
});

// Update (creates a new immutable version; skips if unchanged)
await client.onetimeProducts.update({
  id: product.id,
  name: "E-Book: TypeScript Handbook v2",
  prices: { USD: { amount: 3900, taxIncluded: false, taxCategory: "digital_goods" } },
});

// Publish test version → production
await client.onetimeProducts.publish({ id: product.id });

// Deactivate
await client.onetimeProducts.updateStatus({ id: product.id, status: ProductVersionStatus.Inactive });
```

### Subscription Products — Create with Billing Period

```typescript
import { BillingPeriod, TaxCategory } from "@waffo-pancake/sdk";

const { product } = await client.subscriptionProducts.create({
  storeId: "store_xxx",
  name: "Pro Plan",
  billingPeriod: BillingPeriod.Monthly,
  prices: { USD: { amount: 999, taxIncluded: false, taxCategory: TaxCategory.SaaS } },
  description: "Unlimited access to all features",
});

// Same update/publish/updateStatus pattern as onetime products
await client.subscriptionProducts.publish({ id: product.id });
```

### Subscription Product Groups — Shared Trial & Plan Switching

```typescript
// Create a group linking related subscription tiers
const { group } = await client.subscriptionProductGroups.create({
  storeId: "store_xxx",
  name: "Pro Plans",
  rules: { sharedTrial: true },
  productIds: ["prod_aaa", "prod_bbb"],
});

// Update members (full replacement, not merge)
await client.subscriptionProductGroups.update({
  id: group.id,
  productIds: ["prod_aaa", "prod_bbb", "prod_ccc"],
});

// Publish / delete
await client.subscriptionProductGroups.publish({ id: group.id });
await client.subscriptionProductGroups.delete({ id: group.id });
```

### Orders — Cancel a Subscription

```typescript
const { orderId, status } = await client.orders.cancelSubscription({
  orderId: "order_xxx",
});
// status: "canceled" (was pending) or "canceling" (was active, PSP notified)
```

### Checkout — Create a Session

```typescript
import { CheckoutSessionProductType } from "@waffo-pancake/sdk";

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

// Subscription with trial and billing detail
const subSession = await client.checkout.createSession({
  productId: "prod_yyy",
  productType: CheckoutSessionProductType.Subscription,
  currency: "USD",
  withTrial: true,
  billingDetail: { country: "US", isBusiness: false, state: "CA", postcode: "94105" },
});
```

### GraphQL — Typed Queries

```typescript
// Simple query
interface StoresQuery {
  stores: Array<{ id: string; name: string; status: string }>;
}
const result = await client.graphql.query<StoresQuery>({
  query: `query { stores { id name status } }`,
});

// Query with variables
const product = await client.graphql.query({
  query: `query ($id: ID!) { onetimeProduct(id: $id) { id name prices } }`,
  variables: { id: "prod_xxx" },
});

// Nested relationships in a single request
const detail = await client.graphql.query({
  query: `query ($id: ID!) {
    store(id: $id) {
      id name
      onetimeProducts { id name status prices }
      subscriptionProducts { id name billingPeriod status }
    }
  }`,
  variables: { id: "store_xxx" },
});
```

See [GraphQL Guide](docs/graphql-guide.md) for introspection, filters, pagination, and more examples.

## Webhook Verification

The SDK exports a standalone `verifyWebhook()` function with **embedded RSA-SHA256 public keys** for both test and production environments. No need to manage keys yourself.

```typescript
import { verifyWebhook, WebhookEventType } from "@waffo-pancake/sdk";

// Express (IMPORTANT: use raw body — parsed JSON breaks signature verification)
app.post("/webhooks", express.raw({ type: "application/json" }), (req, res) => {
  try {
    const event = verifyWebhook(
      req.body.toString("utf-8"),
      req.headers["x-waffo-signature"] as string,
    );

    // Respond immediately, process asynchronously
    res.status(200).send("OK");

    // Use event.id for idempotent deduplication
    switch (event.eventType) {
      case WebhookEventType.OrderCompleted:
        console.log(`Order ${event.data.orderId} completed`);
        break;
      case WebhookEventType.SubscriptionActivated:
        console.log(`Subscription activated for ${event.data.buyerEmail}`);
        break;
      case WebhookEventType.SubscriptionCanceled:
        console.log(`Subscription canceled: ${event.data.orderId}`);
        break;
      case WebhookEventType.RefundSucceeded:
        console.log(`Refund ${event.data.amount} ${event.data.currency}`);
        break;
    }
  } catch {
    res.status(401).send("Invalid signature");
  }
});

// Next.js App Router
export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get("x-waffo-signature");
  try {
    const event = verifyWebhook(body, sig);
    // handle event ...
    return new Response("OK");
  } catch {
    return new Response("Invalid signature", { status: 401 });
  }
}

// Options: specify environment, disable/customize replay protection
const event = verifyWebhook(body, sig, { environment: "prod" });
const event = verifyWebhook(body, sig, { toleranceMs: 0 }); // disable replay check
```

See [Webhook Guide](docs/webhook-guide.md) for all 10 event types, signature algorithm, and best practices.

## Error Handling

API errors throw `WaffoPancakeError` with the HTTP status code and a call-stack-ordered errors array.

```typescript
import { WaffoPancakeError } from "@waffo-pancake/sdk";

try {
  await client.stores.create({ name: "" });
} catch (err) {
  if (err instanceof WaffoPancakeError) {
    console.log(err.status);  // 400
    console.log(err.errors);  // [{ message: "...", layer: "store" }, ...]
    // errors[0] = deepest layer, errors[n] = outermost layer
  }
}
```

## Exports

### Classes

| Export | Description |
|--------|-------------|
| `WaffoPancake` | SDK client with auto-signed requests |
| `WaffoPancakeError` | API error with status and call-stack errors |

### Functions

| Export | Description |
|--------|-------------|
| `verifyWebhook` | RSA-SHA256 webhook signature verification |

### Enums

Runtime-accessible values. Both `Enum.Value` and string literal syntax are supported.

| Export | Values |
|--------|--------|
| `Environment` | `Test`, `Prod` |
| `TaxCategory` | `DigitalGoods`, `SaaS`, `Software`, `Ebook`, `OnlineCourse`, `Consulting`, `ProfessionalService` |
| `BillingPeriod` | `Weekly`, `Monthly`, `Quarterly`, `Yearly` |
| `ProductVersionStatus` | `Active`, `Inactive` |
| `EntityStatus` | `Active`, `Inactive`, `Suspended` |
| `StoreRole` | `Owner`, `Admin`, `Member` |
| `OnetimeOrderStatus` | `Pending`, `Completed`, `Canceled` |
| `SubscriptionOrderStatus` | `Pending`, `Active`, `Canceling`, `Canceled`, `PastDue`, `Expired` |
| `PaymentStatus` | `Pending`, `Succeeded`, `Failed`, `Canceled` |
| `RefundTicketStatus` | `Pending`, `Approved`, `Rejected`, `Processing`, `Succeeded`, `Failed` |
| `RefundStatus` | `Succeeded`, `Failed` |
| `MediaType` | `Image`, `Video` |
| `CheckoutSessionProductType` | `Onetime`, `Subscription` |
| `ErrorLayer` | `Gateway`, `User`, `Store`, `Product`, `Order`, `GraphQL`, `Resource`, `Email` |
| `WebhookEventType` | `OrderCompleted`, `SubscriptionActivated`, `SubscriptionPaymentSucceeded`, `SubscriptionCanceling`, `SubscriptionUncanceled`, `SubscriptionUpdated`, `SubscriptionCanceled`, `SubscriptionPastDue`, `RefundSucceeded`, `RefundFailed` |

### Types

See [API Reference — Types](docs/api-reference.md#types) for the full list of 40+ exported interfaces.

## Development

```bash
npm run lint            # ESLint 9 (TypeScript ESLint + import order + JSDoc)
npm run test            # Vitest
npm run test:watch      # Vitest in watch mode
npm run test:coverage   # Vitest with v8 coverage
npm run build           # TypeScript compilation to dist/
```

## Project Structure

```
src/
├── index.ts               # Unified export entry
├── client.ts              # WaffoPancake main class
├── http-client.ts         # HTTP client (auto-signing + idempotency)
├── signing.ts             # RSA-SHA256 request signing
├── errors.ts              # WaffoPancakeError
├── webhooks.ts            # Webhook verification (embedded keys)
├── types.ts               # Type definitions & enums
├── __tests__/             # Test suite
└── resources/             # API resource classes
    ├── auth.ts
    ├── stores.ts
    ├── store-merchants.ts
    ├── onetime-products.ts
    ├── subscription-products.ts
    ├── subscription-product-groups.ts
    ├── orders.ts
    ├── checkout.ts
    └── graphql.ts
docs/
├── api-reference.md       # Complete API reference
├── graphql-guide.md       # GraphQL usage guide
└── webhook-guide.md       # Webhook verification guide
```

## License

MIT

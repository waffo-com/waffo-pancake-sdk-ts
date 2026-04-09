# @waffo/pancake-ts

TypeScript SDK for the Waffo Pancake Merchant of Record (MoR) payment platform.

- Zero runtime dependencies, ESM + CJS, Node >= 20
- Automatic RSA-SHA256 request signing with deterministic idempotency keys
- Full TypeScript type definitions (15 enums, 40+ interfaces)
- Webhook verification with embedded public keys (test/prod)

## Installation

```bash
npm install @waffo/pancake-ts
```

## Quick Start

> Most merchants create stores and products in the [Dashboard](https://pancake.waffo.ai/dashboard). The SDK is primarily used for **checkout integration** — redirecting buyers from your site to the Waffo checkout page.

```typescript
import { WaffoPancake } from "@waffo/pancake-ts";

// Merchant ID and API Key are available in Dashboard > Settings > Developers
const client = new WaffoPancake({
  merchantId: process.env.WAFFO_MERCHANT_ID!,  // MER_{base62} format
  privateKey: process.env.WAFFO_PRIVATE_KEY!,
});

// Create a checkout session — one call handles token + session + URL
const result = await client.checkout.authenticated.create({
  productId: "PROD_xxx",   // from Dashboard > Products
  currency: "USD",
  buyerIdentity: req.user.email,  // your user's identity
});

// Redirect buyer to the checkout page (opens in new tab)
res.json({ checkoutUrl: result.checkoutUrl });
// => checkoutUrl includes #token=... (form pre-filled)
```

## Configuration

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `merchantId` | `string` | Yes | Merchant ID in `MER_{base62}` format |
| `privateKey` | `string` | Yes | RSA private key in PEM format (auto-normalized, see [docs](docs/api-reference.md)) |
| `baseUrl` | `string` | No | API base URL override |
| `fetch` | `typeof fetch` | No | Custom fetch implementation |
| `webhookPublicKey` | `string \| { test?, prod? }` | No | Custom webhook public key(s) |

The SDK auto-normalizes key formats: standard PEM, PKCS#1, literal `\n` from env vars, raw base64, and Windows line endings are all accepted.

## Checkout Integration

Waffo supports two checkout modes based on whether the merchant knows the buyer's identity:

- **Merchants with their own sites** know who the buyer is — they have user accounts, login systems, or collect buyer info before checkout. The merchant provides the buyer's identity upfront, and the checkout form arrives pre-filled.
- **Template stores and shared links** have no prior buyer context — the buyer arrives directly at the checkout page and fills in their own details.

| Mode | Method | Buyer Identity | Form State | Use Case |
|------|--------|---------------|------------|----------|
| **Authenticated** | `checkout.authenticated.create()` | Merchant provides | Pre-filled | Merchant sites with user accounts |
| **Anonymous** | `checkout.anonymous.create()` | Not provided | Empty | Template stores, one-time purchase links |

> **We recommend authenticated checkout whenever possible.** The most important reason: authenticated checkout binds the order to the `buyerIdentity` you provide, which is a **merchant-controlled stable identifier**. Even if the buyer changes the email on the checkout form, the order is still tied to the identity you specified. In anonymous mode, the buyer self-reports their email on the form — if they enter a different address, the system treats them as a new user, which means **previous orders become unlinked** and **subscription trial periods can be exploited** (a new email = a new user = a fresh trial).
>
> | | Authenticated | Anonymous |
> |---|---|---|
> | **Identity** | Merchant-provided, stable across orders | Self-reported email, may vary |
> | **Form** | Pre-filled from merchant-provided identity | Empty, buyer fills manually |
> | **Post-purchase** | Full self-service (see [Buyer Self-Service](#buyer-self-service)) | Create orders only — no post-purchase self-service |
> | **Session** | 5-minute TTL, auto-refreshes | 1-minute, single-use |

Both modes support **dynamic pricing** and **trial control** at checkout time:

- `priceSnapshot` — override the product's stored price with a custom amount (e.g., coupon, volume discount)
- `withTrial` — explicitly enable or disable the trial period for subscriptions (`true` = force trial, `false` = skip trial, omit = use default rules)

### Authenticated Checkout (Recommended)

The merchant provides buyer identity — the SDK issues a session token, creates a checkout session, and returns a checkout URL with the token appended as a URL fragment. One call does everything.

```typescript
// Basic — buyer identity only
const result = await client.checkout.authenticated.create({
  productId: "PROD_xxx",
  currency: "USD",
  buyerIdentity: "customer@example.com",
});

// With dynamic pricing — override stored price (e.g., coupon, volume discount)
const result = await client.checkout.authenticated.create({
  productId: "PROD_xxx",
  currency: "USD",
  buyerIdentity: "customer@example.com",
  priceSnapshot: { amount: "19.99", taxCategory: "digital_goods" },
});

// Subscription with trial control + billing detail pre-fill
const result = await client.checkout.authenticated.create({
  productId: "PROD_xxx",
  currency: "USD",
  buyerIdentity: "customer@example.com",
  withTrial: true,  // force enable trial (false = skip, omit = default rules)
  billingDetail: { country: "US", isBusiness: false },
});

// result.checkoutUrl = "https://pancake.waffo.ai/store/{slug}/checkout/{sessionId}#token={JWT}"
window.open(result.checkoutUrl, "_blank", "noopener,noreferrer");
```

The token is passed via the URL fragment (after `#`), which is never sent to the server and never appears in the `Referer` header.

### Anonymous Checkout

No buyer identity required — the buyer fills in billing details manually on the checkout page.

```typescript
const result = await client.checkout.anonymous.create({
  productId: "PROD_xxx",
  currency: "USD",
});

// Also supports priceSnapshot and withTrial
const result = await client.checkout.anonymous.create({
  productId: "PROD_xxx",
  currency: "USD",
  priceSnapshot: { amount: "4.99", taxCategory: "saas" },
  withTrial: false,  // skip trial for this session
});

window.open(result.checkoutUrl, "_blank", "noopener,noreferrer");
```

### Opening the Checkout Page

**We recommend opening the checkout page in a new tab** rather than navigating in the current page:

- Buyers can return to your site immediately after payment or if they close the checkout tab
- Merchant page state (cart, forms, scroll position) is preserved
- Payment flow is decoupled from the browsing experience, reducing checkout abandonment

```typescript
// Recommended: open in a new tab
window.open(result.checkoutUrl, "_blank", "noopener,noreferrer");

// Or via an <a> tag
// <a href={checkoutUrl} target="_blank" rel="noopener noreferrer">Proceed to Checkout</a>
```

> **Not recommended:** `window.location.href = result.checkoutUrl` replaces the current page, preventing buyers from returning to your site without browser back navigation.

See [API Reference — Checkout](docs/api-reference.md#checkout) for full parameter tables and `BillingDetail` field requirements.

## Webhook Verification

After a buyer completes payment, Waffo sends webhook events to your server. The SDK provides two ways to verify signatures:

### Standalone Function (built-in keys)

```typescript
import { verifyWebhook, WebhookEventType } from "@waffo/pancake-ts";

// Express (IMPORTANT: use raw body — parsed JSON breaks signature verification)
app.post("/webhooks", express.raw({ type: "application/json" }), (req, res) => {
  try {
    const event = verifyWebhook(
      req.body.toString("utf-8"),
      req.headers["x-waffo-signature"] as string,
    );

    // Respond immediately, process asynchronously
    res.status(200).send("OK");

    switch (event.eventType) {
      case WebhookEventType.OrderCompleted:
        console.log(`Order ${event.data.orderId} completed`);
        break;
      case WebhookEventType.SubscriptionActivated:
        console.log(`Subscription activated for ${event.data.buyerEmail}`);
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
    return new Response("OK");
  } catch {
    return new Response("Invalid signature", { status: 401 });
  }
}
```

### Client Instance Method (multi-level key resolution)

```typescript
const client = new WaffoPancake({
  merchantId: "MER_xxx",
  privateKey: "...",
  webhookPublicKey: {
    test: process.env.WAFFO_TEST_PUB_KEY!,
    prod: process.env.WAFFO_PROD_PUB_KEY!,
  },
});
const event = client.webhooks.verify(rawBody, sig, { environment: "prod" });
```

See [Webhook Guide](docs/webhook-guide.md) for event types, dual-environment key architecture, key resolution chain, retry mechanism, and best practices.

## Buyer Self-Service

Beyond checkout, you can let buyers manage their own orders and subscriptions — for example, embedding a "Cancel Subscription" or "Request Refund" button in your site.

Issue a session token, then use `client.buyer(token)` to get a session with self-service methods:

```typescript
// Your backend — issue a session token for the buyer
const { token } = await client.auth.issueSessionToken({
  storeId: "STO_xxx",
  buyerIdentity: req.user.email,
});

// Create a buyer session
const buyer = client.buyer(token);

// Cancel a subscription
const { orderId, status } = await buyer.cancelSubscription({ orderId: "ORD_xxx" });
// status: "canceling" (active) or "canceled" (pending)

// Reactivate a canceled subscription
await buyer.reactivateSubscription({ orderId: "ORD_xxx" });

// Cancel a one-time order (while payment is pending)
await buyer.cancelOnetimeOrder({ orderId: "ORD_yyy" });

// Submit a refund request
const { ticket } = await buyer.createRefundTicket({
  paymentId: "PAY_xxx",
  reason: "Product not as described",
  requestedAmount: { amount: "29.00", currency: "USD" },
});

// Resubmit a rejected refund ticket
await buyer.resubmitRefundTicket({
  ticketId: "TKT_xxx",
  paymentId: "PAY_xxx",
  reason: "Updated reason with more detail",
  requestedAmount: { amount: "29.00", currency: "USD" },
});

// Query the buyer's own orders via GraphQL
const result = await buyer.graphql.query({
  query: `query { orders { id status createdAt } }`,
});
```

The token is scoped to the specified store and buyer identity — buyers can only access their own data. Token TTL is 5 minutes and auto-refreshes on each API call.

> **Note**: This uses the same `buyerIdentity` as `checkout.authenticated.create()`. Orders placed via authenticated checkout are automatically tied to this identity, so the buyer can manage them later with a token issued here.

## GraphQL — Typed Queries

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
  variables: { id: "PROD_xxx" },
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
  variables: { id: "STO_xxx" },
});
```

See [GraphQL Guide](docs/graphql-guide.md) for filters, analytics queries, delivery logs, and more.

## Programmatic Store & Product Management

> Most merchants manage stores and products in the [Dashboard](https://pancake.waffo.ai/dashboard). The following APIs are for merchants who need programmatic automation.

### Stores

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

### Products

```typescript
import { TaxCategory, BillingPeriod, ProductVersionStatus } from "@waffo/pancake-ts";

// One-time product with multi-currency pricing
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
  metadata: { sku: "ebook-ts-001" },
});

// Update (creates a new immutable version; skips if unchanged)
await client.onetimeProducts.update({
  id: product.id,
  name: "E-Book: TypeScript Handbook v2",
  prices: { USD: { amount: "39.00", taxCategory: "digital_goods" } },
});

// Publish test version → production
await client.onetimeProducts.publish({ id: product.id });

// Deactivate
await client.onetimeProducts.updateStatus({ id: product.id, status: ProductVersionStatus.Inactive });

// Subscription product
const { product: sub } = await client.subscriptionProducts.create({
  storeId: "STO_xxx",
  name: "Pro Plan",
  billingPeriod: BillingPeriod.Monthly,
  prices: { USD: { amount: "9.99", taxCategory: TaxCategory.SaaS } },
});
await client.subscriptionProducts.publish({ id: sub.id });
```

### Subscription Product Groups

```typescript
// Create a group linking related subscription tiers
const { group } = await client.subscriptionProductGroups.create({
  storeId: "STO_xxx",
  name: "Pro Plans",
  rules: { sharedTrial: true },
  productIds: ["PROD_aaa", "PROD_bbb"],
});

// Update members (full replacement, not merge)
await client.subscriptionProductGroups.update({
  id: group.id,
  productIds: ["PROD_aaa", "PROD_bbb", "PROD_ccc"],
});

// Publish / delete
await client.subscriptionProductGroups.publish({ id: group.id });
await client.subscriptionProductGroups.delete({ id: group.id });
```

### Orders

```typescript
const { orderId, status } = await client.orders.cancelSubscription({
  orderId: "ORD_xxx",
});
// status: "canceled" (was pending) or "canceling" (was active, PSP notified)
```

## Error Handling

API errors throw `WaffoPancakeError` with the HTTP status code and a call-stack-ordered errors array.

```typescript
import { WaffoPancakeError } from "@waffo/pancake-ts";

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

## Resources

| Namespace | Methods | Description |
|-----------|---------|-------------|
| `client.checkout.authenticated` | `create()` | Authenticated checkout (recommended) |
| `client.checkout.anonymous` | `create()` | Anonymous checkout |
| `client.checkout` | `createSession()` | Low-level checkout session |
| `client.buyer(token)` | `cancelSubscription()` `cancelOnetimeOrder()` `reactivateSubscription()` `createRefundTicket()` `resubmitRefundTicket()` | Buyer self-service |
| `client.buyer(token).graphql` | `query<T>()` | Buyer-scoped GraphQL queries |
| `client.webhooks` | `verify<T>()` | Webhook signature verification |
| `client.graphql` | `query<T>()` | Merchant GraphQL queries |
| `client.auth` | `issueSessionToken()` | Issue a buyer session token (JWT) |
| `client.stores` | `create()` `update()` `delete()` | Store management |
| `client.storeMerchants` | `add()` `remove()` `updateRole()` | Store members (coming soon) |
| `client.onetimeProducts` | `create()` `update()` `publish()` `updateStatus()` | One-time products |
| `client.subscriptionProducts` | `create()` `update()` `publish()` `updateStatus()` | Subscription products |
| `client.subscriptionProductGroups` | `create()` `update()` `delete()` `publish()` | Product groups |
| `client.orders` | `cancelSubscription()` | Order management |

## Documentation

| Document | Content |
|----------|---------|
| [API Reference](docs/api-reference.md) | Complete method reference — parameters, return types, `BillingDetail` fields |
| [GraphQL Guide](docs/graphql-guide.md) | Queries, filters, analytics, introspection, delivery logs |
| [Webhook Guide](docs/webhook-guide.md) | Signature verification, event types, key resolution, retry mechanism |
| [Changelog](CHANGELOG.md) | Version history and migration guides |

## Exports

### Classes & Functions

| Export | Description |
|--------|-------------|
| `WaffoPancake` | SDK client with auto-signed requests |
| `WaffoPancakeError` | API error with status and call-stack errors |
| `verifyWebhook` | Standalone webhook signature verification |

### Enums

| Export | Values |
|--------|--------|
| `Environment` | `Test`, `Prod` |
| `TaxCategory` | `DigitalGoods`, `SaaS`, `Software`, `Ebook`, `OnlineCourse`, `Consulting`, `ProfessionalService` |
| `BillingPeriod` | `Weekly`, `Monthly`, `Quarterly`, `Yearly` |
| `ProductVersionStatus` | `Active`, `Inactive` |
| `EntityStatus` | `Active`, `Inactive`, `Suspended` |
| `StoreRole` | `Owner`, `Admin`, `Member` |
| `OnetimeOrderStatus` | `Pending`, `Completed`, `Canceled` |
| `SubscriptionOrderStatus` | `Pending`, `Active`, `Canceling`, `PastDue`, `Closed`, `Canceled`, `Expired` |
| `PaymentStatus` | `Pending`, `Succeeded`, `Failed`, `Canceled` |
| `RefundTicketStatus` | `Pending`, `Approved`, `Rejected`, `Processing`, `Succeeded`, `Failed` |
| `RefundStatus` | `Succeeded`, `Failed` |
| `MediaType` | `Image`, `Video` |
| `CheckoutSessionProductType` | `Onetime`, `Subscription` |
| `ErrorLayer` | `Gateway`, `User`, `Store`, `Product`, `Order`, `Ticket`, `GraphQL`, `Resource`, `Email` |
| `WebhookEventType` | `OrderCompleted`, `SubscriptionActivated`, `SubscriptionPaymentSucceeded`, `SubscriptionCanceling`, `SubscriptionUncanceled`, `SubscriptionUpdated`, `SubscriptionCanceled`, `SubscriptionPastDue`, `RefundSucceeded`, `RefundFailed` |

### Types

Key types: `WaffoPancakeConfig`, `AuthenticatedCheckoutParams`, `AuthenticatedCheckoutResult`, `AnonymousCheckoutParams`, `CheckoutSessionResult`, `Store`, `OnetimeProductDetail`, `SubscriptionProductDetail`, `WebhookEvent<T>`, `GraphQLResponse<T>`, and 30+ more. See [API Reference](docs/api-reference.md#types) for the full list.

## Development

```bash
npm run lint            # ESLint 9 (TypeScript ESLint + import order + JSDoc)
npm run test            # Vitest
npm run test:watch      # Vitest in watch mode
npm run test:coverage   # Vitest with v8 coverage
npm run build           # tsup → ESM + CJS + DTS
```

## Project Structure

```
src/
├── index.ts               # Unified export entry
├── client.ts              # WaffoPancake main class
├── http-client.ts         # HTTP client (API Key, auto-signing + idempotency)
├── buyer-http-client.ts   # HTTP client (Bearer token, buyer self-service)
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
    ├── buyer.ts
    ├── orders.ts
    ├── checkout.ts
    ├── checkout-anonymous.ts
    ├── checkout-authenticated.ts
    ├── graphql.ts
    └── webhooks.ts
docs/
├── api-reference.md       # Complete API reference
├── graphql-guide.md       # GraphQL queries & analytics
└── webhook-guide.md       # Webhook verification guide
```

## License

MIT

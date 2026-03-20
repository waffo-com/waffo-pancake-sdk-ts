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

```typescript
import { WaffoPancake } from "@waffo/pancake-ts";

const client = new WaffoPancake({
  merchantId: "mer_2D5F8G3H1K4M6N9P0Q7R8S", // mer_{base62} format
  privateKey: process.env.WAFFO_PRIVATE_KEY!,
});

// Create a store — IDs are returned in {prefix}_{base62} format
const { store } = await client.stores.create({ name: "My Store" });
// => store.id = "sto_..."

// Create a one-time product with multi-currency pricing
const { product } = await client.onetimeProducts.create({
  storeId: store.id, // "sto_..."
  name: "E-Book: TypeScript Handbook",
  prices: {
    USD: { amount: 2900, taxCategory: "digital_goods" },
    EUR: { amount: 2700, taxCategory: "digital_goods" },
  },
});
// => product.id = "otp_..."

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
| `merchantId` | `string` | Yes | Merchant ID in `mer_{base62}` format (sent as `X-Merchant-Id` header) |
| `privateKey` | `string` | Yes | RSA private key (see [Private Key Formats](#private-key-formats) below) |
| `baseUrl` | `string` | No | API base URL (default: `https://waffo-pancake-auth-service.vercel.app`) |
| `fetch` | `typeof fetch` | No | Custom fetch implementation |
| `webhookPublicKey` | `string \| { test?, prod? }` | No | Custom webhook public key(s) (see [Webhook Public Key Resolution](#webhook-public-key-resolution) below) |

### Private Key Formats

The SDK automatically normalizes `privateKey` at construction time, so all of the following formats are accepted:

| Format | Example | Notes |
|--------|---------|-------|
| Standard PKCS#8 PEM | `-----BEGIN PRIVATE KEY-----\n...` | Recommended |
| PKCS#1 PEM | `-----BEGIN RSA PRIVATE KEY-----\n...` | Also accepted |
| Literal `\n` (env vars) | `"-----BEGIN PRIVATE KEY-----\\nMIIE..."` | Common when stored in `.env` or CI secrets |
| Windows line endings | `\r\n` | Converted to `\n` |
| Raw base64 (no headers) | `MIIEvQIBADANBgkqhki...` | Wrapped with PKCS#8 headers automatically |
| Single-line base64 with headers | Header + all base64 on one line + footer | Re-wrapped to 64-char lines |

If the key is invalid or empty, the constructor throws a descriptive error immediately rather than failing silently on the first API call.

```typescript
// All of these work:
new WaffoPancake({ merchantId: "mer_xxx", privateKey: process.env.PRIVATE_KEY! });         // .env with literal \n
new WaffoPancake({ merchantId: "mer_xxx", privateKey: fs.readFileSync("key.pem", "utf8") }); // file read
new WaffoPancake({ merchantId: "mer_xxx", privateKey: rawBase64String });                   // raw base64
```

### Webhook Public Key Resolution

The SDK resolves the webhook verification public key per environment using a multi-level fallback chain:

| Priority | Source | Description |
|----------|--------|-------------|
| 1 | `options.publicKey` | Per-call override (highest priority, skips all resolution) |
| 2 | `config.webhookPublicKey[env]` | Config object per-environment key |
| 3 | `config.webhookPublicKey` (string) | Config shared key (both environments) |
| 4 | `WAFFO_WEBHOOK_TEST_PUBLIC_KEY` / `WAFFO_WEBHOOK_PROD_PUBLIC_KEY` | Environment variable per-environment |
| 5 | `WAFFO_WEBHOOK_PUBLIC_KEY` | Environment variable shared |
| 6 | Built-in hardcoded key | SDK-embedded Waffo public key (default) |

```typescript
// Shared key for both environments
new WaffoPancake({ merchantId: "mer_xxx", privateKey: "...", webhookPublicKey: "MIIBIjAN..." });

// Per-environment keys
new WaffoPancake({
  merchantId: "mer_xxx",
  privateKey: "...",
  webhookPublicKey: {
    test: process.env.WAFFO_TEST_PUB_KEY!,
    prod: process.env.WAFFO_PROD_PUB_KEY!,
  },
});

// Or rely on environment variables (no config needed)
// export WAFFO_WEBHOOK_TEST_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n..."
// export WAFFO_WEBHOOK_PROD_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n..."
new WaffoPancake({ merchantId: "mer_xxx", privateKey: "..." });
// => SDK auto-reads from env vars, falls back to built-in keys
```

### Public Key Formats

All public key inputs (config, env vars, per-call) accept the same flexible formats as private keys:

| Format | Example | Notes |
|--------|---------|-------|
| Standard SPKI PEM | `-----BEGIN PUBLIC KEY-----\n...` | Recommended |
| PKCS#1 PEM | `-----BEGIN RSA PUBLIC KEY-----\n...` | Also accepted |
| Literal `\n` (env vars) | `"-----BEGIN PUBLIC KEY-----\\nMIIB..."` | Common when stored in `.env` or CI secrets |
| Windows line endings | `\r\n` | Converted to `\n` |
| Raw base64 (no headers) | `MIIBIjANBgkqhki...` | Wrapped with SPKI headers automatically |
| Single-line base64 with headers | Header + all base64 on one line + footer | Re-wrapped to 64-char lines |

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
| `client.webhooks` | `verify<T>()` | Webhook signature verification (uses configured `webhookPublicKey` or built-in keys) |

See [API Reference](docs/api-reference.md) for complete parameter tables and return types.

## Checkout Integration

Guide buyers from your site to the Waffo checkout page in three steps:

```
1. Issue Session Token      →  Obtain a buyer identity credential (JWT)
2. Create Checkout Session  →  Create a session and get the checkout URL
3. Open Checkout Page       →  Open the checkout in a new browser tab
```

### Step 1 — Issue a Session Token

Your backend requests a Session Token on behalf of the buyer. The token carries the buyer's identity and is used by the checkout page to load order details and place orders.

```typescript
const { token } = await client.auth.issueSessionToken({
  storeId: "sto_xxx",
  buyerIdentity: "customer@example.com",
});
```

### Step 2 — Create a Checkout Session

Create a checkout session with your API Key. The response includes a checkout URL with the token embedded in the URL fragment.

```typescript
import { CheckoutSessionProductType } from "@waffo/pancake-ts";

const session = await client.checkout.createSession({
  storeId: "sto_xxx",
  productId: "otp_xxx",
  productType: CheckoutSessionProductType.Onetime,
  currency: "USD",
  buyerEmail: "customer@example.com",
  successUrl: "https://example.com/thank-you",
});
// session.checkoutUrl format:
// https://waffo.ai/store/{slug}/checkout/{sessionId}#token={JWT}
```

The token is passed via the URL fragment (after `#`), which is never sent to the server and never appears in the `Referer` header.

### Step 3 — Open Checkout Page (New Tab)

**We recommend opening the checkout page in a new tab** rather than navigating in the current page. Benefits:

- Buyers can return to your site immediately after payment or if they close the checkout tab
- Merchant page state (cart, forms, scroll position) is preserved
- Payment flow is decoupled from the browsing experience, reducing checkout abandonment

```typescript
// Frontend — recommended: open in a new tab
window.open(session.checkoutUrl, "_blank", "noopener,noreferrer");

// Or via an <a> tag
// <a href={checkoutUrl} target="_blank" rel="noopener noreferrer">Proceed to Checkout</a>
```

> **Not recommended:** `window.location.href = session.checkoutUrl` replaces the current page, preventing buyers from returning to your site without browser back navigation.

### Complete Example (Express)

```typescript
import express from "express";
import { WaffoPancake, CheckoutSessionProductType } from "@waffo/pancake-ts";

const client = new WaffoPancake({
  merchantId: process.env.WAFFO_MERCHANT_ID!,
  privateKey: process.env.WAFFO_PRIVATE_KEY!,
});

const app = express();

app.post("/api/checkout", async (req, res) => {
  const { productId, currency, buyerEmail } = req.body;

  // Step 1: Issue session token
  const { token } = await client.auth.issueSessionToken({
    storeId: "sto_xxx",
    buyerIdentity: buyerEmail,
  });

  // Step 2: Create checkout session
  const session = await client.checkout.createSession({
    storeId: "sto_xxx",
    productId,
    productType: CheckoutSessionProductType.Onetime,
    currency,
    buyerEmail,
    successUrl: "https://example.com/thank-you",
  });

  // Return URL to frontend (frontend opens in new tab)
  res.json({ checkoutUrl: session.checkoutUrl });
});
```

```typescript
// Frontend
const res = await fetch("/api/checkout", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ productId: "otp_xxx", currency: "USD", buyerEmail: "customer@example.com" }),
});
const { checkoutUrl } = await res.json();
window.open(checkoutUrl, "_blank", "noopener,noreferrer");
```

## Usage Examples

### Auth — Issue a Buyer Session Token

```typescript
const { token, expiresAt } = await client.auth.issueSessionToken({
  storeId: "sto_xxx",
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
import { TaxCategory, ProductVersionStatus } from "@waffo/pancake-ts";

// Create with multi-currency pricing
const { product } = await client.onetimeProducts.create({
  storeId: "sto_xxx",
  name: "E-Book: TypeScript Handbook",
  description: "Complete TypeScript guide for developers",
  prices: {
    USD: { amount: 2900, taxCategory: TaxCategory.DigitalGoods },
    EUR: { amount: 2700, taxCategory: TaxCategory.DigitalGoods },
    JPY: { amount: 4500, taxCategory: TaxCategory.DigitalGoods },
  },
  media: [{ type: "image", url: "https://example.com/cover.jpg", alt: "Book cover" }],
  metadata: { sku: "ebook-ts-001" },
});

// Update (creates a new immutable version; skips if unchanged)
await client.onetimeProducts.update({
  id: product.id,
  name: "E-Book: TypeScript Handbook v2",
  prices: { USD: { amount: 3900, taxCategory: "digital_goods" } },
});

// Publish test version → production
await client.onetimeProducts.publish({ id: product.id });

// Deactivate
await client.onetimeProducts.updateStatus({ id: product.id, status: ProductVersionStatus.Inactive });
```

### Subscription Products — Create with Billing Period

```typescript
import { BillingPeriod, TaxCategory } from "@waffo/pancake-ts";

const { product } = await client.subscriptionProducts.create({
  storeId: "sto_xxx",
  name: "Pro Plan",
  billingPeriod: BillingPeriod.Monthly,
  prices: { USD: { amount: 999, taxCategory: TaxCategory.SaaS } },
  description: "Unlimited access to all features",
});

// Same update/publish/updateStatus pattern as onetime products
await client.subscriptionProducts.publish({ id: product.id });
```

### Subscription Product Groups — Shared Trial & Plan Switching

```typescript
// Create a group linking related subscription tiers
const { group } = await client.subscriptionProductGroups.create({
  storeId: "sto_xxx",
  name: "Pro Plans",
  rules: { sharedTrial: true },
  productIds: ["sbp_aaa", "sbp_bbb"],
});

// Update members (full replacement, not merge)
await client.subscriptionProductGroups.update({
  id: group.id,
  productIds: ["sbp_aaa", "sbp_bbb", "sbp_ccc"],
});

// Publish / delete
await client.subscriptionProductGroups.publish({ id: group.id });
await client.subscriptionProductGroups.delete({ id: group.id });
```

### Orders — Cancel a Subscription

```typescript
const { orderId, status } = await client.orders.cancelSubscription({
  orderId: "sbo_xxx",
});
// status: "canceled" (was pending) or "canceling" (was active, PSP notified)
```

### Checkout — Create a Session

```typescript
import { CheckoutSessionProductType } from "@waffo/pancake-ts";

// One-time product checkout
const session = await client.checkout.createSession({
  storeId: "sto_xxx",
  productId: "otp_xxx",
  productType: CheckoutSessionProductType.Onetime,
  currency: "USD",
  buyerEmail: "customer@example.com",
  successUrl: "https://example.com/thank-you",
});
// => redirect buyer to session.checkoutUrl

// Subscription with trial and billing detail
const subSession = await client.checkout.createSession({
  storeId: "sto_xxx",
  productId: "sbp_yyy",
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
  variables: { id: "otp_xxx" },
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
  variables: { id: "sto_xxx" },
});
```

See [GraphQL Guide](docs/graphql-guide.md) for introspection, filters, pagination, and more examples.

## Webhook Verification

Two ways to verify webhooks: the **standalone function** `verifyWebhook()` with built-in public keys, or the **client instance method** `client.webhooks.verify()` which uses the configured `webhookPublicKey`.

### Option A — Standalone Function (built-in keys)

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

### Option B — Client Instance Method (multi-level key resolution)

`client.webhooks.verify()` uses the [multi-level fallback chain](#webhook-public-key-resolution) automatically: config keys → env vars → built-in keys.

```typescript
// Per-environment keys via config
const client = new WaffoPancake({
  merchantId: process.env.WAFFO_MERCHANT_ID!,
  privateKey: process.env.WAFFO_PRIVATE_KEY!,
  webhookPublicKey: {
    test: process.env.WAFFO_TEST_PUB_KEY!,
    prod: process.env.WAFFO_PROD_PUB_KEY!,
  },
});
const event = client.webhooks.verify(rawBody, sig, { environment: "prod" });

// Or rely on env vars (WAFFO_WEBHOOK_TEST_PUBLIC_KEY / WAFFO_WEBHOOK_PROD_PUBLIC_KEY)
const client2 = new WaffoPancake({
  merchantId: process.env.WAFFO_MERCHANT_ID!,
  privateKey: process.env.WAFFO_PRIVATE_KEY!,
});
const event2 = client2.webhooks.verify(rawBody, sig); // auto-detect environment

// Per-call override (highest priority, skips all resolution)
const event3 = client.webhooks.verify(rawBody, sig, { publicKey: oneOffKey });
```

See [Webhook Guide](docs/webhook-guide.md) for event types, signature algorithm, public key resolution, and best practices.

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
| `ErrorLayer` | `Gateway`, `User`, `Store`, `Product`, `Order`, `Ticket`, `GraphQL`, `Resource`, `Email` |
| `WebhookEventType` | `OrderCompleted`, `SubscriptionActivated`, `SubscriptionPaymentSucceeded`, `SubscriptionCanceling`, `SubscriptionUncanceled`, `SubscriptionUpdated`, `SubscriptionCanceled`, `SubscriptionPastDue`, `RefundSucceeded`, `RefundFailed` |

### Types

Key types: `WaffoPancakeConfig`, `WebhookPublicKeys`, `VerifyWebhookOptions`, `WebhookEvent<T>`, `Store`, `OnetimeProductDetail`, `SubscriptionProductDetail`, `CheckoutSessionResult`, `GraphQLResponse<T>`, and 30+ more. See [API Reference — Types](docs/api-reference.md#types) for the full list.

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
    ├── graphql.ts
    └── webhooks.ts
docs/
├── api-reference.md       # Complete API reference
├── graphql-guide.md       # GraphQL usage guide
└── webhook-guide.md       # Webhook verification guide
```

## License

MIT

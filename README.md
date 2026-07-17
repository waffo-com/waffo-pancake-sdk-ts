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

> Most merchants create stores and products in the [Dashboard](https://pancake.waffo.ai/dashboard). The SDK is primarily used for **checkout integration** — redirecting customers from your site to the Waffo checkout page.

```typescript
import { WaffoPancake } from "@waffo/pancake-ts";

// Merchant ID and API Key are available in Dashboard > Settings > Developers
const client = new WaffoPancake({
  merchantId: process.env.WAFFO_MERCHANT_ID!, // MER_{base62} format
  privateKey: process.env.WAFFO_PRIVATE_KEY!,
});

// Create a checkout session — one call handles token + session + URL
const result = await client.checkout.authenticated.create({
  productId: "PROD_xxx", // from Dashboard > Products
  currency: "USD",
  buyerIdentity: req.user.email, // your user's identity
});

// Redirect customer to the checkout page (opens in new tab)
res.json({ checkoutUrl: result.checkoutUrl });
// => checkoutUrl includes #token=... (form pre-filled)
```

## Configuration

| Parameter          | Type                         | Required | Description                                                                        |
| ------------------ | ---------------------------- | -------- | ---------------------------------------------------------------------------------- |
| `merchantId`       | `string`                     | Yes      | Merchant ID in `MER_{base62}` format                                               |
| `privateKey`       | `string`                     | Yes      | RSA private key in PEM format (auto-normalized, see [docs](docs/api-reference.md)) |
| `baseUrl`          | `string`                     | No       | API base URL override                                                              |
| `fetch`            | `typeof fetch`               | No       | Custom fetch implementation                                                        |
| `webhookPublicKey` | `string \| { test?, prod? }` | No       | Custom webhook public key(s)                                                       |

The SDK auto-normalizes key formats: standard PEM, PKCS#1, literal `\n` from env vars, raw base64, and Windows line endings are all accepted.

## Checkout Integration

Waffo supports two checkout modes based on whether the merchant knows the customer's identity:

- **Merchants with their own sites** know who the customer is — they have user accounts, login systems, or collect customer info before checkout. The merchant provides the customer's identity upfront, and the checkout form arrives pre-filled.
- **Template stores and shared links** have no prior customer context — the customer arrives directly at the checkout page and fills in their own details.

| Mode              | Method                            | Customer Identity | Form State | Use Case                                 |
| ----------------- | --------------------------------- | ----------------- | ---------- | ---------------------------------------- |
| **Authenticated** | `checkout.authenticated.create()` | Merchant provides | Pre-filled | Merchant sites with user accounts        |
| **Anonymous**     | `checkout.anonymous.create()`     | Not provided      | Empty      | Template stores, one-time purchase links |

> **We recommend authenticated checkout whenever possible.** The most important reason: authenticated checkout binds the order to the `buyerIdentity` you provide, which is a **merchant-controlled stable identifier**. Even if the customer changes the email on the checkout form, the order is still tied to the identity you specified. In anonymous mode, the customer self-reports their email on the form — if they enter a different address, the system treats them as a new user, which means **previous orders become unlinked** and **subscription trial periods can be exploited** (a new email = a new user = a fresh trial).
>
> |                   | Authenticated                                                           | Anonymous                                          |
> | ----------------- | ----------------------------------------------------------------------- | -------------------------------------------------- |
> | **Identity**      | Merchant-provided, stable across orders                                 | Self-reported email, may vary                      |
> | **Form**          | Pre-filled from merchant-provided identity                              | Empty, customer fills manually                     |
> | **Post-purchase** | Full self-service (see [Customer Self-Service](#customer-self-service)) | Create orders only — no post-purchase self-service |
> | **Session**       | 5-minute TTL, auto-refreshes                                            | 1-minute, single-use                               |

Both modes support **dynamic pricing** and **trial control** at checkout time:

- `priceSnapshot` — override the product's stored price with a custom amount (e.g., coupon, volume discount)
- `withTrial` — explicitly enable or disable the trial period for subscriptions (`true` = force trial, `false` = skip trial, omit = use default rules)

### Authenticated Checkout (Recommended)

The merchant provides customer identity — the SDK issues a session token, creates a checkout session, and returns a checkout URL with the token appended as a URL fragment. One call does everything.

`buyerIdentity` is for order attribution and trial tracking only — it is not rendered on the checkout page. To pre-fill the email field on the checkout form, pass `buyerEmail` explicitly.

```typescript
// Basic — customer identity only (checkout page email field stays empty)
const result = await client.checkout.authenticated.create({
  productId: "PROD_xxx",
  currency: "USD",
  buyerIdentity: "userIdInYourSystem",
});

// With dynamic pricing — override stored price (e.g., coupon, volume discount)
const result = await client.checkout.authenticated.create({
  productId: "PROD_xxx",
  currency: "USD",
  buyerIdentity: "userIdInYourSystem",
  buyerEmail: "customer@example.com",
  priceSnapshot: { amount: "19.99", taxCategory: "digital_goods" },
});

// Subscription with trial control + billing detail pre-fill
const result = await client.checkout.authenticated.create({
  productId: "PROD_xxx",
  currency: "USD",
  buyerIdentity: "userIdInYourSystem",
  buyerEmail: "customer@example.com",
  withTrial: true, // force enable trial (false = skip, omit = default rules)
  billingDetail: { country: "US", isBusiness: false },
  orderMerchantExternalId: "ORDER-2026-00891", // optional, see Business-Side Identifiers below
});

// result.checkoutUrl = "https://pancake.waffo.ai/store/{slug}/checkout/{sessionId}#token={JWT}"
window.open(result.checkoutUrl, "_blank", "noopener,noreferrer");
```

The token is passed via the URL fragment (after `#`), which is never sent to the server and never appears in the `Referer` header.

### Anonymous Checkout

No customer identity required — the customer fills in billing details manually on the checkout page.

```typescript
const result = await client.checkout.anonymous.create({
  productId: "PROD_xxx",
  currency: "USD",
});

// Also supports priceSnapshot, withTrial, and orderMerchantExternalId
const result = await client.checkout.anonymous.create({
  productId: "PROD_xxx",
  currency: "USD",
  priceSnapshot: { amount: "4.99", taxCategory: "saas" },
  withTrial: false, // skip trial for this session
  orderMerchantExternalId: "ORDER-2026-00891", // optional, API Key auth only
  language: "pt-BR", // optional, sets the default checkout language (IETF BCP 47)
});

window.open(result.checkoutUrl, "_blank", "noopener,noreferrer");
```

### Opening the Checkout Page

**We recommend opening the checkout page in a new tab** rather than navigating in the current page:

- Customers can return to your site immediately after payment or if they close the checkout tab
- Merchant page state (cart, forms, scroll position) is preserved
- Payment flow is decoupled from the browsing experience, reducing checkout abandonment

```typescript
// Recommended: open in a new tab
window.open(result.checkoutUrl, "_blank", "noopener,noreferrer");

// Or via an <a> tag
// <a href={checkoutUrl} target="_blank" rel="noopener noreferrer">Proceed to Checkout</a>
```

> **Not recommended:** `window.location.href = result.checkoutUrl` replaces the current page, preventing customers from returning to your site without browser back navigation.

See [API Reference — Checkout](docs/api-reference.md#checkout) for full parameter tables and `BillingDetail` field requirements.

## Webhook Verification

After a customer completes payment, Waffo sends webhook events to your server with rich data including order details, amounts, product info, and event-specific fields (payment, subscription, or refund). The SDK provides two ways to verify signatures:

### Standalone Function (built-in keys)

```typescript
import { verifyWebhook, WebhookEventType } from "@waffo/pancake-ts";

// Express (IMPORTANT: use raw body — parsed JSON breaks signature verification)
app.post("/webhooks", express.raw({ type: "application/json" }), (req, res) => {
  try {
    const event = verifyWebhook(req.body.toString("utf-8"), req.headers["x-waffo-signature"] as string);

    // Respond immediately, process asynchronously
    res.status(200).send("OK");

    switch (event.eventType) {
      case WebhookEventType.OrderCompleted:
        // Rich data: order, amount, product, payment fields
        console.log(`Order ${event.data.orderId} completed — ${event.data.total} ${event.data.currency}`);
        console.log(`Product: ${event.data.productName}, Customer: ${event.data.buyerEmail}`);
        if (event.data.orderMetadata) console.log("Metadata:", event.data.orderMetadata);
        break;
      case WebhookEventType.SubscriptionActivated:
        console.log(`Subscription activated for ${event.data.buyerEmail}`);
        console.log(`Period: ${event.data.billingPeriod}, ends ${event.data.currentPeriodEnd}`);
        break;
      case WebhookEventType.RefundSucceeded:
        console.log(`Refund succeeded: ${event.data.refundReason}`);
        // refund.* events carry both business identifiers (see Business-Side Identifiers section)
        await ledger.closeRefundTicket(event.data.refundTicketMerchantExternalId, event.data.orderMerchantExternalId);
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

See [Webhook Guide](docs/webhook-guide.md) for event types, `WebhookEventData` field reference, dual-environment key architecture, key resolution chain, retry mechanism, and best practices.

## Customer Self-Service

Beyond checkout, you can let customers manage their own orders and subscriptions — for example, embedding a "Cancel Subscription" or "Request Refund" button in your site.

Issue a session token, then use `client.customer(token)` to get a session with self-service methods:

```typescript
// Your backend — issue a session token for the customer
const { token } = await client.auth.issueSessionToken({
  storeId: "STO_xxx",
  buyerIdentity: req.user.email,
});

// Create a customer session
const customer = client.customer(token);

// Cancel a subscription
const { orderId, status } = await customer.cancelSubscription({ orderId: "ORD_xxx" });
// status: "canceling" (active) or "canceled" (pending)

// Reactivate a canceled subscription
await customer.reactivateSubscription({ orderId: "ORD_xxx" });

// Cancel a one-time order (while payment is pending)
await customer.cancelOnetimeOrder({ orderId: "ORD_yyy" });

// Submit a refund request
const { ticket } = await customer.createRefundTicket({
  paymentId: "PAY_xxx",
  reason: "Product not as described",
  requestedAmount: { amount: "29.00", currency: "USD" },
  refundTicketMerchantExternalId: "REF-2026-00012", // optional, see Business-Side Identifiers below
});

// Resubmit a rejected refund ticket
await customer.resubmitRefundTicket({
  ticketId: "TKT_xxx",
  paymentId: "PAY_xxx",
  reason: "Updated reason with more detail",
  requestedAmount: { amount: "29.00", currency: "USD" },
});

// Query the customer's own orders via GraphQL
const result = await customer.graphql.query({
  query: `query { orders { id status createdAt } }`,
});
```

The token is scoped to the specified store and customer identity — customers can only access their own data. Token TTL is 5 minutes and auto-refreshes on each API call.

> **Note**: This uses the same `buyerIdentity` as `checkout.authenticated.create()`. Orders placed via authenticated checkout are automatically tied to this identity, so the customer can manage them later with a token issued here.

## Business-Side Identifiers

Attach your own internal references to a checkout or a refund ticket so cross-system reconciliation does not require Waffo IDs. Two flat keys, both optional (max 128 chars):

| Field                            | Attach at                                   | Inherited by                                               |
| -------------------------------- | ------------------------------------------- | ---------------------------------------------------------- |
| `orderMerchantExternalId`        | `checkout.{authenticated,anonymous}.create` | `Order`, `Payment` (incl. subscription renewals), `Refund` |
| `refundTicketMerchantExternalId` | `customer.createRefundTicket`               | `RefundTicket`, `Refund`                                   |

The same field name appears at every layer it surfaces: request body, response entity, webhook payload (`data.orderMerchantExternalId` / `data.refundTicketMerchantExternalId`), and every GraphQL type that carries the value. A `refund.*` webhook event carries **both** keys (order key inherited from the originating order). Query by either key via GraphQL filters — see [GraphQL Guide](docs/graphql-guide.md).

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

// Look up by your business-side identifier (see Business-Side Identifiers above)
const byRef = await client.graphql.query({
  query: `query ($ref: String!) {
    payments(filter: { orderMerchantExternalId: { eq: $ref } }) {
      id orderId status orderMerchantExternalId
    }
  }`,
  variables: { ref: "ORDER-2026-00891" },
});
```

See [GraphQL Guide](docs/graphql-guide.md) for filters, analytics queries, delivery logs, and more.

## Warnings (Migration Notices)

Every successful REST action and GraphQL query may carry a `warnings` array alongside the data. Warnings describe non-fatal advisories the server wants you to act on — typically deprecated parameters, fields scheduled for removal, or new APIs you should switch to. Each `Notice` has `message` (human-readable), `layer` (which service produced it), and `aiHint` (a structured migration instruction aimed at LLM consumers).

```typescript
// REST action — warnings spread onto the result alongside the typed payload
const { store, warnings } = await client.stores.update({
  id: "STO_xxx",
  webhookSettings: { ... },  // deprecated input
});
if (warnings) {
  for (const w of warnings) {
    console.warn(`[${w.layer}] ${w.message}`, w.aiHint);
    // e.g. layer=store, aiHint="Switch to client.webhooks.add / update / remove"
  }
}

// GraphQL — warnings sit on the envelope alongside data and errors
const result = await client.graphql.query<StoresQuery>({
  query: `query { stores { id } }`,
});
result.warnings?.forEach(w => console.warn(w.message, w.aiHint));
```

**LLM/agent consumers**: always check `aiHint` on every warning — it is the canonical migration instruction (npm package, version, method name, endpoint path) the platform team intends for you to follow when the underlying API evolves.

## Programmatic Store & Product Management

> Most merchants manage stores and products in the [Dashboard](https://pancake.waffo.ai/dashboard). The following APIs are for merchants who need programmatic automation.

### Stores

```typescript
// Create a store
const { store } = await client.stores.create({ name: "My Store" });

// Update settings (notification, checkout theme).
// NOTE: webhook configuration moved to client.webhooks (see Webhooks section below).
// NOTE: only merchant-facing `notify*` toggles (notifyNewOrders / notifyNewSubscriptions /
//       notifySubscription* / notifyChargeback / notifyPayout*) are writable here;
//       consumer email toggles (emailOrderConfirmation, emailSubscription*, emailTrial*) are
//       managed by the PANCAKE platform and silently dropped if passed.
const { store: updated } = await client.stores.update({
  id: store.id,
  supportEmail: "help@example.com",
  notificationSettings: {
    notifyNewOrders: true,
    notifyNewSubscriptions: false,
  },
});

// Soft-delete
const { store: deleted } = await client.stores.delete({ id: store.id });
```

### Webhooks

Manage webhook endpoints across HTTP, Feishu, Discord, Telegram, and Slack. Each store can have up to 20 webhooks across all channels.

```typescript
import { WebhookEventType } from "@waffo/pancake-ts";

// Add a standard HTTPS webhook (RSA-signed envelope)
const { webhook } = await client.webhooks.add({
  storeId: store.id,
  channel: "http",
  url: "https://example.com/webhooks/pancake",
  events: [WebhookEventType.OrderCompleted, WebhookEventType.RefundSucceeded],
  testMode: false,
});

// Add a Discord webhook (uses Discord embed format)
await client.webhooks.add({
  storeId: store.id,
  channel: "discord",
  url: "https://discord.com/api/webhooks/123/abc",
  events: [WebhookEventType.OrderCompleted],
  testMode: false,
});

// Add a Telegram webhook (chat_id stored in `secret`)
await client.webhooks.add({
  storeId: store.id,
  channel: "telegram",
  url: "https://api.telegram.org/bot123:ABC/sendMessage",
  events: [WebhookEventType.OrderCompleted],
  testMode: false,
  secret: "8737101383",
});

// Update events
await client.webhooks.update({
  id: webhook.id,
  events: [WebhookEventType.OrderCompleted, WebhookEventType.RefundSucceeded, WebhookEventType.SubscriptionCanceled],
});

// Hard-delete a webhook (delivery history retained for audit)
await client.webhooks.remove({ id: webhook.id });
```

> **Listing**: query the configured webhook list via GraphQL `Store.storeWebhooks` (filtered by environment automatically). The SDK does not expose a `list` method — `client.graphql.query` is the only read path, by design.

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
    console.log(err.status); // 400
    console.log(err.errors); // [{ message: "...", layer: "store" }, ...]
    // errors[0] = deepest layer, errors[n] = outermost layer
  }
}
```

## Resources

| Namespace                          | Methods                                                                                                                  | Description                             |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| `client.checkout.authenticated`    | `create()`                                                                                                               | Authenticated checkout (recommended)    |
| `client.checkout.anonymous`        | `create()`                                                                                                               | Anonymous checkout                      |
| `client.checkout`                  | `createSession()`                                                                                                        | Low-level checkout session              |
| `client.customer(token)`           | `cancelSubscription()` `cancelOnetimeOrder()` `reactivateSubscription()` `createRefundTicket()` `resubmitRefundTicket()` | Customer self-service                   |
| `client.customer(token).graphql`   | `query<T>()`                                                                                                             | Customer-scoped GraphQL queries         |
| `client.webhooks`                  | `verify<T>()` `add()` `update()` `remove()`                                                                              | Webhook config + signature verification |
| `client.graphql`                   | `query<T>()`                                                                                                             | Merchant GraphQL queries                |
| `client.auth`                      | `issueSessionToken()`                                                                                                    | Issue a customer session token (JWT)    |
| `client.stores`                    | `create()` `update()` `delete()`                                                                                         | Store management                        |
| `client.storeMerchants`            | `add()` `remove()` `updateRole()`                                                                                        | Store members (coming soon)             |
| `client.onetimeProducts`           | `create()` `update()` `publish()` `updateStatus()`                                                                       | One-time products                       |
| `client.subscriptionProducts`      | `create()` `update()` `publish()` `updateStatus()`                                                                       | Subscription products                   |
| `client.subscriptionProductGroups` | `create()` `update()` `delete()` `publish()`                                                                             | Product groups                          |
| `client.orders`                    | `cancelSubscription()`                                                                                                   | Order management                        |

## Documentation

| Document                               | Content                                                                                 |
| -------------------------------------- | --------------------------------------------------------------------------------------- |
| [API Reference](docs/api-reference.md) | Complete method reference — parameters, return types, `BillingDetail` fields            |
| [GraphQL Guide](docs/graphql-guide.md) | Queries, filters, analytics, introspection, delivery logs                               |
| [Webhook Guide](docs/webhook-guide.md) | Signature verification, event types, event data fields, key resolution, retry mechanism |
| [Changelog](CHANGELOG.md)              | Version history and migration guides                                                    |

## Exports

### Classes & Functions

| Export              | Description                                 |
| ------------------- | ------------------------------------------- |
| `WaffoPancake`      | SDK client with auto-signed requests        |
| `WaffoPancakeError` | API error with status and call-stack errors |
| `verifyWebhook`     | Standalone webhook signature verification   |

### Enums

| Export                       | Values                                                                                                                                                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Environment`                | `Test`, `Prod`                                                                                                                                                                                                                        |
| `TaxCategory`                | `DigitalGoods`, `SaaS`, `Software`, `Ebook`, `OnlineCourse`, `Consulting`, `ProfessionalService`                                                                                                                                      |
| `BillingPeriod`              | `Weekly`, `Monthly`, `Quarterly`, `Yearly`                                                                                                                                                                                            |
| `ProductVersionStatus`       | `Active`, `Inactive`                                                                                                                                                                                                                  |
| `EntityStatus`               | `Active`, `Inactive`, `Suspended`                                                                                                                                                                                                     |
| `StoreRole`                  | `Owner`, `Admin`, `Member`                                                                                                                                                                                                            |
| `OnetimeOrderStatus`         | `Pending`, `Completed`, `Canceled`                                                                                                                                                                                                    |
| `SubscriptionOrderStatus`    | `Pending`, `Active`, `Canceling`, `PastDue`, `Closed`, `Canceled`, `Expired`                                                                                                                                                          |
| `PaymentStatus`              | `Pending`, `Succeeded`, `Failed`, `Canceled`                                                                                                                                                                                          |
| `RefundTicketStatus`         | `Pending`, `Approved`, `Rejected`, `Processing`, `Succeeded`, `Failed`                                                                                                                                                                |
| `RefundStatus`               | `Succeeded`, `Failed`                                                                                                                                                                                                                 |
| `MediaType`                  | `Image`, `Video`                                                                                                                                                                                                                      |
| `CheckoutSessionProductType` | `Onetime`, `Subscription`                                                                                                                                                                                                             |
| `ErrorLayer`                 | `Gateway`, `User`, `Store`, `Product`, `Order`, `Ticket`, `GraphQL`, `Resource`, `Email`                                                                                                                                              |
| `WebhookEventType`           | `OrderCompleted`, `SubscriptionActivated`, `SubscriptionPaymentSucceeded`, `SubscriptionCanceling`, `SubscriptionUncanceled`, `SubscriptionUpdated`, `SubscriptionCanceled`, `SubscriptionPastDue`, `RefundSucceeded`, `RefundFailed` |

### Types

Key types: `WaffoPancakeConfig`, `AuthenticatedCheckoutParams`, `AuthenticatedCheckoutResult`, `AnonymousCheckoutParams`, `CheckoutSessionResult`, `CashierLanguage`, `Store`, `OnetimeProductDetail`, `SubscriptionProductDetail`, `WebhookEvent<T>`, `WebhookEventData`, `GraphQLResponse<T>`, and 30+ more. `WebhookEventData` includes rich fields organized by section: order info, amounts, product, payment, subscription, and refund (conditional by event type). See [API Reference](docs/api-reference.md#types) for the full list.

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
├── customer-http-client.ts   # HTTP client (Bearer token, customer self-service)
├── signing.ts             # RSA-SHA256 request signing
├── errors.ts              # WaffoPancakeError
├── webhooks.ts            # Webhook verification (embedded keys)
├── validation.ts          # Client-side input validation
├── types.ts               # Type definitions & enums
├── __tests__/             # Test suite
└── resources/             # API resource classes
    ├── auth.ts
    ├── stores.ts
    ├── store-merchants.ts
    ├── onetime-products.ts
    ├── subscription-products.ts
    ├── subscription-product-groups.ts
    ├── customer.ts
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

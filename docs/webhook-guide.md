# Webhook Guide

Waffo Pancake sends webhook events to your configured endpoint when payment, subscription, and refund state changes occur. The SDK provides `verifyWebhook()` to validate signatures and parse events.

## Overview

- **Algorithm**: RSA-SHA256 with environment-specific key pairs
- **Dual environment**: Test and production use separate key pairs; the SDK resolves the correct key automatically
- **Multi-level key loading**: Config parameter → environment variable → built-in hardcoded key
- **Replay protection**: 5-minute timestamp tolerance by default
- **Environment auto-detection**: Tries the production key first, falls back to test

## Signature Verification

```
1. Parse X-Waffo-Signature header → t (timestamp) + v1 (Base64 signature)
2. Build signature input: `${t}.${rawBody}`
3. Verify v1 with RSA-SHA256 using the Waffo public key
4. Check timestamp (default 5-minute tolerance to prevent replay attacks)
```

## Usage

### Express

```typescript
import { verifyWebhook, WebhookEventType } from "@waffo/pancake-ts";

// IMPORTANT: Use raw body — parsed JSON will break signature verification
app.post("/webhooks", express.raw({ type: "application/json" }), (req, res) => {
  try {
    const event = verifyWebhook(req.body.toString("utf-8"), req.headers["x-waffo-signature"] as string);

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
```

### Next.js App Router

```typescript
import { verifyWebhook } from "@waffo/pancake-ts";

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
```

### Options

```typescript
// Specify environment explicitly (skip auto-detection)
const event = verifyWebhook(body, sig, { environment: "prod" });

// Disable replay protection (useful for testing)
const event = verifyWebhook(body, sig, { toleranceMs: 0 });

// Custom tolerance window (10 minutes)
const event = verifyWebhook(body, sig, { toleranceMs: 600000 });
```

## Parameters

| Parameter         | Type                          | Description                                                               |
| ----------------- | ----------------------------- | ------------------------------------------------------------------------- |
| `payload`         | `string`                      | Raw request body string (must be unparsed)                                |
| `signatureHeader` | `string \| undefined \| null` | `X-Waffo-Signature` header value (format: `t=<timestamp>,v1=<signature>`) |
| `options`         | `VerifyWebhookOptions`        | Optional configuration                                                    |

### `VerifyWebhookOptions`

| Field         | Type                         | Default          | Description                                                                                                     |
| ------------- | ---------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------- |
| `environment` | `"test" \| "prod"`           | auto-detect      | Which environment's key to resolve. When omitted, tries prod first, then test. Ignored when `publicKey` is set. |
| `toleranceMs` | `number`                     | `300000` (5 min) | Timestamp tolerance in ms. Set to `0` to skip timestamp check                                                   |
| `publicKey`   | `string`                     | —                | Per-call public key override (highest priority, skips all resolution)                                           |
| `publicKeys`  | `string \| { test?, prod? }` | —                | Config-level key(s) for the resolution chain. Typically injected automatically by `client.webhooks.verify()`    |

## Dual-Environment Public Key Architecture

Waffo Pancake uses **separate RSA key pairs** for test and production environments. Webhook events from test mode are signed with the test private key; production events are signed with the production private key. The SDK must use the corresponding public key to verify each event.

```
                           ┌──────────────────┐
                           │   Waffo Server    │
                           ├──────────────────┤
                           │ Test Private Key  │──sign──→ test webhook events
                           │ Prod Private Key  │──sign──→ prod webhook events
                           └──────────────────┘
                                    │
                                    ▼
                           ┌──────────────────┐
                           │   Your Server     │
                           │   (SDK verify)    │
                           ├──────────────────┤
                           │ Test Public Key   │──verify──→ test webhook events
                           │ Prod Public Key   │──verify──→ prod webhook events
                           └──────────────────┘
```

When `environment` is specified, the SDK uses only the key for that environment. When omitted, the SDK **auto-detects** by trying the production key first, then falling back to the test key.

### Why Dual Keys?

- **Isolation**: Test and production environments are cryptographically separated. A test key cannot verify a production event and vice versa.
- **Key rotation**: Keys can be rotated independently per environment without affecting the other.
- **Security boundary**: Even if a test private key is compromised, production webhook integrity is unaffected.

## Multi-Level Public Key Resolution

For each environment, the SDK resolves the public key by walking a **6-level fallback chain**. The first non-empty value wins:

```
┌─────────────────────────────────────────────────────────┐
│                     Resolution Chain                     │
│                  (per environment: test/prod)            │
├─────┬───────────────────────────────────────────────────┤
│  1  │  options.publicKey (per-call override)            │ ← highest priority
├─────┼───────────────────────────────────────────────────┤
│  2  │  config.webhookPublicKey[env]                     │
│     │  (WaffoPancakeConfig per-env object key)          │
├─────┼───────────────────────────────────────────────────┤
│  3  │  config.webhookPublicKey (string)                 │
│     │  (WaffoPancakeConfig shared key)                  │
├─────┼───────────────────────────────────────────────────┤
│  4  │  WAFFO_WEBHOOK_TEST_PUBLIC_KEY (test)             │
│     │  WAFFO_WEBHOOK_PROD_PUBLIC_KEY (prod)             │
│     │  (environment variable, per-env)                  │
├─────┼───────────────────────────────────────────────────┤
│  5  │  WAFFO_WEBHOOK_PUBLIC_KEY                         │
│     │  (environment variable, shared)                   │
├─────┼───────────────────────────────────────────────────┤
│  6  │  Built-in hardcoded key                           │ ← default fallback
│     │  (SDK-embedded Waffo public key)                  │
└─────┴───────────────────────────────────────────────────┘
```

### Level 1 — Per-call Override (`options.publicKey`)

The highest priority. When set, the SDK uses this key directly and **skips the entire resolution chain** — config keys, env vars, and built-in keys are all ignored. The `environment` option is also ignored.

```typescript
// Use a specific key for this one call
const event = verifyWebhook(body, sig, {
  publicKey: "-----BEGIN PUBLIC KEY-----\nMIIBIjAN...",
});

// Or via client instance
const event = client.webhooks.verify(body, sig, {
  publicKey: rotatedKey,
});
```

**Use cases**: Key rotation testing, debugging with a known key, temporary override during migration.

### Level 2 — Config Per-Environment Keys (`webhookPublicKey: { test, prod }`)

Pass an object with `test` and/or `prod` fields to `WaffoPancakeConfig.webhookPublicKey`. The SDK picks the key matching the resolved environment.

```typescript
const client = new WaffoPancake({
  merchantId: "MER_xxx",
  privateKey: "...",
  webhookPublicKey: {
    test: process.env.MY_TEST_PUB_KEY!,
    prod: process.env.MY_PROD_PUB_KEY!,
  },
});

// Uses test key
client.webhooks.verify(body, sig, { environment: "test" });

// Uses prod key
client.webhooks.verify(body, sig, { environment: "prod" });

// Auto-detect: tries prod first, then test
client.webhooks.verify(body, sig);
```

You can provide only one environment — the other falls through to env vars or built-in keys:

```typescript
webhookPublicKey: {
  prod: customProdKey,
  // test: not set → falls through to env var → built-in test key
}
```

### Level 3 — Config Shared Key (`webhookPublicKey: string`)

A single string key applies to **both** environments. Useful when you use the same key pair for test and production (e.g., self-hosted deployments).

```typescript
const client = new WaffoPancake({
  merchantId: "MER_xxx",
  privateKey: "...",
  webhookPublicKey: process.env.WAFFO_PUB_KEY!, // used for both test and prod
});
```

### Level 4 — Environment Variables (Per-Environment) ⭐ Recommended Migration Path

When no config key is found, the SDK reads from process environment variables:

| Environment | Variable Name                   |
| ----------- | ------------------------------- |
| test        | `WAFFO_WEBHOOK_TEST_PUBLIC_KEY` |
| prod        | `WAFFO_WEBHOOK_PROD_PUBLIC_KEY` |

> **When built-in hardcoded keys become invalid (e.g., Waffo rotates platform keys, or you migrate to a self-hosted deployment), the minimum-effort fix is to set environment variables. No code changes, no redeployment of application code — just update the env vars in your hosting platform (Vercel, AWS, Docker, etc.) and the SDK picks them up automatically on the next request.**

```bash
# .env, Vercel dashboard, AWS Parameter Store, Docker env, etc.
WAFFO_WEBHOOK_TEST_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\nMIIBIjAN..."
WAFFO_WEBHOOK_PROD_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\nMIIBIjAN..."
```

```typescript
// No code changes needed — same code as before
const event = verifyWebhook(body, sig);
// SDK auto-reads from env vars when built-in keys fail to match

// Or via client — also zero code change
const client = new WaffoPancake({
  merchantId: "MER_xxx",
  privateKey: "...",
  // No webhookPublicKey needed — env vars take effect automatically
});
client.webhooks.verify(body, sig, { environment: "prod" });
// → reads WAFFO_WEBHOOK_PROD_PUBLIC_KEY
```

**Migration checklist when hardcoded keys expire:**

1. Obtain the new public keys from the Waffo dashboard or your platform admin
2. Set `WAFFO_WEBHOOK_PROD_PUBLIC_KEY` (and `WAFFO_WEBHOOK_TEST_PUBLIC_KEY` if needed) in your environment
3. Done — no code changes, no package upgrade, no redeployment of application code

### Level 5 — Environment Variable (Shared)

A single env var for both environments:

| Variable Name              | Used for           |
| -------------------------- | ------------------ |
| `WAFFO_WEBHOOK_PUBLIC_KEY` | Both test and prod |

```bash
WAFFO_WEBHOOK_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\nMIIBIjAN..."
```

### Level 6 — Built-in Hardcoded Keys (Default)

If no custom key is found at any level, the SDK uses its embedded Waffo public keys. These are the official Waffo Pancake platform keys and are the default for most users.

**No configuration required** — this is the zero-config default.

```typescript
// Simplest usage — built-in keys handle everything
const event = verifyWebhook(body, sig);
```

### Resolution Examples

| Scenario            | Config                                | Env Var                               | Result (prod)            |
| ------------------- | ------------------------------------- | ------------------------------------- | ------------------------ |
| Default (no config) | —                                     | —                                     | Built-in prod key        |
| Shared config key   | `webhookPublicKey: "KEY_A"`           | —                                     | `KEY_A`                  |
| Per-env config      | `webhookPublicKey: { prod: "KEY_B" }` | —                                     | `KEY_B`                  |
| Env var only        | —                                     | `WAFFO_WEBHOOK_PROD_PUBLIC_KEY=KEY_C` | `KEY_C`                  |
| Config + env var    | `webhookPublicKey: { prod: "KEY_D" }` | `WAFFO_WEBHOOK_PROD_PUBLIC_KEY=KEY_E` | `KEY_D` (config wins)    |
| Per-call override   | `webhookPublicKey: { prod: "KEY_F" }` | —                                     | `options.publicKey` wins |

## Public Key Formats

All public key inputs at every level (config, env vars, per-call) are automatically **normalized** by the SDK. The following formats are accepted:

| Format                  | Example                                                     | Notes                                   |
| ----------------------- | ----------------------------------------------------------- | --------------------------------------- |
| Standard SPKI PEM       | `-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----` | Recommended                             |
| PKCS#1 PEM              | `-----BEGIN RSA PUBLIC KEY-----\n...`                       | Also accepted                           |
| Literal `\n` (env vars) | `"-----BEGIN PUBLIC KEY-----\\nMIIB..."`                    | Common in `.env` files and CI secrets   |
| Windows line endings    | `\r\n`                                                      | Converted to `\n`                       |
| Raw base64 (no headers) | `MIIBIjANBgkqhki...`                                        | Wrapped with SPKI headers automatically |
| Single-line base64      | Header + all base64 on one line + footer                    | Re-wrapped to 64-char lines             |

Normalization is applied **on every call** — there is no eager validation at construction time (unlike `privateKey`). Invalid keys produce a descriptive error at verification time.

## Two Verification APIs

### Standalone Function — `verifyWebhook()`

Best for simple setups where you don't need the SDK client. Uses env vars and built-in keys by default.

```typescript
import { verifyWebhook } from "@waffo/pancake-ts";

const event = verifyWebhook(body, sig); // built-in keys
const event = verifyWebhook(body, sig, { environment: "prod" }); // explicit env
const event = verifyWebhook(body, sig, { publicKey: customKey }); // per-call key
```

### Client Instance Method — `client.webhooks.verify()`

Best when you already have a `WaffoPancake` client. Automatically injects config-level keys into the resolution chain.

```typescript
import { WaffoPancake } from "@waffo/pancake-ts";

const client = new WaffoPancake({
  merchantId: "...",
  privateKey: "...",
  webhookPublicKey: {
    test: testKey,
    prod: prodKey,
  },
});

const event = client.webhooks.verify(body, sig); // auto-detect with config keys
const event = client.webhooks.verify(body, sig, { environment: "test" }); // explicit env
const event = client.webhooks.verify(body, sig, { publicKey: oneOff }); // per-call override
```

Both APIs share the same underlying verification logic and resolution chain.

## Event Payload

### `WebhookEvent<T>`

| Field       | Type     | Description                                                         |
| ----------- | -------- | ------------------------------------------------------------------- |
| `id`        | `string` | Delivery record unique ID (UUID) — use for idempotent deduplication |
| `timestamp` | `string` | Event timestamp (ISO 8601 UTC)                                      |
| `eventType` | `string` | Event type (e.g. `"order.completed"`)                               |
| `eventId`   | `string` | Business event ID (e.g. payment ID)                                 |
| `storeId`   | `string` | Store ID the event belongs to                                       |
| `storeName` | `string` | Store name                                                          |
| `mode`      | `string` | Environment (`"test"` or `"prod"`)                                  |
| `data`      | `T`      | Event data (defaults to `WebhookEventData`)                         |

### `WebhookEventData`

All events include the **Order**, **Amount**, and **Product** sections. Additional sections are conditionally present based on event type.

**Order fields** (always present):

| Field                            | Type     | Required | Description                                                                                                                                                                            |
| -------------------------------- | -------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `orderId`                        | `string` | Yes      | Associated order ID                                                                                                                                                                    |
| `orderStatus`                    | `string` | No       | Order status (e.g., `"completed"`, `"active"`, `"canceling"`)                                                                                                                          |
| `buyerEmail`                     | `string` | Yes      | Customer email address                                                                                                                                                                 |
| `merchantProvidedBuyerIdentity`  | `string` | No       | Merchant-provided customer identity from checkout session                                                                                                                              |
| `orderMerchantExternalId`        | `string` | No       | Order business-side identifier set at checkout creation (max 128 chars). Present on order / payment / subscription events and on refund events (inherited from the originating order). |
| `refundTicketMerchantExternalId` | `string` | No       | Refund-ticket business-side identifier set at refund-ticket creation. **Only present on `refund.*` events**; coexists with `orderMerchantExternalId` on the same refund payload.       |
| `currency`                       | `string` | Yes      | Currency code (ISO 4217)                                                                                                                                                               |
| `billingDetail`                  | `object` | No       | Billing/shipping address (structured object)                                                                                                                                           |
| `orderMetadata`                  | `object` | No       | Order-level metadata from checkout session (flat key-value pairs)                                                                                                                      |

**Amount fields** (always present):

| Field       | Type     | Required | Description                                                                       |
| ----------- | -------- | -------- | --------------------------------------------------------------------------------- |
| `amount`    | `string` | Yes      | Amount in display format (e.g., `"29.00"` for $29.00 USD, `"4500"` for ¥4500 JPY) |
| `taxAmount` | `string` | Yes      | Tax amount in display format (e.g., `"2.90"`)                                     |
| `taxRate`   | `number` | No       | Tax rate as decimal (e.g., `0.1` for 10%)                                         |
| `taxName`   | `string` | No       | Tax name (e.g., `"Consumption Tax"`)                                              |
| `subtotal`  | `string` | No       | Subtotal as display string (before tax)                                           |
| `total`     | `string` | No       | Total as display string (after tax)                                               |

**Product fields** (always present):

| Field                | Type     | Required | Description                                                   |
| -------------------- | -------- | -------- | ------------------------------------------------------------- |
| `productName`        | `string` | Yes      | Product name                                                  |
| `productDescription` | `string` | No       | Product description                                           |
| `productMetadata`    | `object` | No       | Product-level metadata set when creating/updating the product |

**Payment fields** (present for `order.completed`, `subscription.payment_succeeded`):

| Field                  | Type     | Description                                        |
| ---------------------- | -------- | -------------------------------------------------- |
| `paymentId`            | `string` | Payment ID                                         |
| `paymentStatus`        | `string` | Payment status (e.g., `"succeeded"`, `"failed"`)   |
| `paymentMethod`        | `string` | Payment method type (e.g., `"card"`)               |
| `paymentLast4`         | `string` | Last 4 digits of payment instrument                |
| `paymentFailureReason` | `string` | Payment failure reason (present when failed)       |
| `paymentDate`          | `string` | Payment date (ISO 8601 date, e.g., `"2026-04-18"`) |

**Subscription fields** (present for `subscription.*` events):

| Field                | Type     | Description                                                           |
| -------------------- | -------- | --------------------------------------------------------------------- |
| `billingPeriod`      | `string` | Billing period: `"weekly"`, `"monthly"`, `"quarterly"`, `"yearly"`    |
| `currentPeriodStart` | `string` | Current billing period start date (ISO 8601)                          |
| `currentPeriodEnd`   | `string` | Current billing period end date (ISO 8601)                            |
| `canceledAt`         | `string` | Subscription cancellation timestamp (ISO 8601, present when canceled) |

**Refund fields** (present for `refund.succeeded`, `refund.failed`):

| Field             | Type     | Description                               |
| ----------------- | -------- | ----------------------------------------- |
| `refundStatus`    | `string` | Refund status (`"succeeded"`, `"failed"`) |
| `refundReason`    | `string` | Refund reason                             |
| `refundCreatedAt` | `string` | Refund creation timestamp (ISO 8601)      |

## Event Types

| Enum Value                     | String                           | Trigger                                                            |
| ------------------------------ | -------------------------------- | ------------------------------------------------------------------ |
| `OrderCompleted`               | `order.completed`                | One-time order first payment succeeded                             |
| `SubscriptionActivated`        | `subscription.activated`         | New subscription activated                                         |
| `SubscriptionPaymentSucceeded` | `subscription.payment_succeeded` | Subscription renewal payment succeeded                             |
| `SubscriptionCanceling`        | `subscription.canceling`         | Customer initiated cancellation (expires at end of billing period) |
| `SubscriptionUncanceled`       | `subscription.uncanceled`        | Customer withdrew cancellation request                             |
| `SubscriptionUpdated`          | `subscription.updated`           | Subscription product changed (upgrade/downgrade)                   |
| `SubscriptionCanceled`         | `subscription.canceled`          | Subscription fully terminated                                      |
| `SubscriptionPastDue`          | `subscription.past_due`          | Renewal payment failed (past due)                                  |
| `RefundSucceeded`              | `refund.succeeded`               | Refund completed successfully                                      |
| `RefundFailed`                 | `refund.failed`                  | Refund failed                                                      |

## Key Rotation & Migration

### Scenario: Built-in hardcoded keys are no longer valid

This can happen when Waffo rotates its platform key pair, or when you switch to a self-hosted deployment with custom keys.

**Minimum-effort fix — set environment variables (zero code change):**

```bash
# Just add these to your hosting environment:
WAFFO_WEBHOOK_PROD_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\nMIIBIjAN..."
WAFFO_WEBHOOK_TEST_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\nMIIBIjAN..."
```

The SDK automatically checks env vars before falling back to hardcoded keys. Your existing `verifyWebhook(body, sig)` or `client.webhooks.verify(body, sig)` calls continue to work without any code change.

### Scenario: Gradual key rotation

When rotating keys, the old key remains valid for a transition period:

```typescript
// During transition: both old and new keys work
// The SDK auto-detect tries multiple keys, so both will be accepted

// After transition: update the env var to the new key
// Old signed events will fail verification — this is expected
```

### Choosing the right level

| Situation                   | Recommended Level  | Why                                     |
| --------------------------- | ------------------ | --------------------------------------- |
| Standard Waffo Pancake user | Level 6 (default)  | Built-in keys just work, zero config    |
| Built-in keys expired       | Level 4 (env var)  | No code changes, set env var and done   |
| Self-hosted deployment      | Level 2/3 (config) | Custom keys are part of your app config |
| Testing a new key           | Level 1 (per-call) | One-off override, no permanent change   |
| CI/CD with different keys   | Level 4 (env var)  | Each environment sets its own env var   |

## Retry Mechanism

When delivery fails (non-2xx response or timeout), the system automatically retries using **exponential backoff** (managed by the underlying message queue). Default: 3 retries.

| Delivery Status | Description                               |
| --------------- | ----------------------------------------- |
| `pending`       | Created, waiting for delivery or retrying |
| `success`       | Delivery successful (server returned 2xx) |
| `failed`        | All retries exhausted, final failure      |

You can view each delivery's status, HTTP status code, and response content in the dashboard's Webhook logs.

> **Note**: The same business event (same `eventType` + `eventId`) creates only one delivery record and won't be duplicated. However, the same delivery may arrive multiple times due to retries — always deduplicate using `event.id`.

## Best Practices

1. **Respond quickly** — Return 200 immediately and process the event asynchronously. Waffo retries on timeout.
2. **Deduplicate** — Use `event.id` (delivery record UUID) as an idempotency key to handle redeliveries.
3. **Verify all events** — Always call `verifyWebhook()` before processing. Never trust unverified payloads.
4. **Use raw body** — The signature is computed over the raw request body. Parsing JSON first will break verification.
5. **Specify environment when known** — If your endpoint only receives test or prod events, pass `{ environment: "test" }` or `{ environment: "prod" }` to skip unnecessary key attempts and get clearer error messages.
6. **Use env vars for secrets** — Prefer `WAFFO_WEBHOOK_PROD_PUBLIC_KEY` env vars over hardcoding keys in source code. The SDK reads them automatically.
7. **Key rotation** — During rotation, temporarily use `options.publicKey` per-call to test the new key, then update config/env vars once confirmed.

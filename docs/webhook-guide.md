# Webhook Guide

Waffo Pancake sends webhook events to your configured endpoint when payment, subscription, and refund state changes occur. The SDK provides `verifyWebhook()` to validate signatures and parse events.

## Overview

- **Algorithm**: RSA-SHA256 with environment-specific key pairs
- **Public keys**: Embedded in the SDK (test and production) — no key management needed
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
import { verifyWebhook, WebhookEventType } from "@waffo-pancake/sdk";

// IMPORTANT: Use raw body — parsed JSON will break signature verification
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
```

### Next.js App Router

```typescript
import { verifyWebhook } from "@waffo-pancake/sdk";

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

| Parameter | Type | Description |
|-----------|------|-------------|
| `payload` | `string` | Raw request body string (must be unparsed) |
| `signatureHeader` | `string \| undefined \| null` | `X-Waffo-Signature` header value (format: `t=<timestamp>,v1=<signature>`) |
| `options` | `VerifyWebhookOptions` | Optional configuration |

### `VerifyWebhookOptions`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `environment` | `"test" \| "prod"` | auto-detect | Which public key to use. When omitted, tries prod first, then test |
| `toleranceMs` | `number` | `300000` (5 min) | Timestamp tolerance in ms. Set to `0` to skip timestamp check |

## Event Payload

### `WebhookEvent<T>`

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Delivery record unique ID (UUID) — use for idempotent deduplication |
| `timestamp` | `string` | Event timestamp (ISO 8601 UTC) |
| `eventType` | `string` | Event type (e.g. `"order.completed"`) |
| `eventId` | `string` | Business event ID (e.g. payment ID) |
| `storeId` | `string` | Store ID the event belongs to |
| `mode` | `string` | Environment (`"test"` or `"prod"`) |
| `data` | `T` | Event data (defaults to `WebhookEventData`) |

### `WebhookEventData`

| Field | Type | Description |
|-------|------|-------------|
| `orderId` | `string` | Associated order ID |
| `buyerEmail` | `string` | Buyer email address |
| `currency` | `string` | Currency code (ISO 4217) |
| `amount` | `number` | Amount in smallest currency unit |
| `taxAmount` | `number` | Tax amount in smallest currency unit |
| `productName` | `string` | Product name |

## Event Types

| Enum Value | String | Trigger |
|------------|--------|---------|
| `OrderCompleted` | `order.completed` | One-time order first payment succeeded |
| `SubscriptionActivated` | `subscription.activated` | New subscription activated |
| `SubscriptionPaymentSucceeded` | `subscription.payment_succeeded` | Subscription renewal payment succeeded |
| `SubscriptionCanceling` | `subscription.canceling` | Buyer initiated cancellation (expires at end of billing period) |
| `SubscriptionUncanceled` | `subscription.uncanceled` | Buyer withdrew cancellation request |
| `SubscriptionUpdated` | `subscription.updated` | Subscription product changed (upgrade/downgrade) |
| `SubscriptionCanceled` | `subscription.canceled` | Subscription fully terminated |
| `SubscriptionPastDue` | `subscription.past_due` | Renewal payment failed (past due) |
| `RefundSucceeded` | `refund.succeeded` | Refund completed successfully |
| `RefundFailed` | `refund.failed` | Refund failed |

## Best Practices

1. **Respond quickly** — Return 200 immediately and process the event asynchronously. Waffo retries on timeout.
2. **Deduplicate** — Use `event.id` (delivery record UUID) as an idempotency key to handle redeliveries.
3. **Verify all events** — Always call `verifyWebhook()` before processing. Never trust unverified payloads.
4. **Use raw body** — The signature is computed over the raw request body. Parsing JSON first will break verification.

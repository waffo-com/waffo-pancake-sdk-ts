import { verifyWebhook } from "../webhooks.js";

import type { VerifyWebhookOptions, WebhookEvent } from "../types.js";

/** Webhook signature verification resource. */
export class WebhooksResource {
  /** @param publicKey - Optional custom RSA public key (PEM or raw base64) */
  constructor(private readonly publicKey: string | undefined) {}

  /**
   * Verify and parse an incoming webhook event.
   *
   * When the client was created with a `webhookPublicKey`, that key is used
   * automatically. You can still override per-call via `options.publicKey`.
   *
   * @param payload - Raw request body string (must be unparsed)
   * @param signatureHeader - Value of the `X-Waffo-Signature` header
   * @param options - Verification options (optional)
   * @returns Parsed webhook event
   * @throws Error if signature is invalid, header is malformed, or timestamp is stale
   *
   * @example
   * const event = client.webhooks.verify(rawBody, signatureHeader);
   *
   * @example
   * // Override tolerance per call
   * const event = client.webhooks.verify(rawBody, sig, { toleranceMs: 0 });
   */
  verify<T = Record<string, unknown>>(
    payload: string,
    signatureHeader: string | undefined | null,
    options?: VerifyWebhookOptions,
  ): WebhookEvent<T> {
    const mergedOptions: VerifyWebhookOptions = {
      ...options,
      publicKey: options?.publicKey ?? this.publicKey,
    };
    return verifyWebhook<T>(payload, signatureHeader, mergedOptions);
  }
}

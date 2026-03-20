import { verifyWebhook } from "../webhooks.js";

import type { VerifyWebhookOptions, WebhookEvent, WebhookPublicKeys } from "../types.js";

/**
 * Webhook signature verification resource.
 *
 * Unlike other resources, this does not use HttpClient — webhook verification
 * is a local cryptographic operation that does not require API calls.
 */
export class WebhooksResource {
  /** @param publicKeys - Optional config-level public key(s) from WaffoPancakeConfig */
  constructor(private readonly publicKeys: WebhookPublicKeys | undefined) {}

  /**
   * Verify and parse an incoming webhook event.
   *
   * Key resolution order:
   * 1. `options.publicKey` — per-call override (highest priority)
   * 2. `config.webhookPublicKey[env]` or `config.webhookPublicKey` (string)
   * 3. `WAFFO_WEBHOOK_{TEST|PROD}_PUBLIC_KEY` environment variable
   * 4. `WAFFO_WEBHOOK_PUBLIC_KEY` environment variable
   * 5. Built-in hardcoded key
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
   * // Specify environment
   * const event = client.webhooks.verify(rawBody, sig, { environment: "test" });
   *
   * @example
   * // Per-call key override
   * const event = client.webhooks.verify(rawBody, sig, { publicKey: oneOffKey });
   */
  verify<T = Record<string, unknown>>(
    payload: string,
    signatureHeader: string | undefined | null,
    options?: VerifyWebhookOptions,
  ): WebhookEvent<T> {
    const mergedOptions: VerifyWebhookOptions = {
      ...options,
      publicKeys: options?.publicKeys ?? this.publicKeys,
    };
    return verifyWebhook<T>(payload, signatureHeader, mergedOptions);
  }
}

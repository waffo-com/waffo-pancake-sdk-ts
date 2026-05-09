import { validateRequired, validateShortId } from "../validation.js";
import { verifyWebhook } from "../webhooks.js";

import type { HttpClient } from "../http-client.js";
import type {
  AddWebhookParams,
  RemoveWebhookParams,
  StoreWebhook,
  UpdateWebhookParams,
  VerifyWebhookOptions,
  WebhookEvent,
  WebhookPublicKeys,
} from "../types.js";

/**
 * Webhook resource — manages webhook configurations (HTTP / Feishu / Discord
 * / Telegram / Slack) and verifies inbound webhook signatures.
 *
 * **Mutations only**: `add`, `update`, `remove` all hit POST endpoints.
 * To list a store's webhooks, use GraphQL `Store.storeWebhooks` via
 * `client.graphql.query`.
 *
 * Verification (`verify`) is a local cryptographic operation that does not
 * require API calls.
 */
export class WebhooksResource {
  /**
   * @param http - HTTP client (used for add/update/remove)
   * @param publicKeys - Optional config-level public key(s) from WaffoPancakeConfig
   */
  constructor(
    private readonly http: HttpClient,
    private readonly publicKeys: WebhookPublicKeys | undefined,
  ) {}

  /**
   * Add a webhook endpoint to a store.
   *
   * @param params - Webhook configuration
   * @returns Created webhook entity
   *
   * @example
   * // HTTP webhook (RSA-signed envelope, default)
   * const { webhook } = await client.webhooks.add({
   *   storeId: "STO_xxx",
   *   channel: "http",
   *   url: "https://example.com/webhook",
   *   events: ["order.completed", "refund.succeeded"],
   *   testMode: false,
   * });
   *
   * @example
   * // Discord webhook (uses Discord embed format)
   * await client.webhooks.add({
   *   storeId: "STO_xxx",
   *   channel: "discord",
   *   url: "https://discord.com/api/webhooks/...",
   *   events: ["order.completed"],
   *   testMode: false,
   * });
   *
   * @example
   * // Telegram bot — chat_id goes in `secret`; URL is the bot's sendMessage endpoint
   * await client.webhooks.add({
   *   storeId: "STO_xxx",
   *   channel: "telegram",
   *   url: "https://api.telegram.org/bot123:ABC/sendMessage",
   *   events: ["order.completed"],
   *   testMode: false,
   *   secret: "8737101383",
   * });
   */
  async add(params: AddWebhookParams): Promise<{ webhook: StoreWebhook }> {
    validateShortId("storeId", params.storeId, "STO");
    validateRequired("channel", params.channel);
    validateRequired("url", params.url);
    return this.http.post<{ webhook: StoreWebhook }>("/v1/actions/store/add-webhook", params);
  }

  /**
   * Update an existing webhook (only `url`, `events`, and `secret` are mutable).
   *
   * `channel` and `testMode` cannot be changed — remove the webhook and
   * re-add it instead. URL changes must remain on the same channel host
   * whitelist.
   *
   * @param params - Fields to update
   * @returns Updated webhook entity
   *
   * @example
   * await client.webhooks.update({
   *   id: "11111111-2222-3333-4444-555555555555",
   *   events: ["order.completed", "refund.succeeded", "subscription.canceled"],
   * });
   */
  async update(params: UpdateWebhookParams): Promise<{ webhook: StoreWebhook }> {
    validateRequired("id", params.id);
    return this.http.post<{ webhook: StoreWebhook }>("/v1/actions/store/update-webhook", params);
  }

  /**
   * Hard-delete a webhook. Historical `webhook_deliveries` rows are retained
   * (with `storeWebhookId` set to null) for audit purposes.
   *
   * @param params - Webhook to remove
   * @returns The removed webhook entity (snapshot before deletion)
   *
   * @example
   * await client.webhooks.remove({ id: "11111111-..." });
   */
  async remove(params: RemoveWebhookParams): Promise<{ webhook: StoreWebhook }> {
    validateRequired("id", params.id);
    return this.http.post<{ webhook: StoreWebhook }>("/v1/actions/store/remove-webhook", params);
  }

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

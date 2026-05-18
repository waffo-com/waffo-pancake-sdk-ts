import { createHash } from "node:crypto";

import { WaffoPancakeError } from "./errors.js";
import { normalizePrivateKey, signRequest } from "./signing.js";

import type { PostOptions, PostResult, WaffoPancakeConfig } from "./types.js";

const DEFAULT_BASE_URL = "https://api.waffo.ai";

/**
 * Internal HTTP client that auto-signs requests.
 *
 * The transport is intentionally thin: one {@link post} method that signs,
 * sends, and parses the {data, errors?, warnings?} envelope. It does NOT
 * unwrap `data`, throw on `errors[]`, or hide `warnings` — those are policy
 * choices that belong to the resource layer. See handbook
 * `coding-standards/code-style-guide/command-layer.md`.
 *
 * The `X-Merchant-Id` header is sent in `MER_{base62}` format as provided
 * by the user. The gateway decodes it to a raw UUID before forwarding.
 *
 * Not exported publicly — used by resource classes via {@link WaffoPancake}.
 */
export class HttpClient {
  private readonly merchantId: string;
  private readonly privateKey: string;
  private readonly baseUrl: string;
  private readonly _fetch: typeof fetch;

  constructor(config: WaffoPancakeConfig) {
    this.merchantId = config.merchantId;
    this.privateKey = normalizePrivateKey(config.privateKey);
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this._fetch = config.fetch ?? globalThis.fetch.bind(globalThis);
  }

  /**
   * Send a signed POST and return the full envelope plus HTTP status.
   *
   * Behavior:
   * - Builds RSA-SHA256 signature (`X-Merchant-Id` / `X-Timestamp` / `X-Signature`)
   * - Attaches `X-Idempotency-Key` (deterministic `sha256(merchantId + path + body)`)
   *   unless `options.noIdempotency` is set
   * - When `options.idempotencyWindow` is set, a floored timestamp is mixed into the
   *   key so identical params produce a new key after the window elapses
   * - Does NOT throw on `errors[]` or non-2xx status — caller inspects the result
   * - Throws {@link WaffoPancakeError} only on transport failures (non-JSON body)
   *
   * @param path - API path (e.g. `/v1/actions/store/create-store`, `/v1/graphql`)
   * @param body - Request body object
   * @param options - Optional settings
   * @returns Parsed envelope with HTTP status
   * @throws {WaffoPancakeError} When the response body is not valid JSON
   */
  async post<T>(path: string, body: object, options?: PostOptions): Promise<PostResult<T>> {
    const bodyStr = JSON.stringify(body);
    const timestampSec = Math.floor(Date.now() / 1000);
    const timestamp = timestampSec.toString();
    const signature = signRequest("POST", path, timestamp, bodyStr, this.privateKey);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Merchant-Id": this.merchantId,
      "X-Timestamp": timestamp,
      "X-Signature": signature,
    };
    if (!options?.noIdempotency) {
      headers["X-Idempotency-Key"] = computeIdempotencyKey(this.merchantId, path, bodyStr, timestampSec, options);
    }

    const response = await this._fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers,
      body: bodyStr,
    });

    let envelope: { data: T | null; errors?: PostResult<T>["errors"]; warnings?: PostResult<T>["warnings"] };
    try {
      envelope = (await response.json()) as typeof envelope;
    } catch {
      throw new WaffoPancakeError(response.status, [{ message: `Non-JSON response from ${path}`, layer: "sdk" }]);
    }
    return { status: response.status, ...envelope };
  }
}

function computeIdempotencyKey(merchantId: string, path: string, bodyStr: string, timestampSec: number, options?: PostOptions): string {
  const base = `${merchantId}:${path}:${bodyStr}`;
  const input = options?.idempotencyWindow ? `${base}:${Math.floor(timestampSec / options.idempotencyWindow)}` : base;
  return createHash("sha256").update(input).digest("hex");
}

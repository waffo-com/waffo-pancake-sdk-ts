import { createHash } from "node:crypto";

import { WaffoPancakeError } from "./errors.js";
import { normalizePrivateKey, signRequest } from "./signing.js";

import type { ApiResponse, WaffoPancakeConfig } from "./types.js";

const DEFAULT_BASE_URL = "https://waffo-pancake-auth-service.vercel.app";

/**
 * Internal HTTP client that auto-signs requests and attaches idempotency keys.
 *
 * The `X-Merchant-Id` header is sent in `MER_{base62}` format as provided by the user.
 * The gateway decodes it to a raw UUID before forwarding to downstream services.
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
    this._fetch = config.fetch ?? fetch;
  }

  /**
   * Send a signed POST request and return the parsed `data` field.
   *
   * Behavior:
   * - Generates a deterministic `X-Idempotency-Key` from `merchantId + path + body` (same request produces same key)
   * - Auto-builds RSA-SHA256 signature (`X-Merchant-Id` / `X-Timestamp` / `X-Signature`)
   * - Unwraps the response envelope: returns `data` on success, throws `WaffoPancakeError` on failure
   *
   * @param path - API path (e.g. `/v1/actions/store/create-store`)
   * @param body - Request body object
   * @returns Parsed `data` field from the response
   * @throws {WaffoPancakeError} When the API returns errors
   */
  async post<T>(path: string, body: object): Promise<T> {
    const bodyStr = JSON.stringify(body);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = signRequest("POST", path, timestamp, bodyStr, this.privateKey);

    const response = await this._fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Merchant-Id": this.merchantId,
        "X-Timestamp": timestamp,
        "X-Signature": signature,
        "X-Idempotency-Key": createHash("sha256")
          .update(`${this.merchantId}:${path}:${bodyStr}`)
          .digest("hex"),
      },
      body: bodyStr,
    });

    const result = (await response.json()) as ApiResponse<T>;

    if ("errors" in result && result.errors) {
      throw new WaffoPancakeError(response.status, result.errors);
    }

    return result.data as T;
  }
}

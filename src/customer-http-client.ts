import { WaffoPancakeError } from "./errors.js";

import type { Environment, PostResult, RequestOptions, WaffoPancakeConfig } from "./types.js";

const DEFAULT_BASE_URL = "https://api.waffo.ai";

/**
 * Internal HTTP client for customer-side requests using Bearer token authentication.
 *
 * Unlike {@link HttpClient} which signs requests with RSA-SHA256 (API Key auth),
 * this client attaches a session token as `Authorization: Bearer <token>`.
 * Idempotency works exactly as it does on the API Key client: no key is sent
 * unless the caller passes one, and the gateway deduplicates only when it is
 * present — it keys off the header, not off the credential.
 *
 * Session tokens carry no environment of their own, so every request also sends
 * `X-Environment`. The gateway treats a Bearer credential without it as an
 * incomplete JWT header set and answers HTTP 400.
 *
 * Not exported publicly — used internally by {@link CustomerSession}.
 */
export class CustomerHttpClient {
  private readonly token: string;
  private readonly environment: `${Environment}`;
  private readonly baseUrl: string;
  private readonly _fetch: typeof fetch;

  constructor(token: string, environment: `${Environment}`, config: Pick<WaffoPancakeConfig, "baseUrl" | "fetch">) {
    this.token = token;
    this.environment = environment;
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this._fetch = config.fetch ?? globalThis.fetch.bind(globalThis);
  }

  /**
   * Send a Bearer-authenticated POST and return the full envelope plus HTTP status.
   *
   * Sends `Authorization: Bearer <token>` and `X-Environment` — the gateway
   * requires both to accept a session token. `X-Idempotency-Key` is attached only
   * when the caller supplied `options.idempotencyKey`; no key is derived here.
   *
   * Does NOT throw on `errors[]` or non-2xx status — caller inspects the result.
   * Throws {@link WaffoPancakeError} only when the response body is not valid JSON.
   */
  async post<T>(path: string, body: object, options?: RequestOptions): Promise<PostResult<T>> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.token}`,
      "X-Environment": this.environment,
    };
    if (options?.idempotencyKey) {
      headers["X-Idempotency-Key"] = options.idempotencyKey;
    }

    const response = await this._fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
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

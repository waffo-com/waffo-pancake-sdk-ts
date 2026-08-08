import { WaffoPancakeError } from "./errors.js";

import type { Environment, PostResult, WaffoPancakeConfig } from "./types.js";

const DEFAULT_BASE_URL = "https://api.waffo.ai";

/**
 * Internal HTTP client for customer-side requests using Bearer token authentication.
 *
 * Unlike {@link HttpClient} which signs requests with RSA-SHA256 (API Key auth),
 * this client attaches a session token as `Authorization: Bearer <token>` and
 * never sends an idempotency key (customer session actions are not protected by
 * gateway idempotency in the current architecture).
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
   * requires both to accept a session token.
   *
   * Does NOT throw on `errors[]` or non-2xx status — caller inspects the result.
   * Throws {@link WaffoPancakeError} only when the response body is not valid JSON.
   */
  async post<T>(path: string, body: object): Promise<PostResult<T>> {
    const response = await this._fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
        "X-Environment": this.environment,
      },
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

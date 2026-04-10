import { WaffoPancakeError } from "./errors.js";

import type { ApiResponse, WaffoPancakeConfig } from "./types.js";

const DEFAULT_BASE_URL = "https://api.waffo.ai";

/**
 * Internal HTTP client for buyer-side requests using Bearer token authentication.
 *
 * Unlike {@link HttpClient} which signs requests with RSA-SHA256 (API Key auth),
 * this client attaches a session token as `Authorization: Bearer <token>`.
 *
 * Not exported publicly — used internally by {@link BuyerSession}.
 */
export class BuyerHttpClient {
  private readonly token: string;
  private readonly baseUrl: string;
  private readonly _fetch: typeof fetch;

  constructor(token: string, config: Pick<WaffoPancakeConfig, "baseUrl" | "fetch">) {
    this.token = token;
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this._fetch = config.fetch ?? fetch;
  }

  /**
   * Send a Bearer-authenticated POST request and return the parsed `data` field.
   *
   * @param path - API path
   * @param body - Request body object
   * @returns Parsed `data` field from the response
   * @throws {WaffoPancakeError} When the API returns errors
   */
  async post<T>(path: string, body: object): Promise<T> {
    const response = await this._fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify(body),
    });

    const result = (await response.json()) as ApiResponse<T>;

    if ("errors" in result && result.errors) {
      throw new WaffoPancakeError(response.status, result.errors);
    }

    return result.data as T;
  }
}

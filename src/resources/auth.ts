import { WaffoPancakeError } from "../errors.js";
import { unwrapAction } from "./internal.js";
import { validateRequired, validateShortId } from "../validation.js";

import type { HttpClient } from "../http-client.js";
import type { IssueSessionTokenParams, Notice, SessionToken } from "../types.js";

/** Authentication resource — issue session tokens for customers. */
export class AuthResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Issue a session token for a customer.
   *
   * @param params - Token issuance parameters
   * @returns Issued session token with expiration
   *
   * @example
   * // By store ID
   * const { token, expiresAt } = await client.auth.issueSessionToken({
   *   storeId: "STO_xxx",
   *   buyerIdentity: "customer@example.com",
   * });
   *
   * @example
   * // By product ID (store derived automatically)
   * const { token, expiresAt } = await client.auth.issueSessionToken({
   *   productId: "PROD_xxx",
   *   buyerIdentity: "customer@example.com",
   * });
   */
  async issueSessionToken(params: IssueSessionTokenParams): Promise<SessionToken & { warnings?: Notice[] }> {
    if (!params.storeId && !params.productId) {
      throw new WaffoPancakeError(400, [{ message: "Missing required field: provide storeId or productId", layer: "sdk" }]);
    }
    if (params.storeId) {
      validateShortId("storeId", params.storeId, "STO");
    }
    if (params.productId) {
      validateShortId("productId", params.productId, "PROD");
    }
    validateRequired("buyerIdentity", params.buyerIdentity);
    return unwrapAction(await this.http.post<SessionToken>("/v1/actions/auth/issue-session-token", params));
  }
}

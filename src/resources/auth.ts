import { validateRequired, validateShortId } from "../validation.js";

import type { HttpClient } from "../http-client.js";
import type { IssueSessionTokenParams, SessionToken } from "../types.js";

/** Authentication resource — issue session tokens for buyers. */
export class AuthResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Issue a session token for a buyer.
   *
   * @param params - Token issuance parameters
   * @returns Issued session token with expiration
   *
   * @example
   * const { token, expiresAt } = await client.auth.issueSessionToken({
   *   storeId: "STO_xxx",
   *   buyerIdentity: "customer@example.com",
   * });
   */
  async issueSessionToken(params: IssueSessionTokenParams): Promise<SessionToken> {
    validateShortId("storeId", params.storeId, "STO");
    validateRequired("buyerIdentity", params.buyerIdentity);
    return this.http.post<SessionToken>("/v1/actions/auth/issue-session-token", params);
  }
}

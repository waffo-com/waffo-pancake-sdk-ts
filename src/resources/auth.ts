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
   *   storeId: "sto_xxx",
   *   buyerIdentity: "customer@example.com",
   * });
   */
  async issueSessionToken(params: IssueSessionTokenParams): Promise<SessionToken> {
    return this.http.post<SessionToken>("/v1/actions/auth/issue-session-token", params);
  }
}

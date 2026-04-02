import type { HttpClient } from "../http-client.js";
import type {
  AuthenticatedCheckoutParams,
  AuthenticatedCheckoutResult,
  CheckoutSessionResult,
  SessionToken,
} from "../types.js";

/**
 * Authenticated checkout — merchant provides buyer identity.
 *
 * Issues a session token, creates a checkout session, and returns a
 * checkout URL with the token appended as a URL fragment (`#token=...`).
 * The checkout page reads the fragment to pre-fill buyer information.
 */
export class CheckoutAuthenticatedResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Create an authenticated checkout session.
   *
   * Behavior:
   * - Issues a session token via `issue-session-token`
   * - Creates a checkout session via `create-session`
   * - Appends the token to the checkout URL as a URL fragment
   * - Defaults `buyerEmail` to `buyerIdentity` when omitted
   *
   * @param params - Checkout parameters including buyer identity
   * @returns Session details with token-appended checkout URL
   *
   * @example
   * const result = await client.checkout.authenticated.create({
   *   storeId: "STO_xxx",
   *   productId: "PROD_xxx",
   *   productType: "onetime",
   *   currency: "USD",
   *   buyerIdentity: "customer@example.com",
   * });
   * // Redirect to result.checkoutUrl (includes #token=...)
   */
  async create(params: AuthenticatedCheckoutParams): Promise<AuthenticatedCheckoutResult> {
    const { buyerIdentity, buyerEmail, ...sessionFields } = params;

    const [tokenResult, sessionResult] = await Promise.all([
      this.http.post<SessionToken>("/v1/actions/auth/issue-session-token", {
        storeId: params.storeId,
        buyerIdentity,
      }),
      this.http.post<CheckoutSessionResult>("/v1/actions/checkout/create-session", {
        ...sessionFields,
        buyerEmail: buyerEmail ?? buyerIdentity,
      }),
    ]);

    return {
      sessionId: sessionResult.sessionId,
      checkoutUrl: `${sessionResult.checkoutUrl}#token=${tokenResult.token}`,
      expiresAt: sessionResult.expiresAt,
      token: tokenResult.token,
      tokenExpiresAt: tokenResult.expiresAt,
    };
  }
}

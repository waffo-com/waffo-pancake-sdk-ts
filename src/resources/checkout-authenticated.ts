import { unwrapAction } from "./internal.js";
import { validateCheckoutCommon, validatePlanChangeCommon, validateRequired } from "../validation.js";

import type { HttpClient } from "../http-client.js";
import type {
  AuthenticatedCheckoutParams,
  AuthenticatedCheckoutResult,
  AuthenticatedPlanChangeParams,
  CheckoutSessionResult,
  Notice,
  SessionToken,
} from "../types.js";

/**
 * Authenticated checkout — merchant provides customer identity.
 *
 * Issues a session token, creates a checkout session, and returns a
 * checkout URL with the token appended as a URL fragment (`#token=...`).
 * The checkout page reads the fragment to pre-fill customer information.
 *
 * `create()` issues a new-purchase link; `createPlanChange()` issues a link for
 * changing the plan of an existing subscription.
 */
export class CheckoutAuthenticatedResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Create an authenticated checkout session.
   *
   * Behavior:
   * - Issues a session token via `issue-session-token` (receives `buyerIdentity` + `productId` only)
   * - Creates a checkout session via `create-session` (receives every other field unchanged)
   * - Appends the token to the checkout URL as a URL fragment (`#token=...`)
   *
   * `buyerIdentity` and `buyerEmail` are independent inputs: identity is for the JWT,
   * email is for pre-filling the checkout page. The SDK forwards each to its own endpoint.
   *
   * @param params - Checkout parameters including customer identity
   * @returns Session details with token-appended checkout URL
   *
   * @example
   * const result = await client.checkout.authenticated.create({
   *   productId: "PROD_xxx",
   *   currency: "USD",
   *   buyerIdentity: "user-123",
   *   buyerEmail: "customer@example.com",
   *   orderMerchantExternalId: "ORDER-2026-00891",
   * });
   * // Redirect to result.checkoutUrl (includes #token=...)
   */
  async create(params: AuthenticatedCheckoutParams): Promise<AuthenticatedCheckoutResult & { warnings?: Notice[] }> {
    validateCheckoutCommon(params);
    validateRequired("buyerIdentity", params.buyerIdentity);
    const { buyerIdentity, ...sessionParams } = params;

    const [tokenResult, sessionResult] = await Promise.all([
      this.http.post<SessionToken>(
        "/v1/actions/auth/issue-session-token",
        {
          productId: params.productId,
          buyerIdentity,
        },
        { idempotencyWindow: 60 },
      ),
      this.http.post<CheckoutSessionResult>("/v1/actions/checkout/create-session", sessionParams, { idempotencyWindow: 60 }),
    ]);

    const token = unwrapAction(tokenResult);
    const session = unwrapAction(sessionResult);
    const warnings: Notice[] = [...(token.warnings ?? []), ...(session.warnings ?? [])];

    return {
      sessionId: session.sessionId,
      checkoutUrl: `${session.checkoutUrl}#token=${token.token}`,
      expiresAt: session.expiresAt,
      token: token.token,
      tokenExpiresAt: token.expiresAt,
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  }

  /**
   * Create an authenticated plan-change link for an existing subscription.
   *
   * Behavior:
   * - Same two-call split as `create()`: `buyerIdentity` goes to
   *   `issue-session-token`, everything else to `create-session`
   * - `originOrderId` puts the session into plan change mode, so the returned URL
   *   is the change confirmation page (`…/store/{slug}/change/{sessionId}`) with
   *   the token appended as a URL fragment (`#token=...`)
   * - The request is signed with the merchant API Key, so `changeAmount`,
   *   `changeCreditAmount` and `withTrial` are honored here; a customer credential
   *   calling the endpoint directly would have them silently dropped
   * - `changeAmount` and `changeCreditAmount` are mutually exclusive — the platform
   *   rejects both-at-once with a 400
   *
   * @param params - Plan change parameters including customer identity
   * @returns Session details with token-appended confirmation URL
   *
   * @example
   * const result = await client.checkout.authenticated.createPlanChange({
   *   originOrderId: "ORD_xxx",
   *   productId: "PROD_target_plan",
   *   currency: "USD",
   *   buyerIdentity: "user-123",
   *   changeTiming: ChangeTiming.NextPeriod,
   * });
   * // Redirect to result.checkoutUrl (includes #token=...)
   */
  async createPlanChange(params: AuthenticatedPlanChangeParams): Promise<AuthenticatedCheckoutResult & { warnings?: Notice[] }> {
    validatePlanChangeCommon(params);
    validateRequired("buyerIdentity", params.buyerIdentity);
    const { buyerIdentity, ...sessionParams } = params;

    const [tokenResult, sessionResult] = await Promise.all([
      this.http.post<SessionToken>(
        "/v1/actions/auth/issue-session-token",
        {
          productId: params.productId,
          buyerIdentity,
        },
        { idempotencyWindow: 60 },
      ),
      this.http.post<CheckoutSessionResult>("/v1/actions/checkout/create-session", sessionParams, { idempotencyWindow: 60 }),
    ]);

    const token = unwrapAction(tokenResult);
    const session = unwrapAction(sessionResult);
    const warnings: Notice[] = [...(token.warnings ?? []), ...(session.warnings ?? [])];

    return {
      sessionId: session.sessionId,
      checkoutUrl: `${session.checkoutUrl}#token=${token.token}`,
      expiresAt: session.expiresAt,
      token: token.token,
      tokenExpiresAt: token.expiresAt,
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  }
}

import { CheckoutAnonymousResource } from "./checkout-anonymous.js";
import { CheckoutAuthenticatedResource } from "./checkout-authenticated.js";
import { unwrapAction } from "./internal.js";

import type { HttpClient } from "../http-client.js";
import type { CheckoutSessionResult, CreateCheckoutSessionParams, Notice } from "../types.js";

/**
 * Checkout resource — create checkout sessions for payments.
 *
 * Provides two convenience sub-resources for the common checkout flows:
 * - `anonymous` — no buyer identity, empty form
 * - `authenticated` — merchant provides buyer identity, pre-filled form + token
 *
 * The low-level `createSession()` method is still available for full control.
 *
 * @example
 * // Anonymous checkout (no identity)
 * const result = await client.checkout.anonymous.create({
 *   productId: "PROD_xxx",
 *   currency: "USD",
 * });
 *
 * @example
 * // Authenticated checkout (with buyer identity)
 * const result = await client.checkout.authenticated.create({
 *   productId: "PROD_xxx",
 *   currency: "USD",
 *   buyerIdentity: "userIdInYourSystem",
 *   buyerEmail: "customer@example.com",
 * });
 * // result.checkoutUrl includes #token=...
 */
export class CheckoutResource {
  /** Anonymous checkout — no buyer identity, empty form. */
  readonly anonymous: CheckoutAnonymousResource;
  /** Authenticated checkout — merchant provides buyer identity. */
  readonly authenticated: CheckoutAuthenticatedResource;

  constructor(private readonly http: HttpClient) {
    this.anonymous = new CheckoutAnonymousResource(http);
    this.authenticated = new CheckoutAuthenticatedResource(http);
  }

  /**
   * Create a checkout session (low-level). Returns a URL to redirect the customer to.
   *
   * For most use cases, prefer `checkout.anonymous.create()` or
   * `checkout.authenticated.create()` which handle the full flow automatically.
   *
   * @param params - Checkout session parameters
   * @returns Session ID, checkout URL, and expiration
   *
   * @example
   * const session = await client.checkout.createSession({
   *   productId: "PROD_xxx",
   *   currency: "USD",
   *   buyerEmail: "customer@example.com",
   * });
   * // Redirect to session.checkoutUrl
   */
  async createSession(params: CreateCheckoutSessionParams): Promise<CheckoutSessionResult & { warnings?: Notice[] }> {
    return unwrapAction(
      await this.http.post<CheckoutSessionResult>("/v1/actions/checkout/create-session", params, { idempotencyWindow: 60 }),
    );
  }
}

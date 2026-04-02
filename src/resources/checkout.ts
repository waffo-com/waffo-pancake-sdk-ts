import { CheckoutAnonymousResource } from "./checkout-anonymous.js";
import { CheckoutAuthenticatedResource } from "./checkout-authenticated.js";

import type { HttpClient } from "../http-client.js";
import type { CheckoutSessionResult, CreateCheckoutSessionParams } from "../types.js";

/**
 * Checkout resource — create checkout sessions for payments.
 *
 * Provides two convenience sub-resources for the common checkout flows:
 * - `anonymous` — visitor enters without identity (empty form)
 * - `authenticated` — merchant provides buyer identity (pre-filled form + token)
 *
 * The low-level `createSession()` method is still available for full control.
 *
 * @example
 * // Anonymous checkout (visitor → shopper)
 * const result = await client.checkout.anonymous.create({
 *   storeId: "STO_xxx",
 *   productId: "PROD_xxx",
 *   productType: "onetime",
 *   currency: "USD",
 * });
 *
 * @example
 * // Authenticated checkout (customer)
 * const result = await client.checkout.authenticated.create({
 *   storeId: "STO_xxx",
 *   productId: "PROD_xxx",
 *   productType: "onetime",
 *   currency: "USD",
 *   buyerIdentity: "customer@example.com",
 * });
 * // result.checkoutUrl includes #token=...
 */
export class CheckoutResource {
  /** Anonymous checkout — visitor enters without a session token. */
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
   *   storeId: "STO_xxx",
   *   productId: "PROD_xxx",
   *   productType: "onetime",
   *   currency: "USD",
   *   buyerEmail: "customer@example.com",
   * });
   * // Redirect to session.checkoutUrl
   */
  async createSession(params: CreateCheckoutSessionParams): Promise<CheckoutSessionResult> {
    return this.http.post<CheckoutSessionResult>("/v1/actions/checkout/create-session", params);
  }
}

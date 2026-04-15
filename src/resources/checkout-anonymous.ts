import { validateCheckoutCommon } from "../validation.js";

import type { HttpClient } from "../http-client.js";
import type { AnonymousCheckoutParams, CheckoutSessionResult } from "../types.js";

/**
 * Anonymous checkout — no buyer identity provided.
 *
 * The buyer reaches the checkout page without a session token. Merchants may still
 * pre-fill `buyerEmail` and `billingDetail` on the page by passing them here.
 * Internally creates a checkout session and returns the redirect URL.
 */
export class CheckoutAnonymousResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Create an anonymous checkout session.
   *
   * @param params - Checkout parameters (no buyer identity required)
   * @returns Session ID, checkout URL, and expiration
   *
   * @example
   * // Minimal — buyer fills everything on the page
   * const result = await client.checkout.anonymous.create({
   *   productId: "PROD_xxx",
   *   currency: "USD",
   * });
   *
   * @example
   * // Pre-fill email and billing without issuing a session token
   * const result = await client.checkout.anonymous.create({
   *   productId: "PROD_xxx",
   *   currency: "USD",
   *   buyerEmail: "customer@example.com",
   *   billingDetail: { country: "US", isBusiness: false, postcode: "10001" },
   * });
   */
  async create(params: AnonymousCheckoutParams): Promise<CheckoutSessionResult> {
    validateCheckoutCommon(params);
    return this.http.post<CheckoutSessionResult>("/v1/actions/checkout/create-session", params, { idempotencyWindow: 60 });
  }
}

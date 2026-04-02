import type { HttpClient } from "../http-client.js";
import type { AnonymousCheckoutParams, CheckoutSessionResult } from "../types.js";

/**
 * Anonymous checkout — no buyer identity provided.
 *
 * The buyer fills in billing details manually on the checkout page.
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
   * const result = await client.checkout.anonymous.create({
   *   storeId: "STO_xxx",
   *   productId: "PROD_xxx",
   *   productType: "onetime",
   *   currency: "USD",
   * });
   * // Redirect to result.checkoutUrl
   */
  async create(params: AnonymousCheckoutParams): Promise<CheckoutSessionResult> {
    return this.http.post<CheckoutSessionResult>(
      "/v1/actions/checkout/create-session",
      params,
    );
  }
}

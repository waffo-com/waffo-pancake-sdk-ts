import type { HttpClient } from "../http-client.js";
import type { CheckoutSessionResult, CreateCheckoutSessionParams } from "../types.js";

/** Checkout resource — create checkout sessions for payments. */
export class CheckoutResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Create a checkout session. Returns a URL to redirect the customer to.
   *
   * @param params - Checkout session parameters
   * @returns Session ID, checkout URL, and expiration
   *
   * @example
   * const session = await client.checkout.createSession({
   *   storeId: "sto_xxx",
   *   productId: "otp_xxx",
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

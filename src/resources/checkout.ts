import { CheckoutAnonymousResource } from "./checkout-anonymous.js";
import { CheckoutAuthenticatedResource } from "./checkout-authenticated.js";
import { unwrapAction } from "./internal.js";
import { validateCheckoutCommon, validatePlanChangeCommon } from "../validation.js";

import type { HttpClient } from "../http-client.js";
import type {
  CheckoutSessionResult,
  CreateCheckoutSessionParams,
  CreatePlanChangeSessionParams,
  Notice,
  RequestOptions,
} from "../types.js";

/**
 * Checkout resource — create checkout sessions for payments.
 *
 * Provides two convenience sub-resources for the common checkout flows:
 * - `anonymous` — no customer identity, empty form
 * - `authenticated` — merchant provides customer identity, pre-filled form + token
 *
 * `createPlanChangeSession()` issues a link for changing an existing subscription's
 * plan, and the low-level `createSession()` is still available for full control.
 *
 * Every method on this resource validates its input before sending, as resource
 * methods do throughout the SDK.
 *
 * @example
 * // Anonymous checkout (no identity)
 * const result = await client.checkout.anonymous.create({
 *   productId: "PROD_xxx",
 *   currency: "USD",
 * });
 *
 * @example
 * // Authenticated checkout (with customer identity)
 * const result = await client.checkout.authenticated.create({
 *   productId: "PROD_xxx",
 *   currency: "USD",
 *   buyerIdentity: "userIdInYourSystem",
 *   buyerEmail: "customer@example.com",
 * });
 * // result.checkoutUrl includes #token=...
 */
export class CheckoutResource {
  /** Anonymous checkout — no customer identity, empty form. */
  readonly anonymous: CheckoutAnonymousResource;
  /** Authenticated checkout — merchant provides customer identity. */
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
   * Validates the same fields as those two methods, including that `couponId` is a
   * `CPN_` Short ID and is not combined with `promotionCode` or `allowPromotionCodes`,
   * and that `promotionCode` is a non-empty string.
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
   *
   * @example
   * // Apply a coupon the customer cannot change
   * await client.checkout.createSession({ productId: "PROD_xxx", currency: "USD", couponId: "CPN_xxx" });
   *
   * // Or let the customer enter a code on the checkout page
   * await client.checkout.createSession({ productId: "PROD_xxx", currency: "USD", allowPromotionCodes: true });
   *
   * // Prefill a promotion code; allowPromotionCodes: true lets the customer change or remove it,
   * // leave it out to lock the code
   * await client.checkout.createSession({
   *   productId: "PROD_xxx",
   *   currency: "USD",
   *   promotionCode: "SPRING-20",
   *   allowPromotionCodes: true,
   * });
   */
  async createSession(
    params: CreateCheckoutSessionParams,
    options?: RequestOptions,
  ): Promise<CheckoutSessionResult & { warnings?: Notice[] }> {
    validateCheckoutCommon(params);
    return unwrapAction(await this.http.post<CheckoutSessionResult>("/v1/actions/checkout/create-session", params, options));
  }

  /**
   * Create a plan-change session for an existing subscription. Returns a URL to
   * send the customer to, where they confirm the change.
   *
   * Behavior:
   * - Hits the same `create-session` endpoint as `createSession()`; `originOrderId`
   *   is what puts the request into plan change mode
   * - Pass `{ idempotencyKey }` to have a retry return the first session instead of
   *   issuing a second one; without a key nothing is deduplicated
   * - The returned `checkoutUrl` points at the change confirmation page
   *   (`…/store/{slug}/change/{sessionId}`), not the new-purchase cashier
   * - `changeAmount`, `changeCreditAmount` and `withTrial` are merchant-credential
   *   only; the platform silently drops them for any other credential
   * - `changeAmount` and `changeCreditAmount` are mutually exclusive, and the
   *   platform rejects both-at-once with a 400 — the SDK forwards what you pass
   * - Discounts: `couponId` (locked), `promotionCode` (prefilled; changeable only with
   *   `allowPromotionCodes: true`) or `allowPromotionCodes` alone (code entry field).
   *   A coupon or code replaces the subscription's current discount; without one the
   *   current discount carries over with the periods already used, unless it has no
   *   periods left, its coupon's `redeemBy` is within 60 seconds, or the coupon is
   *   deactivated. `couponId` with `promotionCode` or `allowPromotionCodes` throws
   *   `WaffoPancakeError` (400, `layer: "sdk"`) before sending
   * - Issued with your API Key, so the platform checks only that the subscription is
   *   yours: any target plan is allowed, in the group or not. For the customer-driven
   *   half (same group + `selfServicePlanChange` on), see
   *   `client.customer(token).createPlanChangeSession()`
   *
   * @param params - Plan change parameters; `originOrderId` identifies the subscription
   * @returns Session ID, confirmation page URL, and expiration
   *
   * @example
   * const session = await client.checkout.createPlanChangeSession({
   *   originOrderId: "ORD_xxx",
   *   productId: "PROD_target_plan",
   *   currency: "USD",
   *   changeTiming: ChangeTiming.Immediate,
   *   changeCreditAmount: "8.00", // or changeAmount — never both
   * });
   * // Send the customer to session.checkoutUrl
   */
  async createPlanChangeSession(
    params: CreatePlanChangeSessionParams,
    options?: RequestOptions,
  ): Promise<CheckoutSessionResult & { warnings?: Notice[] }> {
    validatePlanChangeCommon(params);
    return unwrapAction(await this.http.post<CheckoutSessionResult>("/v1/actions/checkout/create-session", params, options));
  }
}

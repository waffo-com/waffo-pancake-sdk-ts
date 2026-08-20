import { unwrapAction } from "./internal.js";
import { validateShortId } from "../validation.js";

import type { HttpClient } from "../http-client.js";
import type { CancelSubscriptionParams, CancelSubscriptionResult, Notice } from "../types.js";

/** Order management resource. */
export class OrdersResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Cancel a subscription order.
   *
   * - pending -> canceled (immediate, no PSP call)
   * - active/trialing -> canceling (PSP cancel scheduled for the end of the
   *   current billing period; the subscription stays usable until then)
   * - past_due -> canceling (PSP cancel dispatched immediately; the billing
   *   period has already lapsed, so nothing is left to use)
   *
   * In both canceling cases the terminal `canceled` status is written when the
   * PSP cancellation webhook arrives, not by this call.
   *
   * @param params - Order to cancel
   * @returns Order ID and resulting status
   *
   * @example
   * const { orderId, status } = await client.orders.cancelSubscription({
   *   orderId: "ORD_xxx",
   * });
   * // status: "canceled" or "canceling"
   */
  async cancelSubscription(params: CancelSubscriptionParams): Promise<CancelSubscriptionResult & { warnings?: Notice[] }> {
    validateShortId("orderId", params.orderId, "ORD");
    return unwrapAction(await this.http.post<CancelSubscriptionResult>("/v1/actions/subscription-order/cancel-order", params));
  }
}

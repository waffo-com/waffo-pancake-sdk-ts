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
   * - pending -> canceled (immediate)
   * - active/trialing -> canceling (PSP cancel, webhook updates later)
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
